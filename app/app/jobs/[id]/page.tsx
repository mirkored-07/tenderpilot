"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { getJobDisplayName, setJobDisplayName, clearJobDisplayName } from "@/lib/pilot-job-names";
import { stableRefKey } from "@/lib/bid-workflow/keys";

import Checklist from "@/components/checklist/Checklist";
import Risks from "@/components/risks/Risks";
import BuyerQuestions from "@/components/questions/BuyerQuestions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type JobStatus = "queued" | "processing" | "done" | "failed";

type DbJob = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string | null;
  source_type: string | null;
  status: JobStatus;
  credits_used: number;
  created_at: string;
  updated_at: string;
};

type DbJobResult = {
  job_id: string;
  user_id: string;
  extracted_text: string | null;

  // These columns are written by the Edge function (process-job)
  executive_summary: any | null;
  clarifications: any | null;

  checklist: any | null;
  risks: any | null;

  // proposal_draft is a string in the Edge function output
  proposal_draft: string | null;

  created_at: string;
  updated_at: string;
};
type DbJobEvent = {
  job_id: string;
  user_id: string;
  level: "info" | "warn" | "error";
  message: string;
  meta: any | null;
  created_at: string;
};

type EvidenceCandidateUi = {
  id: string; // E001
  excerpt: string;
  page: number | null;
  anchor: string | null;
  kind?: string | null;
  score?: number | null;
};

type EvidenceFocus = {
  id: string;
  excerpt: string;
  page?: number | null;
  anchor?: string | null;
  note?: string | null;
  allIds?: string[] | null;
};



type VerdictState = "proceed" | "caution" | "hold";

/** UI safety: cap initial source-text render to avoid freezing on huge extractions */
const SOURCE_TEXT_PREVIEW_LIMIT = 20_000;

function VerdictBadge({ state }: { state: VerdictState }) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs";
  if (state === "proceed") {
    return <span className={`${base} border-green-200 bg-green-50 text-green-800`}>Proceed</span>;
  }
  if (state === "hold") {
    return <span className={`${base} border-red-200 bg-red-50 text-red-800`}>Hold — resolve blockers to bid</span>;
  }
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-900`}>Proceed with caution</span>;
}

function verdictMicrocopy(state: VerdictState) {
  if (state === "proceed") return "No major blockers detected. You can start tender response work.";
  if (state === "hold") return "Bid is possible only if these blockers are resolved. Start with MUST items needing verification and submission rules.";
  return "Tender looks feasible, but validate key points before committing.";
}

function classifyClarification(text: string): { category: string; priority: "P1" | "P2"; hint: string } {
  const t = String(text ?? "").toLowerCase();

  const isP1 =
    t.includes("deadline") ||
    t.includes("due date") ||
    t.includes("submission") ||
    t.includes("submit") ||
    t.includes("portal") ||
    t.includes("format") ||
    t.includes("mandatory") ||
    t.includes("must") ||
    t.includes("eligib") ||
    t.includes("disqual");

  // Submission mechanics / deadline / portal / packaging
  if (
    t.includes("deadline") ||
    t.includes("due date") ||
    t.includes("submission") ||
    t.includes("submit") ||
    t.includes("portal") ||
    t.includes("format") ||
    t.includes("file") ||
    t.includes("upload")
  ) {
    return { category: "Submission", priority: isP1 ? "P1" : "P2", hint: "How/when you must submit." };
  }

  // Eligibility / qualification
  if (
    t.includes("eligib") ||
    t.includes("qualification") ||
    t.includes("turnover") ||
    t.includes("reference") ||
    t.includes("experience") ||
    t.includes("certificate")
  ) {
    return { category: "Eligibility", priority: "P1", hint: "May affect whether you can participate." };
  }

  // Commercial
  if (
    t.includes("price") ||
    t.includes("pricing") ||
    t.includes("cost") ||
    t.includes("payment") ||
    t.includes("invoice") ||
    t.includes("currency")
  ) {
    return { category: "Commercial", priority: isP1 ? "P1" : "P2", hint: "Pricing/payment/commercial terms." };
  }

  // Legal / contractual
  if (
    t.includes("contract") ||
    t.includes("liability") ||
    t.includes("indemn") ||
    t.includes("ip ") ||
    t.includes("intellectual property") ||
    t.includes("confidential") ||
    t.includes("gdpr") ||
    t.includes("data protection")
  ) {
    return { category: "Legal", priority: isP1 ? "P1" : "P2", hint: "Legal/contract terms to confirm." };
  }

  // Delivery / timeline / support
  if (
    t.includes("delivery") ||
    t.includes("timeline") ||
    t.includes("schedule") ||
    t.includes("lead time") ||
    t.includes("support") ||
    t.includes("sla")
  ) {
    return { category: "Delivery", priority: isP1 ? "P1" : "P2", hint: "Delivery or support commitments." };
  }

  // Scope / technical
  if (
    t.includes("scope") ||
    t.includes("specification") ||
    t.includes("technical") ||
    t.includes("integration") ||
    t.includes("interface") ||
    t.includes("requirement")
  ) {
    return { category: "Scope", priority: isP1 ? "P1" : "P2", hint: "Technical/scope boundary to confirm." };
  }

  return { category: "General", priority: isP1 ? "P1" : "P2", hint: "Confirm in the tender source." };
}

function buildReadyToSendClarifications(args: { tenderName: string; questions: string[] }) {
  const tenderName = String(args.tenderName ?? "").trim() || "Tender";
  const raw = (args.questions ?? []).map((q) => String(q ?? "").trim()).filter(Boolean);

  const items = raw.map((q) => ({ q, meta: classifyClarification(q) }));

  const order = ["Submission", "Eligibility", "Commercial", "Legal", "Delivery", "Scope", "General"];

  const grouped = order
    .map((cat) => ({
      cat,
      items: items.filter((x) => x.meta.category === cat).sort((a, b) => (a.meta.priority === b.meta.priority ? 0 : a.meta.priority === "P1" ? -1 : 1)),
    }))
    .filter((g) => g.items.length);

  const subject = `Clarification questions – ${tenderName}`;
  const intro =
    `Hello,\n\n` +
    `We are preparing our tender response and would appreciate clarification on the points below.\n` +
    `Thank you.\n\n`;

  const body = grouped
    .map((g) => {
      const lines = g.items.map((x, i) => `${x.meta.priority} – ${i + 1}. ${x.q}`);
      return `${g.cat}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  return { subject, intro, body, grouped };
}

async function safeCopy(text: string) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function toSafeFileBaseName(input: string) {
  const raw = String(input ?? "").trim() || "tender_brief";
  return (
    raw
      .replaceAll(/\s+/g, " ")
      .replaceAll(/[\\/:*?"<>|]/g, "")
      .replaceAll(".", "_")
      .slice(0, 80)
      .trim() || "tender_brief"
  );
}

function statusBadge(status: JobStatus) {
  if (status === "done") return <Badge className="rounded-full">Ready</Badge>;
  if (status === "failed")
    return (
      <Badge variant="destructive" className="rounded-full">
        Needs attention
      </Badge>
    );
  if (status === "queued")
    return (
      <Badge variant="secondary" className="rounded-full">
        Getting started
      </Badge>
    );
  return (
    <Badge variant="secondary" className="rounded-full">
      Working
    </Badge>
  );
}

function ProgressCard({
  status,
  events,
}: {
  status: JobStatus;
  events: DbJobEvent[];
}) {
  function pickFailure(events: DbJobEvent[]) {
    const msgs = (events ?? []).map((e) => e.message);

    if (msgs.includes("Job exceeds cost cap, reduce input or limits")) {
      const e = events.find((x) => x.message === "Job exceeds cost cap, reduce input or limits");
      const usdEst = e?.meta?.usdEst;
      const maxUsd = e?.meta?.maxUsdPerJob;

      return {
        title: "File exceeds processing limits",
        text:
          "This file is too large for the current processing limits." +
          (usdEst && maxUsd
            ? ` (Estimated cost: $${Number(usdEst).toFixed(3)}, cap: $${Number(maxUsd).toFixed(3)})`
            : "") +
          " Upload a smaller scope (eligibility + requirements) or split the tender.",
      };
    }

    if (msgs.includes("Unstructured extract returned empty text")) {
      return {
        title: "No text could be extracted",
        text: "We could not read text from this file. If it is a scanned PDF, export it with OCR and retry.",
      };
    }

    if (msgs.includes("Storage download failed")) {
      return {
        title: "File could not be accessed",
        text: "We could not access the uploaded file. Please re-upload and try again.",
      };
    }

    if (msgs.includes("Saving results failed")) {
      return {
        title: "Results could not be saved",
        text: "We generated results but could not save them. Please retry.",
      };
    }

    return {
      title: "Something needs attention",
      text: "Please try again or re-upload the file.",
    };
  }

  const isFailed = status === "failed";
  const failure = isFailed ? pickFailure(events) : null;

  const title =
    status === "queued"
      ? "Getting started"
      : status === "processing"
      ? "Working on your tender review"
      : isFailed
      ? failure?.title ?? "Something needs attention"
      : "Ready";

  const subtitle =
    status === "queued"
      ? "Preparing your workspace…"
      : status === "processing"
      ? "Extracting requirements, risks, clarifications, and a short draft…"
      : isFailed
      ? failure?.text ?? "Please try again."
      : "Results are ready.";

  const barClass =
    status === "failed"
      ? "w-full bg-red-500"
      : status === "queued"
      ? "w-1/3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-pulse"
      : status === "processing"
      ? "w-2/3 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-pulse"
      : "w-full bg-green-500";

  return (
    <Card className="rounded-2xl">
      <CardContent className="py-5 space-y-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">Results appear automatically on this page</p>
        </div>

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barClass}`} />
        </div>

        <p className="text-xs text-muted-foreground">{subtitle}</p>

        <p className="text-xs text-muted-foreground">
          Steps: upload → extract → analyze → results. This usually takes 1–3 minutes (large files can take longer). If it
          takes longer, refresh this page or open{" "}
          <Link href="/app/jobs" className="underline underline-offset-4">
            My jobs
          </Link>
          .
        </p>

        {isFailed ? (
          <div className="pt-1">
            <Button asChild className="rounded-full">
              <Link href="/app/upload">Start a new review</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}


function findExcerpt(text: string, query: string) {
  const t = text ?? "";
  const qRaw = (query ?? "").trim();
  if (!t || !qRaw) return null;

  const hay = t.toLowerCase();
  // SECTION_REF mode: jump to a section heading with 100% precision (highlight the heading line only).
  // Format: "SECTION_REF: <exact section heading text>"
  if (/^SECTION_REF\s*:/i.test(qRaw)) {
    const anchor = qRaw.replace(/^SECTION_REF\s*:/i, "").trim();
    if (!anchor) return null;
    const idx = hay.indexOf(anchor.toLowerCase());
    if (idx < 0) return null;

    // Highlight only the heading line (up to line break or paragraph break)
    const lineStart = t.lastIndexOf("\n", Math.max(0, idx)) + 1;
    let lineEnd = t.indexOf("\n", idx);
    if (lineEnd < 0) lineEnd = t.length;

    // If the heading is followed by a blank line, prefer ending at the paragraph break
    const paraEnd = t.indexOf("\n\n", idx);
    if (paraEnd >= 0 && paraEnd < lineEnd + 2) {
      lineEnd = paraEnd;
    }

    const line = t.slice(lineStart, lineEnd).replace(/\s+/g, " ").trim();
    return {
      idx: lineStart,
      snippet: line || anchor,
      highlightStart: lineStart,
      highlightEnd: lineEnd,
    };
  }


  const q = qRaw.toLowerCase();

  function paragraphBounds(centerIdx: number) {
    // Prefer paragraph boundaries (blank lines) because tenders are clause-based
    const left = t.lastIndexOf("\n\n", Math.max(0, centerIdx));
    const right = t.indexOf("\n\n", Math.max(0, centerIdx));
    const start = left >= 0 ? left + 2 : 0;
    const end = right >= 0 ? right : t.length;
    return { start, end };
  }

  function makeResult(matchStart: number, matchLen: number) {
    const center = matchStart + Math.floor(Math.max(1, matchLen) / 2);
    const { start, end } = paragraphBounds(center);

    // Human-readable snippet (single-line)
    const snippet = t.slice(start, end).replace(/\s+/g, " ").trim();

    return {
      idx: start,
      snippet,
      highlightStart: start,
      highlightEnd: end,
    };
  }

  // 0) If query contains explicit anchors, try those first (SECTION / ANNEX / PAGE)
  const anchorCandidates = qRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^SECTION\b|^ANNEX\b|^\[PAGE\b/i.test(s))
    .slice(0, 3);

  for (const a of anchorCandidates) {
    const aIdx = hay.indexOf(a.toLowerCase());
    if (aIdx >= 0) return makeResult(aIdx, a.length);
  }

  // 1) Exact match
  const exactIdx = hay.indexOf(q);
  if (exactIdx >= 0) return makeResult(exactIdx, qRaw.length);

  // 2) Contiguous needles (first N words)
  const wordsAll = qRaw.split(/\s+/).filter(Boolean);
  const needles = [wordsAll.slice(0, 14).join(" "), wordsAll.slice(0, 10).join(" "), wordsAll.slice(0, 7).join(" ")].filter(Boolean);

  for (const n of needles) {
    const idx = hay.indexOf(n.toLowerCase());
    if (idx >= 0) return makeResult(idx, n.length);
  }

  // 3) Fuzzy: score windows by unique keyword hits, but require stronger evidence
  const STOP = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","by","via","is","are","be","as","at","from",
    "that","this","these","those","must","should","shall","will","may","can","not","only","all",
  ]);

  const tokens = wordsAll
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length >= 4 && !STOP.has(w));

  if (!tokens.length) return null;

  const uniq = Array.from(new Set(tokens)).slice(0, 14);

  type Occ = { idx: number; token: string };
  const occs: Occ[] = [];
  const MAX_OCC_PER_TOKEN = 30;

  for (const tok of uniq) {
    let start = 0;
    let found = 0;
    while (found < MAX_OCC_PER_TOKEN) {
      const i = hay.indexOf(tok, start);
      if (i < 0) break;
      occs.push({ idx: i, token: tok });
      found += 1;
      start = i + tok.length;
    }
  }

  if (!occs.length) return null;

  const WINDOW = 900;
  let best = { score: 0, center: occs[0].idx, tokenLen: occs[0].token.length };

  for (const o of occs) {
    const wStart = o.idx - WINDOW / 2;
    const wEnd = o.idx + WINDOW / 2;

    const tokensInWindow = new Set<string>();
    for (const other of occs) {
      if (other.idx >= wStart && other.idx <= wEnd) tokensInWindow.add(other.token);
    }

    const score = tokensInWindow.size;
    if (score > best.score) {
      best = { score, center: o.idx, tokenLen: o.token.length };
    }
  }

  // Stronger threshold to reduce “wrong highlight” cases.
  // If we can’t find enough keyword overlap, we prefer “no match” over misleading highlights.
  if (best.score < 3) return null;

  const { start, end } = paragraphBounds(best.center);
  const snippet = t.slice(start, end).replace(/\s+/g, " ").trim();

  return {
    idx: start,
    snippet,
    highlightStart: start,
    highlightEnd: end,
  };
}


function escapeHtml(input: string) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pickText(obj: any) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return String(obj?.title ?? obj?.text ?? obj?.risk ?? obj?.requirement ?? obj?.question ?? obj?.summary ?? "").trim();
}

function normalizeChecklist(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.requirements)) return raw.requirements;
  return [];
}

function normalizeRisks(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.risks)) return raw.risks;
  return [];
}

function normalizeQuestions(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (Array.isArray(raw?.items)) return raw.items.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  if (Array.isArray(raw?.questions)) return raw.questions.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  return [];
}

function toExecutiveModel(args: { raw: any }) {
  const { raw } = args;

  const decisionBadge = String(raw?.decisionBadge ?? raw?.decision ?? "").trim();
  const decisionLine = String(raw?.decisionLine ?? "").trim();

  const keyFindings = Array.isArray(raw?.keyFindings) ? raw.keyFindings : [];
  const nextActions = Array.isArray(raw?.nextActions) ? raw.nextActions : [];
  const topRisks = Array.isArray(raw?.topRisks) ? raw.topRisks : [];

  const submissionDeadline = raw?.submissionDeadline ? String(raw.submissionDeadline).trim() : "";

  const normalizedTopRisks = topRisks
    .slice(0, 3)
    .map((r: any) => {
      const titleCandidate = String(r?.title ?? r?.risk ?? r?.text ?? "").trim();
      const detailCandidate = String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? r?.mitigation ?? "").trim();
      const title = titleCandidate || detailCandidate;

      return {
        title,
        severity: String(r?.severity ?? r?.level ?? "medium").toLowerCase(),
        detail: titleCandidate ? detailCandidate : "",
      };
    })
    .filter((r: any) => r.title);

  return {
    decisionBadge: decisionBadge || "Proceed with caution",
    decisionLine,
    keyFindings: keyFindings.slice(0, 7).map((x: any) => String(x ?? "").trim()).filter(Boolean),
    nextActions: nextActions.slice(0, 3).map((x: any) => String(x ?? "").trim()).filter(Boolean),
    topRisks: normalizedTopRisks,
    submissionDeadline,
  };
}

function renderDraftPlain(draft: any): string[] {
  if (!draft) return ["Draft not available."];

  if (typeof draft === "string") {
    const lines = draft.split("\n").map((l) => l.trimEnd());
    return lines.filter((l) => l.trim().length > 0);
  }

  const sections = Array.isArray(draft?.sections) ? draft.sections : [];
  if (!sections.length) return ["Draft not available."];

  const out: string[] = [];
  for (const s of sections) {
    const title = String(s?.title ?? "").trim();
    if (title) out.push(title);
    const bullets = Array.isArray(s?.bullets) ? s.bullets : [];
    for (const b of bullets) {
      const line = String(b ?? "").trim();
      if (line) out.push(`- ${line}`);
    }
    out.push("");
  }
  return out.filter((x) => x !== "");
}

function toPlainTextSummary(args: {
  fileName?: string;
  createdAt?: string;
  verdictLabel?: string;
  decisionLine?: string;
  rationaleSnapshot?: string[];
  recommendedAction?: string;
  whereToVerify?: string;
  checklist: any[];
  risks: any[];
  questions: string[];
  draftText: any;
  evidenceById?: Map<string, EvidenceCandidateUi>;
}) {
  const { fileName, createdAt, verdictLabel, decisionLine, rationaleSnapshot, recommendedAction, whereToVerify, checklist, risks, questions, draftText, evidenceById } = args;

  const must = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"));
  const should = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("SHOULD"));
  const info = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("INFO"));

  const lines: string[] = [];
  lines.push("TenderPilot summary");
  lines.push("");
  if (fileName) lines.push(`File: ${fileName}`);
  if (createdAt) lines.push(`Created: ${formatDate(createdAt)}`);
  lines.push("");
  // Decision-first header (mirrors the UI)
  if (verdictLabel) lines.push(`Decision: ${verdictLabel}`);
  if (decisionLine) lines.push(`Why: ${decisionLine}`);
  if (recommendedAction) lines.push(`Recommended action: ${recommendedAction}`);
  if (whereToVerify) lines.push(`Where to verify: ${whereToVerify}`);
  if (rationaleSnapshot && rationaleSnapshot.length) {
    lines.push("");
    lines.push("Rationale snapshot");
    rationaleSnapshot.slice(0, 5).forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  }
  lines.push("");

  function render(label: string, items: string[]) {
    lines.push(label);
    if (!items.length) lines.push("None detected.");
    else items.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }

  function renderEvidenceLines(ids: any): string[] {
    const out: string[] = [];
    if (!evidenceById) return out;
    const arr = Array.isArray(ids) ? ids : [];
    for (const rawId of arr) {
      const id = String(rawId ?? "").trim();
      if (!id) continue;
      const ev = evidenceById.get(id);
      if (!ev) {
        out.push(`  - Evidence ${id}: (missing in evidence candidates)`);
        continue;
      }
      const pageLabel = ev.page === null || ev.page === undefined ? "Page ?" : `Page ${ev.page}`;
      const excerpt = String(ev.excerpt ?? "").trim();
      const head = `Evidence ${id} (${pageLabel})`;
      out.push(excerpt ? `  - ${head}: ${excerpt}` : `  - ${head}`);
    }
    return out;
  }

  function buildBuyerEmail(items: string[], tenderName?: string): string[] {
    const name = String(tenderName ?? "").trim() || "Tender";
    const subject = `Clarification questions — ${name}`;

    const lines: string[] = [];
    lines.push(`Subject: ${subject}`);
    lines.push("");
    lines.push("Hello,");
    lines.push("");
    lines.push("We are preparing our tender response and would appreciate clarification on the points below.");
    lines.push("Thank you.");
    lines.push("");
    items.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    return lines;
  }


  lines.push("MUST blockers (with evidence)");
  if (!must.length) lines.push("None detected.");
  else {
    must.forEach((x, i) => {
      const t = String(x?.text ?? x?.requirement ?? "").trim();
      if (!t) return;
      lines.push(`${i + 1}. ${t}`);
      renderEvidenceLines((x as any)?.evidence_ids).forEach((l) => lines.push(l));
    });
  }
  lines.push("");

  render(
    "SHOULD items",
    should.map((x) => String(x?.text ?? x?.requirement ?? "").trim()).filter(Boolean)
  );
  render(
    "INFO items",
    info.map((x) => String(x?.text ?? x?.requirement ?? "").trim()).filter(Boolean)
  );

  
  lines.push("Risks (with evidence)");
  if (!risks.length) lines.push("No risks detected.");
  else {
    risks.slice(0, 20).forEach((r, i) => {
      const sev = String(r?.severity ?? r?.level ?? "medium").toUpperCase();
      const title = String(r?.title ?? r?.risk ?? r?.text ?? "").trim();
      const detail = String(r?.detail ?? r?.description ?? "").trim();
      const head = `${i + 1}. [${sev}] ${title}${detail ? ` — ${detail}` : ""}`;
      lines.push(head);
      renderEvidenceLines((r as any)?.evidence_ids).forEach((l) => lines.push(l));
    });
  }
  lines.push("");


  
  lines.push("Clarifications");
  if (!questions.length) {
    lines.push("No clarifications suggested.");
    lines.push("");
  } else {
    const tender = fileName || "Tender";
    lines.push("Ready-to-send email");
    buildBuyerEmail(questions, tender).slice(0, 120).forEach((l) => lines.push(l));
    lines.push("");

    lines.push("Raw list");
    questions.slice(0, 40).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");
  }

  lines.push("Draft (outline)");
  const draftLines = renderDraftPlain(draftText);
  draftLines.slice(0, 200).forEach((l) => lines.push(l));
  lines.push("");

  lines.push("Note");
  lines.push("Drafting support only. Always verify against the original tender document.");

  return lines.join("\n");
}
function classifyRisk(text: string): { label: string; hint: string } {
  const t = String(text ?? "").toLowerCase();

  // Delivery / timeline / resourcing
  if (
    t.includes("timeline") ||
    t.includes("schedule") ||
    t.includes("delivery") ||
    t.includes("lead time") ||
    t.includes("resource") ||
    t.includes("capacity") ||
    t.includes("availability") ||
    t.includes("milestone") ||
    t.includes("slippage")
  ) {
    return { label: "Delivery", hint: "May impact timeline, resourcing, or delivery commitments." };
  }

  // Legal / terms / liability
  if (
    t.includes("liability") ||
    t.includes("indemn") ||
    t.includes("termination") ||
    t.includes("jurisdiction") ||
    t.includes("governing law") ||
    t.includes("penalt") ||
    t.includes("damages") ||
    t.includes("warranty") ||
    t.includes("ip ") ||
    t.includes("intellectual property")
  ) {
    return { label: "Legal", hint: "Contractual terms may create exposure or require negotiation." };
  }

  // Commercial / pricing
  if (
    t.includes("price") ||
    t.includes("pricing") ||
    t.includes("cost") ||
    t.includes("payment") ||
    t.includes("currency") ||
    t.includes("fixed price") ||
    t.includes("rate") ||
    t.includes("margin")
  ) {
    return { label: "Commercial", hint: "May affect pricing, margins, or commercial viability." };
  }

  // Scope / technical feasibility
  if (
    t.includes("scope") ||
    t.includes("specification") ||
    t.includes("technical") ||
    t.includes("integration") ||
    t.includes("interface") ||
    t.includes("compatib") ||
    t.includes("performance") ||
    t.includes("requirement")
  ) {
    return { label: "Scope", hint: "May require capability confirmation or scope clarification." };
  }

  // Submission / compliance process risk
  if (
    t.includes("submission") ||
    t.includes("submit") ||
    t.includes("portal") ||
    t.includes("format") ||
    t.includes("deadline") ||
    t.includes("late") ||
    t.includes("disqual")
  ) {
    return { label: "Submission", hint: "May affect submission compliance (format/deadline/portal)." };
  }

  return { label: "General", hint: "Verify details in the tender source text." };
}


function classifyBlocker(text: string): { label: string; hint: string } {
  const t = String(text ?? "").toLowerCase();

  // Submission / portal / format
  if (
    t.includes("portal") ||
    t.includes("e-tender") ||
    t.includes("etender") ||
    t.includes("upload") ||
    t.includes("submit") ||
    t.includes("submission") ||
    t.includes("format") ||
    t.includes("excel") ||
    t.includes("pdf") ||
    t.includes("label") ||
    t.includes("sequence")
  ) {
    return { label: "Submission", hint: "How you must submit (portal, format, packaging)." };
  }

  // Mandatory documents / forms
  if (
    t.includes("mandatory") ||
    t.includes("must include") ||
    t.includes("include") ||
    t.includes("form of tender") ||
    t.includes("pricing document") ||
    t.includes("method statement") ||
    t.includes("questionnaire") ||
    t.includes("declaration") ||
    t.includes("certificate") ||
    t.includes("evidence") ||
    t.includes("supporting information")
  ) {
    return { label: "Documents", hint: "Mandatory documents/forms you must provide." };
  }

  // Eligibility / compliance / legal
  if (
    t.includes("eligible") ||
    t.includes("eligibility") ||
    t.includes("disqual") ||
    t.includes("non-compliant") ||
    t.includes("unqualified") ||
    t.includes("unconditional") ||
    t.includes("no canvass") ||
    t.includes("anti-corruption") ||
    t.includes("anti-collusion") ||
    t.includes("code of conduct")
  ) {
    return { label: "Compliance", hint: "Rules that can invalidate the tender response." };
  }

  // Commercial / pricing / currency
  if (
    t.includes("price") ||
    t.includes("pricing") ||
    t.includes("gbp") ||
    t.includes("euro") ||
    t.includes("currency") ||
    t.includes("turnover") ||
    t.includes("financial") ||
    t.includes("ratio")
  ) {
    return { label: "Commercial", hint: "Pricing/currency/financial requirements." };
  }


  return { label: "General", hint: "Verify details in the tender source text." };
}

  function buildRationaleDrivers(args: {
  verdict: VerdictState;
  mustItems: string[];
  risksCount: number;
  clarificationsCount: number;
  coverage: "full" | "partial" | "none";
  confidence: "high" | "medium" | "low";
}): string[] {
  const { verdict, mustItems, risksCount, clarificationsCount, coverage, confidence } = args;

  // HOLD: summarize gate categories, not the exact MUST bullets (avoid duplication)
  if (verdict === "hold") {
    const counts = new Map<string, number>();
    for (const t of mustItems ?? []) {
      const k = classifyBlocker(t).label;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3);

    const lines: string[] = [];
    for (const k of top) {
      if (k === "Submission") {
        lines.push("Submission/portal rules are strict. Verify format, language, completeness, and portal steps to avoid disqualification.");
      } else if (k === "Commercial") {
        lines.push("Commercial and pricing constraints must be validated (rates, categories/levels, thresholds) before pricing is submitted.");
      } else if (k === "Documents") {
        lines.push("Mandatory documents and declarations must be completed exactly as requested (forms, pricing sheets, declarations, certificates).");
      } else if (k === "Compliance") {
        lines.push("Eligibility and compliance gates can invalidate the bid. Confirm any disqualification triggers and required attestations.");
      } else {
        lines.push("Mandatory gate-checks require verification in the portal and original tender documents.");
      }
    }

    if (!lines.length) {
      lines.push("Mandatory gate-checks require verification in the portal and original tender documents.");
    }

    // Add one meta driver that is not a repeated MUST item
    if (coverage !== "full") {
      lines.push("Document extraction may be incomplete. Treat this as provisional until the key gate-checks are verified in the original sources.");
    }
    return lines.slice(0, 4);
  }

  // CAUTION / PROCEED: keep it short and operational
  const lines: string[] = [];
  if (verdict === "caution") {
    lines.push("Bid appears feasible, but validate key risks and ambiguities before committing resources.");
    if (risksCount > 0) lines.push(`There ${risksCount === 1 ? "is" : "are"} ${risksCount} risk${risksCount === 1 ? "" : "s"} to review (commercial, delivery, legal, scope).`);
    if (clarificationsCount > 0) lines.push(`${clarificationsCount} buyer clarification${clarificationsCount === 1 ? "" : "s"} may be needed to remove ambiguity before submission.`);
  } else {
    lines.push("No major blockers detected in extracted text. You can start drafting, but confirm portal steps and mandatory forms.");
    lines.push("Confirm the deadline, submission method, and required upload format in the tender portal/PDF before investing heavily.");
  }

  if (confidence === "low" || coverage !== "full") {
    lines.push("Evidence coverage is limited. Verify critical sections in the original documents before relying on this review.");
  }

  return lines.slice(0, 4);
}

const EVIDENCE_STOPWORDS = new Set([
  "the","and","for","with","from","that","this","these","those","shall","must","should","will","may","not","any",
  "into","onto","upon","within","where","when","what","which","who","whom","their","there","here","have","has",
  "been","being","are","is","was","were","a","an","to","of","in","on","at","by","as","or","if","it","its","your"
]);

function normalizeWhitespace(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function excerptAround(haystack: string, index: number, windowSize = 180) {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(haystack.length, index + windowSize);
  const raw = haystack.slice(start, end);
  return normalizeWhitespace(raw);
}

function evidenceExcerptFor(text: string, extractedText: string) {
  const hay = String(extractedText ?? "");
  if (!hay) return "";
  const hayLower = hay.toLowerCase();

  const tokens = normalizeWhitespace(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !EVIDENCE_STOPWORDS.has(w));

  // Try longer tokens first
  tokens.sort((a, b) => b.length - a.length);

  for (const tok of tokens.slice(0, 8)) {
    const idx = hayLower.indexOf(tok);
    if (idx >= 0) return excerptAround(hay, idx);
  }

  return "";
}



type ActionTargetTab = "checklist" | "risks" | "questions" | "draft" | "text";

function classifyNextAction(text: string): { target: ActionTargetTab; label: string; why: string } {
  const t = String(text ?? "").toLowerCase();

  // Clarifications / buyer questions
  if (
    t.includes("clarification") ||
    t.includes("clarifications") ||
    t.includes("question") ||
    t.includes("questions") ||
    t.includes("ask") ||
    t.includes("rfi") ||
    t.includes("buyer")
  ) {
    return {
      target: "questions",
      label: "Clarifications",
      why: "Align unknowns early to avoid rework and reduce bid risk.",
    };
  }

  // Requirements / eligibility / must
  if (
    t.includes("must") ||
    t.includes("mandatory") ||
    t.includes("requirement") ||
    t.includes("requirements") ||
    t.includes("eligib") ||
    t.includes("qualification") ||
    t.includes("compliance") ||
    t.includes("certificate") ||
    t.includes("form")
  ) {
    return {
      target: "checklist",
      label: "Requirements",
      why: "Confirm eligibility and mandatory items before investing in the response.",
    };
  }

  // Risks / legal / security / penalties
  if (
    t.includes("risk") ||
    t.includes("liability") ||
    t.includes("penalt") ||
    t.includes("legal") ||
    t.includes("security") ||
    t.includes("privacy") ||
    t.includes("gdpr") ||
    t.includes("ip ") ||
    t.includes("intellectual property")
  ) {
    return {
      target: "risks",
      label: "Risks",
      why: "Surface exposure and negotiation points early.",
    };
  }

  // Outline / draft
  if (
    t.includes("outline") ||
    t.includes("draft") ||
    t.includes("structure") ||
    t.includes("response plan")
  ) {
    return {
      target: "draft",
      label: "Tender outline",
      why: "Use the outline to estimate effort and assign owners fast.",
    };
  }

  // Deadlines / submission / portal / format -> Source
  if (
    t.includes("deadline") ||
    t.includes("submit") ||
    t.includes("submission") ||
    t.includes("portal") ||
    t.includes("format") ||
    t.includes("appendix")
  ) {
    return {
      target: "text",
      label: "Source",
      why: "Verify submission rules directly in the tender text.",
    };
  }

  return {
    target: "text",
    label: "Source",
    why: "Validate details in the original tender text.",
  };
}

function classifyOwnerAndEta(args: { text: string; target: ActionTargetTab; label: string }) {
  const t = String(args.text ?? "").toLowerCase();

  // Default mapping by target (simple + predictable)
  let owner =
    args.target === "questions"
      ? "Bid Manager"
      : args.target === "checklist"
      ? "Sales Ops"
      : args.target === "risks"
      ? "Legal"
      : args.target === "draft"
      ? "Proposal Lead"
      : "Bid Manager"; // "text" (source) defaults to Bid Manager

  // Keyword overrides (more accurate)
  if (
    t.includes("legal") ||
    t.includes("liability") ||
    t.includes("indemn") ||
    t.includes("contract") ||
    t.includes("jurisdiction") ||
    t.includes("gdpr") ||
    t.includes("data protection") ||
    t.includes("ip ") ||
    t.includes("intellectual property")
  ) {
    owner = "Legal";
  }

  if (
    t.includes("scope") ||
    t.includes("technical") ||
    t.includes("specification") ||
    t.includes("integration") ||
    t.includes("interface") ||
    t.includes("delivery") ||
    t.includes("timeline") ||
    t.includes("schedule") ||
    t.includes("sla")
  ) {
    // Keep Legal override if it was set above
    if (owner !== "Legal") owner = "Engineering";
  }

  if (
    t.includes("certificate") ||
    t.includes("registration") ||
    t.includes("tax") ||
    t.includes("company") ||
    t.includes("mandatory") ||
    t.includes("must") ||
    t.includes("forms") ||
    t.includes("appendix") ||
    t.includes("appendices")
  ) {
    if (owner !== "Legal" && owner !== "Engineering") owner = "Sales Ops";
  }

  // Time estimate (by target, with a couple of keyword nudges)
  let eta =
    args.target === "text"
      ? "2–5 min"
      : args.target === "checklist"
      ? "10–20 min"
      : args.target === "risks"
      ? "10–20 min"
      : args.target === "questions"
      ? "10–30 min"
      : "15–30 min"; // draft

  if (args.target === "text" && (t.includes("submission") || t.includes("deadline") || t.includes("portal") || t.includes("format"))) {
    eta = "2–5 min";
  }

  return { owner, eta };
}

function classifyDoneWhen(args: { text: string; target: ActionTargetTab; label: string }) {
  const t = String(args.text ?? "").toLowerCase();

  // Keep it operational and verifiable (no AI claims).
  if (args.target === "checklist") {
    return "Done when: requirement wording is verified in portal/PDF and any mandatory form/template is identified.";
  }
  if (args.target === "questions") {
    return "Done when: buyer question is drafted and either answered in the tender or queued to send.";
  }
  if (args.target === "risks") {
    return "Done when: risk impact/mitigation is agreed (accept, mitigate, or escalate) and evidence is noted.";
  }
  if (args.target === "draft") {
    return "Done when: outline is reviewed and owners are assigned to each major section.";
  }

  // Source (submission/deadline/format)
  if (t.includes("deadline") || t.includes("submission") || t.includes("submit") || t.includes("portal") || t.includes("format") || t.includes("upload")) {
    return "Done when: submission method, deadline, and required upload format are confirmed in portal/PDF.";
  }

  return "Done when: the clause is located in portal/PDF and confirmed against the authoritative wording.";
}




export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = String((params as any)?.id ?? "").trim();
  const jobId = rawId;


  async function triggerProcessingOnce() {
    try {
      await fetch("/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
    } catch (e) {
      console.warn("Manual trigger failed", e);
    }
  }


  const [invalidLink, setInvalidLink] = useState(false);

  const [job, setJob] = useState<DbJob | null>(null);
	const [result, setResult] = useState<DbJobResult | null>(null);
	const [events, setEvents] = useState<DbJobEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"checklist" | "risks" | "questions" | "draft" | "text" | "work">("checklist");

  // Collaboration layer (does NOT modify job_results; it only overlays assignments/status/notes)
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [workSaving, setWorkSaving] = useState<string | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);

  function openRequirementsForVerification() {
    setTab("checklist");
    // Defer one tick so the tab state + DOM are ready before scrolling
    window.setTimeout(() => {
      tabsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const [displayName, setDisplayNameState] = useState<string>("");
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const [sourceFocus, setSourceFocus] = useState<{ query: string; snippet: string; idx: number | null; highlightStart: number | null; highlightEnd: number | null } | null>(null);

  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus | null>(null);

  /** UI safety state for very large extracted text */
  const [showFullSourceText, setShowFullSourceText] = useState(false);

  const [exporting, setExporting] = useState<null | "summary" | "brief" | "xlsx">(null);

  const [showAllBlockers, setShowAllBlockers] = useState(false);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showUnknownsSection, setShowUnknownsSection] = useState(false);

  const mountedRef = useRef(true);
  const sourceAnchorRef = useRef<HTMLSpanElement | null>(null);
  const tabsTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Strict UUID check
    if (!jobId || jobId === "[id]" || jobId === "%5Bid%5D") {
      setInvalidLink(true);
      setLoading(false);
      return;
    }
    const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId);
    if (!uuidOk) {
      setInvalidLink(true);
      setLoading(false);
      return;
    }
  }, [jobId]);

  // Polling robustness + graceful stop + error pressure guard
  useEffect(() => {
    if (invalidLink) return;

    const supabase = supabaseBrowser();

    const POLL_INTERVAL_MS = 2500;
    const MAX_POLL_MS = 10 * 60 * 1000;
    const DONE_GRACE_POLLS = 12;
    const MAX_POLL_ERRORS = 6;

    let interval: any = null;

    const startedAt = Date.now();
    let pollErrors = 0;
    let doneWithoutResult = 0;

    function stopPolling() {
      if (interval) clearInterval(interval);
      interval = null;
      if (mountedRef.current) setPolling(false);
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: jobRow, error: jobErr } = await supabase.from("jobs").select("*").eq("id", jobId).single();

        if (jobErr) {
          console.error(jobErr);
          setError("This tender review could not be loaded. Please return to your jobs and open it again.");
          setJob(null);
          setResult(null);
          setLoading(false);
          stopPolling();
          return;
        }

        setJob(jobRow as any);

        const stored = getJobDisplayName(jobId) ?? "";
        const initialName = stored || String((jobRow as any)?.file_name ?? "").trim();
        setDisplayNameState(initialName);
        setRenameInput(initialName);

      const { data: resultRow, error: resErr } = await supabase
		  .from("job_results")
		  .select("*")
		  .eq("job_id", jobId)
		  .maybeSingle();

		if (resErr) {
		  console.warn(resErr);
		}

		setResult((resultRow as any) ?? null);

		// Read-only: fetch job events for trust + failure explanations
		const { data: eventRows, error: evErr } = await supabase
		  .from("job_events")
		  .select("*")
		  .eq("job_id", jobId)
		  .order("created_at", { ascending: false })
		  .limit(50);

		if (evErr) {
		  console.warn(evErr);
		} else {
		  setEvents((eventRows as any) ?? []);
		}


        setLoading(false);

        const status = String((jobRow as any)?.status ?? "queued") as JobStatus;
        setPolling(status === "queued" || status === "processing" || (status === "done" && !resultRow));
      } catch (e) {
        console.error(e);
        setError("This tender review could not be loaded. Please refresh and try again.");
        setJob(null);
        setResult(null);
        setLoading(false);
        stopPolling();
      }
    }

    async function poll() {
      try {
        const { data: jobRow, error: jobErr } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
        if (!mountedRef.current) return;

        if (jobErr) {
          pollErrors += 1;
          console.warn(jobErr);
        }

        if (jobRow) setJob(jobRow as any);

        const status = String((jobRow as any)?.status ?? "queued") as JobStatus;
        const isTerminal = status === "done" || status === "failed";

  

        const { data: resultRow, error: resErr } = await supabase
          .from("job_results")
          .select("*")
          .eq("job_id", jobId)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (resErr) {
          pollErrors += 1;
          console.warn(resErr);
        } else {
          pollErrors = Math.max(0, pollErrors - 1);
        }

        setResult((resultRow as any) ?? null);
		// Fetch events when terminal or when failed (keeps polling light but accurate)
		if (isTerminal || jobRow?.status === "failed") {
		  const { data: eventRows, error: evErr } = await supabase
			.from("job_events")
			.select("*")
			.eq("job_id", jobId)
			.order("created_at", { ascending: false })
			.limit(50);

		  if (!evErr) setEvents((eventRows as any) ?? []);
		}

		// Hard stop only applies while still processing AND results are still missing.
		// Prevents false “taking longer” errors when the tender is already done.
		if (!isTerminal && !resultRow && Date.now() - startedAt > MAX_POLL_MS) {
		  setError("This tender review is taking longer than expected. Please refresh the page or check again later.");
		  stopPolling();
		  return;
		}

		// If results are present, clear only the “taking longer” message (if it was shown earlier).
		if (resultRow) {
		  setError((prev) =>
			prev?.includes("taking longer than expected") ? null : prev
		  );
		}

		
        if (isTerminal) {
          if (status === "failed") {
            stopPolling();
            return;
          }

          if (resultRow) {
            stopPolling();
            return;
          }

          doneWithoutResult += 1;
          if (doneWithoutResult >= DONE_GRACE_POLLS) {
            setError(
              "The job completed, but the results are not available yet. Please refresh the page in a moment or re-open the job from your jobs list."
            );
            stopPolling();
            return;
          }
        } else {
          doneWithoutResult = 0;
        }

        if (pollErrors >= MAX_POLL_ERRORS) {
          setError("We are having trouble loading this tender review. Please refresh the page and try again.");
          stopPolling();
          return;
        }

        setPolling(status === "queued" || status === "processing" || (status === "done" && !resultRow));
      } catch (e) {
        console.error(e);
        pollErrors += 1;
        if (pollErrors >= MAX_POLL_ERRORS) {
          setError("We are having trouble loading this tender review. Please refresh the page and try again.");
          stopPolling();
          return;
        }
      }
    }

    load();

    function shouldPoll() {
      return typeof document === "undefined" ? true : document.visibilityState === "visible";
    }

    async function pollVisible() {
      if (!shouldPoll()) return;
      await poll();
    }

    interval = setInterval(pollVisible, POLL_INTERVAL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        poll();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [jobId, invalidLink]);

  // Load collaboration overlay (work items)
  useEffect(() => {
    if (invalidLink) return;
    const supabase = supabaseBrowser();
    let cancelled = false;

    async function loadWork() {
      setWorkError(null);
      const { data, error } = await supabase
        .from("job_work_items")
        .select("*")
        .eq("job_id", jobId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn("Failed to load work items", error);
        setWorkError("Work items could not be loaded.");
        setWorkItems([]);
        return;
      }
      setWorkItems((data as any[]) ?? []);
    }

    loadWork();
    return () => {
      cancelled = true;
    };
  }, [jobId, invalidLink]);

  const showProgress = useMemo(() => {
    const s = job?.status;
    return s === "queued" || s === "processing";
  }, [job]);

  const showReady = useMemo(() => job?.status === "done", [job]);
  const showFailed = useMemo(() => job?.status === "failed", [job]);

  const canDownload = useMemo(() => Boolean(job && job.status === "done"), [job]);
  const canDelete = Boolean(job) && !showProgress;

  const extractedText = useMemo(() => String(result?.extracted_text ?? "").trim(), [result]);

  const pipelineEvidenceCandidates: EvidenceCandidateUi[] = useMemo(() => {
    const c = (job as any)?.pipeline?.evidence?.candidates;
    return Array.isArray(c) ? (c as EvidenceCandidateUi[]) : [];
  }, [job]);

  const evidenceById = useMemo(() => {
    const map = new Map<string, EvidenceCandidateUi>();
    for (const e of pipelineEvidenceCandidates) {
      const id = String((e as any)?.id ?? "").trim();
      if (!id) continue;
      map.set(id, e);
    }
    return map;
  }, [pipelineEvidenceCandidates]);

  const checklist = useMemo(() => normalizeChecklist(result?.checklist), [result]);
  const risks = useMemo(() => normalizeRisks(result?.risks), [result]);
	const extractedChars = extractedText.length;

	const eventMessages = useMemo(() => new Set((events ?? []).map((e) => e.message)), [events]);

	const hasTruncationWarning = useMemo(
	  () => eventMessages.has("Source text truncated for AI"),
	  [eventMessages]
	);

	const hasEmptyExtractWarning = useMemo(
	  () => eventMessages.has("Unstructured extract returned empty text"),
	  [eventMessages]
	);

	const hasCostCapFailure = useMemo(
	  () => eventMessages.has("Job exceeds cost cap, reduce input or limits"),
	  [eventMessages]
	);

	type CoverageState = "full" | "partial" | "unreliable";
	type ConfidenceState = "high" | "medium" | "low";

	const coverage: CoverageState = useMemo(() => {
	  const status = job?.status;

	  if (status === "failed") return "unreliable";
	  if (!extractedText || hasEmptyExtractWarning) return "unreliable";
	  if (hasTruncationWarning) return "partial";
	  if (extractedChars < 3000) return "partial";
	  return "full";
	}, [job?.status, extractedText, hasEmptyExtractWarning, hasTruncationWarning, extractedChars]);

		// Downstream summaries/exports accept only none/partial/full.
		// Normalize "unreliable" to "partial" so the UI can still warn while types remain compatible.
		const coverageNormalized: "none" | "partial" | "full" =
		  coverage === "unreliable" ? "partial" : coverage;

	const confidence: ConfidenceState = useMemo(() => {
	  if (coverage !== "full") return "low";

	  const rawDeadline = (result as any)?.executive_summary?.submissionDeadline;
	const missingDeadline = !String(rawDeadline ?? "").trim();
	  const qList = normalizeQuestions((result as any)?.clarifications);
		const manyQuestions = qList.length >= 6;

		// Avoid referencing mustItems before its declaration: derive blockers from checklist directly
	const ckItems = normalizeChecklist((result as any)?.checklist);
	const blockerCount = ckItems.filter((i: any) =>
	  String(i?.type ?? i?.level ?? i?.priority ?? "")
		.toUpperCase()
		.includes("MUST")
	).length;
	const hasBlockers = blockerCount > 0;



	  if (missingDeadline || manyQuestions || hasBlockers) return "medium";
	  return "high";
			}, [
		  coverage,
		  (result as any)?.executive_summary?.submissionDeadline,
		  (result as any)?.clarifications,
		  (result as any)?.checklist,
		]);


	const warningChips = useMemo(() => {
	  const chips: Array<{ label: string; detail?: string }> = [];

	  if (hasTruncationWarning) {
		const e = events.find((x) => x.message === "Source text truncated for AI");
		const maxChars = e?.meta?.maxChars;
		chips.push({ label: "Input truncated", detail: maxChars ? `Max chars: ${maxChars}` : undefined });
	  }

	  if (hasEmptyExtractWarning) chips.push({ label: "No text extracted" });
	  if (hasCostCapFailure) chips.push({ label: "Cost cap exceeded" });

	  // Keep it minimal
	  return chips.slice(0, 3);
	}, [events, hasTruncationWarning, hasEmptyExtractWarning, hasCostCapFailure]);

  // IMPORTANT: questions come from proposal_draft.buyer_questions (DB contract)
	 const questions = useMemo(() => {
	  return normalizeQuestions((result as any)?.clarifications);
	}, [result]);

  const outlineSections = useMemo(() => {
    const d: any = (result as any)?.proposal_draft;
    if (d && typeof d === "object" && Array.isArray(d.sections)) {
      return (d.sections as any[])
        .map((s) => ({
          title: String(s?.title ?? "").trim(),
          bullets: Array.isArray(s?.bullets) ? (s.bullets as any[]).map((b) => String(b ?? "").trim()).filter(Boolean) : [],
        }))
        .filter((s) => s.title);
    }
    return [] as Array<{ title: string; bullets: string[] }>;
  }, [result]);

  const workBaseRows = useMemo(() => {
    const rows: Array<{ type: "requirement" | "risk" | "clarification" | "outline"; ref_key: string; title: string; meta?: string }>=[];

    for (const it of checklist ?? []) {
      const kind = String((it as any)?.type ?? (it as any)?.level ?? (it as any)?.priority ?? "INFO").toUpperCase();
      const text = String((it as any)?.text ?? (it as any)?.requirement ?? "").trim();
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "requirement", text, extra: kind });
      rows.push({ type: "requirement", ref_key: ref, title: text, meta: kind });
    }

    for (const r of risks ?? []) {
      const title = String((r as any)?.title ?? (r as any)?.text ?? (r as any)?.risk ?? "").trim();
      const detail = String((r as any)?.detail ?? (r as any)?.description ?? (r as any)?.why ?? (r as any)?.impact ?? "").trim();
      const sev = String((r as any)?.severity ?? (r as any)?.level ?? "medium").toLowerCase();
      const text = title || detail;
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "risk", text, extra: sev });
      rows.push({ type: "risk", ref_key: ref, title: title || detail, meta: sev });
    }

    for (const q of questions ?? []) {
      const text = String(q ?? "").trim();
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "clarification", text });
      rows.push({ type: "clarification", ref_key: ref, title: text });
    }

    for (const s of outlineSections ?? []) {
      const ref = stableRefKey({ jobId, type: "outline", text: s.title });
      rows.push({ type: "outline", ref_key: ref, title: s.title });
    }

    return rows;
  }, [jobId, checklist, risks, questions, outlineSections]);

  const workByKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const w of workItems ?? []) {
      const k = `${String(w?.type ?? "")}:${String(w?.ref_key ?? "")}`;
      if (k.includes(":")) m.set(k, w);
    }
    return m;
  }, [workItems]);

  async function upsertWorkItem(input: {
    type: "requirement" | "risk" | "clarification" | "outline";
    ref_key: string;
    title: string;
    status?: string;
    owner_label?: string;
    due_at?: string | null;
    notes?: string;
  }) {
    setWorkError(null);
    setWorkSaving(`${input.type}:${input.ref_key}`);

    try {
      const supabase = supabaseBrowser();
      const payload: any = {
        job_id: jobId,
        type: input.type,
        ref_key: input.ref_key,
        title: input.title,
        status: input.status ?? "todo",
        owner_label: input.owner_label ?? null,
        due_at: input.due_at ? input.due_at : null,
        notes: input.notes ?? null,
      };

      const { error } = await supabase
        .from("job_work_items")
        .upsert(payload, { onConflict: "job_id,type,ref_key" });
      if (error) throw error;

      // refresh
      const { data, error: loadErr } = await supabase
        .from("job_work_items")
        .select("*")
        .eq("job_id", jobId)
        .order("updated_at", { ascending: false });

      if (loadErr) throw loadErr;
      setWorkItems((data as any[]) ?? []);
    } catch (e) {
      console.error(e);
      setWorkError("Could not save changes.");
    } finally {
      setWorkSaving(null);
    }
  }


  const mustItems = useMemo(() => {
    return checklist
      .filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"))
      .map((x) => String(x?.text ?? x?.requirement ?? "").trim())
      .filter(Boolean);
  }, [checklist]);

  // Evidence map (MUST text -> verbatim source excerpt).
  // This enables "100% precision": we only highlight when we can locate the exact excerpt in Source text.
  // If no verbatim excerpt exists, we must NOT highlight a different clause.
  const mustEvidenceByText = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of checklist ?? []) {
      const isMust = String(item?.type ?? item?.level ?? item?.priority ?? "").toUpperCase().includes("MUST");
      if (!isMust) continue;
      const text = String((item as any)?.text ?? (item as any)?.requirement ?? "").trim();
      const src = String((item as any)?.source ?? "").trim();
      if (!text || !src) continue;
      if (/^not found in extracted text\.?$/i.test(src)) continue;
      // Keep it as-is (verbatim). UI matching relies on exact substring presence.
      map.set(text, src);
    }
    return map;
  }, [checklist]);

  const mustEvidenceIdsByText = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of checklist ?? []) {
      const isMust = String(item?.type ?? item?.level ?? item?.priority ?? "").toUpperCase().includes("MUST");
      if (!isMust) continue;
      const text = String((item as any)?.text ?? (item as any)?.requirement ?? "").trim();
      const idsRaw = (item as any)?.evidence_ids ?? (item as any)?.evidenceIds ?? (item as any)?.evidence ?? null;
      const ids = Array.isArray(idsRaw) ? idsRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
      if (!text || !ids.length) continue;
      map.set(text, ids);
    }
    return map;
  }, [checklist]);

  const knownEvidenceIds = useMemo(() => Array.from(evidenceById.keys()), [evidenceById]);

  const evidenceCoverage = useMemo(() => {
    const items = Array.isArray(checklist) ? checklist : [];
    const idSet = new Set(knownEvidenceIds);

    let mustTotal = 0;
    let mustCovered = 0;
    let overallTotal = 0;
    let overallCovered = 0;

    for (const it of items) {
      const typeRaw = String((it as any)?.type ?? (it as any)?.level ?? (it as any)?.priority ?? "");
      const isMust = typeRaw.toUpperCase().includes("MUST");
      const idsRaw = (it as any)?.evidence_ids ?? (it as any)?.evidenceIds ?? (it as any)?.evidence ?? null;
      const ids = Array.isArray(idsRaw) ? idsRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
      const resolved = ids.some((id: string) => idSet.has(id));

      overallTotal += 1;
      if (resolved) overallCovered += 1;

      if (isMust) {
        mustTotal += 1;
        if (resolved) mustCovered += 1;
      }
    }

    return { mustTotal, mustCovered, overallTotal, overallCovered };
  }, [checklist, knownEvidenceIds]);

function showEvidenceByIds(evidenceIds: string[] | undefined, fallbackQuery: string) {
  const ids = Array.isArray(evidenceIds) ? evidenceIds.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  const primary = ids.find((id) => evidenceById.has(id)) || ids[0] || "";
  const candidate = primary ? evidenceById.get(primary) : null;

  if (candidate) {
    const excerpt = String(candidate.excerpt ?? "").trim();

    setEvidenceFocus({
      id: String(candidate.id),
      excerpt,
      page: (candidate as any).page ?? null,
      anchor: (candidate as any).anchor ?? null,
      note: null,
      allIds: ids.length ? ids : null,
    });

    // Evidence-first UX:
    // Open Source text AND immediately jump/highlight using the candidate excerpt (deterministic).
    openTabAndScroll("text");

    if (excerpt) {
      // Defer one tick so the tab state + DOM are ready before scrolling
      window.setTimeout(() => onJumpToSource(excerpt), 0);
    }

    return;
  }

  if (primary) {
    setEvidenceFocus({
      id: primary,
      excerpt: "",
      page: null,
      anchor: null,
      note: "Evidence id not found in the pipeline evidence map. This can happen if the pipeline evidence was generated with a different version or was trimmed. Verify in the original PDF.",
      allIds: ids.length ? ids : null,
    });
  } else {
    setEvidenceFocus({
      id: "",
      excerpt: "",
      page: null,
      anchor: null,
      note: "No evidence id available for this item. Use Source text search and verify in the original PDF.",
      allIds: null,
    });
  }

  // No candidate excerpt to jump to → still open Source text so the user can search manually.
  openTabAndScroll("text");
}




	

  // Lightweight evidence snippets for top blockers (UI-only)
  const blockerEvidence = useMemo(() => {
    const map = new Map<string, string>();

    // Prefer the stored, verbatim evidence from the checklist (100% rule).
    // Fall back to the older heuristic only if there is no stored evidence at all.
    (mustItems ?? []).slice(0, 2).forEach((t) => {
      const fromModel = mustEvidenceByText.get(String(t));
      if (fromModel) {
        map.set(String(t), fromModel);
        return;
      }

      if (!extractedText) return;
      const ex = evidenceExcerptFor(String(t), extractedText);
      if (ex) map.set(String(t), ex);
    });

    return map;
  }, [extractedText, mustItems, mustEvidenceByText]);
const executive = useMemo(() => {
	  const raw = (result as any)?.executive_summary ?? {};
	  return toExecutiveModel({ raw });
	}, [result]);


	const draftForUi = useMemo(() => {
	  return (result as any)?.proposal_draft ?? null;
	}, [result]);


  const draftLinesForUi = useMemo(() => renderDraftPlain(draftForUi), [draftForUi]);

  const hasDraftForUi = useMemo(() => {
    if (!draftLinesForUi.length) return false;
    if (draftLinesForUi.length === 1 && draftLinesForUi[0].toLowerCase().includes("not available")) return false;
    return true;
  }, [draftLinesForUi]);

  const nextActionsForUi = useMemo(() => {
  const deadlineText = String(executive?.submissionDeadline ?? "").trim();
  const deadlineDetected = Boolean(deadlineText);

  // UI-only "due moment" mapping (deterministic; no new data)
  function parseDeadlineToDateLocal(input: string): Date | null {
    const s = String(input ?? "").trim();
    if (!s) return null;

    // Common format seen in the UI: "15:00 28/05/2014"
    const m = s.match(/(\d{1,2}:\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const [hh, mm] = m[1].split(":").map((x) => parseInt(x, 10));
      const dd = parseInt(m[2], 10);
      const mo = parseInt(m[3], 10) - 1;
      const yyyy = parseInt(m[4], 10);
      const d = new Date(yyyy, mo, dd, hh, mm, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d2 = new Date(s);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  const deadlineDate = deadlineDetected ? parseDeadlineToDateLocal(deadlineText) : null;

  function isCommercialAction(actionText: string) {
    const t = String(actionText ?? "").toLowerCase();
    return (
      t.includes("price") ||
      t.includes("pricing") ||
      t.includes("cost") ||
      t.includes("budget") ||
      t.includes("payment") ||
      t.includes("invoice") ||
      t.includes("commercial")
    );
  }

  function dueMomentForAction(args: { actionText: string; label: string; target: ActionTargetTab }): string {
    const { actionText } = args;

    const hasDeadline = Boolean(deadlineDate);
    if (hasDeadline) {
      const now = new Date();
      const diffMs = (deadlineDate as Date).getTime() - now.getTime();
      const diffMin = Math.round(diffMs / 60000);

      // When we're within 24h, everything is effectively "today" for bid desk execution.
      if (diffMin > 0 && diffMin <= 24 * 60) return "Due: Today";
      // If already passed, still show the most actionable label.
      if (diffMin <= 0) return "Due: Today";
    }

    if (isCommercialAction(actionText)) return "Due: Before pricing sign-off";
    return "Due: Before submission";
  }

  const firstMust = mustItems[0] ?? "";
  const firstQuestion = questions[0] ?? "";
  const firstRisk = executive?.topRisks?.[0]?.title
    ? `${executive.topRisks[0].title}${executive.topRisks[0].detail ? ` — ${executive.topRisks[0].detail}` : ""}`
    : "";
  const firstDraftLine = draftLinesForUi[0] ?? "";

  function isSubmissionOrDeadlineAction(actionText: string) {
    const t = String(actionText ?? "").toLowerCase();
    return (
      t.includes("deadline") ||
      t.includes("due date") ||
      t.includes("submission") ||
      t.includes("submit") ||
      t.includes("delivered") ||
      t.includes("delivery") ||
      t.includes("portal") ||
      t.includes("format") ||
      t.includes("physic") || // physical/physically
      t.includes("electronic") ||
      t.includes("late")
    );
  }

  function compactForQuery(input: string, maxLen = 220) {
    const s = String(input ?? "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
  }

  // Chips must be truthful (no "Deadline detected" on generic actions)
  function metricForAction(target: ActionTargetTab, actionText: string): string {
    if (target === "checklist") return `${mustItems.length} MUST`;
    if (target === "risks") return `${risks.length} risks`;
    if (target === "questions") return `${questions.length} questions`;
    if (target === "draft") return hasDraftForUi ? "Outline available" : "Outline not detected";

    // Source
    if (deadlineDetected && isSubmissionOrDeadlineAction(actionText)) return "Deadline detected";
    return "Source";
  }

  // Evidence query: anchor it to something that exists, keep it short
  function evidenceForAction(target: ActionTargetTab, actionText: string) {
    if (target === "checklist" && firstMust) return compactForQuery(firstMust, 240);
    if (target === "questions" && firstQuestion) return compactForQuery(firstQuestion, 240);
    if (target === "risks" && firstRisk) return compactForQuery(firstRisk, 240);
    if (target === "draft" && firstDraftLine) return compactForQuery(firstDraftLine, 240);

    // Source: only use deadline line if the action is actually about submission/deadline
    if (target === "text" && deadlineDetected && isSubmissionOrDeadlineAction(actionText)) {
      return compactForQuery(deadlineText, 240);
    }

    return compactForQuery(actionText, 240);
  }

  // One-line evidence preview if we can find a match
  function evidencePreviewForQuery(query: string) {
    if (!extractedText) return "";
    const match = findExcerpt(extractedText, query);
    if (!match?.snippet) return "";
    return compactForQuery(match.snippet, 140);
  }

  if (executive?.nextActions?.length) {
    return executive.nextActions.slice(0, 3).map((actionText: string) => {
      const cls = classifyNextAction(actionText);
      const evidenceQuery = evidenceForAction(cls.target, actionText);
      const evidencePreview = evidencePreviewForQuery(evidenceQuery);

      const meta = classifyOwnerAndEta({ text: actionText, target: cls.target, label: cls.label });
      const doneWhen = classifyDoneWhen({ text: actionText, target: cls.target, label: cls.label });

		return {
		  text: actionText,
		  target: cls.target,
		  label: cls.label,
		  why: cls.why,
		  metric: metricForAction(cls.target, actionText),
		  evidenceQuery,
		  evidencePreview,
		  owner: meta.owner,
		  eta: meta.eta,
          doneWhen,
          dueMoment: dueMomentForAction({ actionText, label: cls.label, target: cls.target }),
		};
    });
  }

    const out: Array<{
		text: string;
		target: ActionTargetTab;
		label: string;
		why: string;
		metric: string;
		evidenceQuery: string;
		evidencePreview?: string;
		owner: string;
		eta: string;
		doneWhen?: string;
		dueMoment?: string;
	  }> = [];


  // Fallback action 1
  if (mustItems.length) {
    const text = "Verify potential blockers (MUST requirements)";
    const evidenceQuery = evidenceForAction("checklist", text);
	const meta = classifyOwnerAndEta({ text, target: "checklist", label: "Compliance" });
    const doneWhen = classifyDoneWhen({ text, target: "checklist", label: "Compliance" });
    out.push({
      text,
      target: "checklist",
      label: "Requirements",
      why: "Confirm eligibility and mandatory items before investing in the response.",
      metric: metricForAction("checklist", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
	  owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Requirements", target: "checklist" }),

    });
  } else if (executive?.topRisks?.length) {
    const text = "Validate the top risks and mitigations";
    const evidenceQuery = evidenceForAction("risks", text);
    const meta = classifyOwnerAndEta({ text, target: "risks", label: "Risks" });
    const doneWhen = classifyDoneWhen({ text, target: "risks", label: "Risks" });

    out.push({
      text,
      target: "risks",
      label: "Risks",
      why: "Surface exposure and negotiation points early.",
      metric: metricForAction("risks", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Risks", target: "risks" }),
    });

  } else {
    const text = "Confirm mandatory submission requirements";
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: "Source" });
    const doneWhen = classifyDoneWhen({ text, target: "text", label: "Source" });

    out.push({
      text,
      target: "text",
      label: "Source",
      why: "Verify submission rules directly in the tender text.",
      metric: metricForAction("text", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Source", target: "text" }),
    });
  }

  // Fallback action 2
  {
    const text = "Confirm deadline and submission method";
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: "Source" });
    const doneWhen = classifyDoneWhen({ text, target: "text", label: "Source" });

    out.push({
      text,
      target: "text",
      label: "Source",
      why: "Avoid last-minute surprises with portal, format, and deadlines.",
      metric: metricForAction("text", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Source", target: "text" }),
    });

  }

  // Fallback action 3
  if (questions.length) {
    const text = "Draft clarifications to the buyer";
    const evidenceQuery = evidenceForAction("questions", text);
    const meta = classifyOwnerAndEta({ text, target: "questions", label: "Clarifications" });
    const doneWhen = classifyDoneWhen({ text, target: "questions", label: "Clarifications" });

    out.push({
      text,
      target: "questions",
      label: "Clarifications",
      why: "Align unknowns early to avoid rework and reduce bid risk.",
      metric: metricForAction("questions", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Clarifications", target: "questions" }),
    });

  } else if (hasDraftForUi) {
    const text = "Review the tender outline and estimate effort";
    const evidenceQuery = evidenceForAction("draft", text);
    const meta = classifyOwnerAndEta({ text, target: "draft", label: "Tender outline" });
    const doneWhen = classifyDoneWhen({ text, target: "draft", label: "Tender outline" });

    out.push({
      text,
      target: "draft",
      label: "Tender outline",
      why: "Use the outline to estimate effort and assign owners fast.",
      metric: metricForAction("draft", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Tender outline", target: "draft" }),
    });

    } else {
    const text = "Scan the tender for mandatory forms and formatting";
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: "Source" });
    const doneWhen = classifyDoneWhen({ text, target: "text", label: "Source" });

    out.push({
      text,
      target: "text",
      label: "Source",
      why: "Catch hidden submission rules that can invalidate the response.",
      metric: metricForAction("text", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: "Source", target: "text" }),
    });

  }

  return out.slice(0, 3);
}, [
  executive,
  mustItems,
  risks.length,
  questions.length,
  hasDraftForUi,
  draftLinesForUi,
  extractedText,
]);



	const clarificationsPack = useMemo(() => {
	  const tenderName = String(displayName || job?.file_name || "Tender").trim();
	  return buildReadyToSendClarifications({ tenderName, questions });
	}, [displayName, job?.file_name, questions]);
	 

 const hasAnyResultsPayload = useMemo(() => {
    return Boolean(extractedText || checklist.length || risks.length || questions.length || hasDraftForUi);
  }, [extractedText, checklist.length, risks.length, questions.length, hasDraftForUi]);

  const finalizingResults = useMemo(() => showReady && !hasAnyResultsPayload, [showReady, hasAnyResultsPayload]);

  // Verdict (UI-only heuristic; no backend changes)
  const verdictState: VerdictState = useMemo(() => {
    if (!showReady) return "caution";
    if (mustItems.length >= 1) return "hold";
    const top = (executive.topRisks ?? []).slice(0, 3);
    if (top.some((r: any) => String(r?.severity ?? "").toLowerCase() === "high")) return "caution";
    return "proceed";
  }, [showReady, mustItems.length, executive.topRisks]);

  const topRisksForPanel = useMemo(() => (executive.topRisks ?? []).slice(0, 3), [executive.topRisks]);

  const rationaleDrivers = useMemo(
    () =>
      buildRationaleDrivers({
        verdict: verdictState,
        mustItems,
        risksCount: risks.length,
        clarificationsCount: questions.length,
		  coverage: coverageNormalized,
        confidence,
      }),
	  [verdictState, mustItems, risks.length, questions.length, coverageNormalized, confidence]
  );


	  // --- Go/No-Go pills: consistent tones (no new badges) ---
	const pillBase =
	  "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition hover:shadow-sm hover:-translate-y-[1px] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

	const countBase =
	  "inline-flex h-5 min-w-[24px] items-center justify-center rounded-full border bg-background px-2 text-[11px] font-semibold";

	type PillKind = "blockers" | "risks" | "questions" | "outline";

	function pillTone(kind: PillKind) {
	  const blockers = mustItems.length;
	  const r = risks.length;
	  const q = questions.length;
	  const outlineOk = hasDraftForUi;

	  const isHold = verdictState === "hold";
	  const isCaution = verdictState === "caution";

	  const neutral =
		"border-muted/60 bg-muted/20 text-muted-foreground hover:bg-background hover:text-foreground";
	  const critical =
		"border-red-200 bg-background text-red-800 hover:border-red-300 hover:bg-red-50/40";
	  const warn =
		"border-amber-200 bg-background text-amber-900 hover:border-amber-300 hover:bg-amber-50/40";
	  const info =
		"border-sky-200 bg-background text-sky-900 hover:border-sky-300 hover:bg-sky-50/40";

	  if (kind === "blockers") {
		// If HOLD, keep border red even on hover (no “second red fill” needed)
		if (isHold) return critical;
		if (blockers > 0) return warn;
		return neutral;
	  }

	  if (kind === "risks") {
		if (isCaution) return warn;
		if (r >= 3) return warn;
		if (r > 0) return "border-amber-200/60 bg-background text-amber-900 hover:border-amber-300 hover:bg-amber-50/30";
		return neutral;
	  }

	  if (kind === "questions") {
		if (q >= 5) return info;
		if (q > 0) return "border-sky-200/60 bg-background text-sky-900 hover:border-sky-300 hover:bg-sky-50/30";
		return neutral;
	  }

	  if (kind === "outline") {
		if (!outlineOk) return warn;
		return neutral;
	  }

	  return neutral;
	}

	function countTone(kind: PillKind) {
	  const blockers = mustItems.length;
	  const r = risks.length;
	  const q = questions.length;
	  const outlineOk = hasDraftForUi;

	  const isHold = verdictState === "hold";
	  const isCaution = verdictState === "caution";

	  const neutral = "border-muted/60 text-foreground";
	  const critical = "border-red-200 text-red-800";
	  const warn = "border-amber-200 text-amber-900";
	  const info = "border-sky-200 text-sky-900";

	  if (kind === "blockers") {
		if (isHold) return critical;
		if (blockers > 0) return warn;
		return neutral;
	  }

	  if (kind === "risks") {
		if (isCaution) return warn;
		if (r > 0) return warn;
		return neutral;
	  }

	  if (kind === "questions") {
		if (q > 0) return info;
		return neutral;
	  }

	  if (kind === "outline") {
		if (!outlineOk) return warn;
		return neutral;
	  }

	  return neutral;
	}
		
  const verdictDriverLine = useMemo(() => {
    if (!showReady) return "Preparing decision drivers.";
    if (verdictState === "hold") {
      return "Decision drivers: MUST compliance gates and submission rules that can invalidate the bid.";
    }
    if (verdictState === "caution") {
      return "Decision drivers: risks requiring validation before committing.";
    }
    return "No mandatory blockers identified from eligibility and submission requirements.";
  }, [showReady, verdictState]);

  async function copySection(which: "requirements" | "risks" | "clarifications" | "draft") {
    if (!canDownload) return;

    let text = "";
    if (which === "requirements") text = mustItems.join("\n");
    if (which === "risks") text = risks.map((r) => pickText(r)).filter(Boolean).join("\n");
    if (which === "clarifications") text = questions.join("\n");
    if (which === "draft") text = renderDraftPlain(draftForUi).join("\n");

    const ok = await safeCopy(text);
    if (ok) {
      setCopiedSection(which);
      window.setTimeout(() => setCopiedSection(null), 1200);
    }
  }

  async function handleRenameSave() {
    const newName = String(renameInput ?? "").trim();
    if (!job) return;

    if (!newName) {
      clearJobDisplayName(jobId);
      setDisplayNameState(String(job.file_name ?? "").trim());
      window.dispatchEvent(new CustomEvent("tp_job_rename", { detail: { jobId, name: "" } }));
      setRenaming(false);
      return;
    }

    setJobDisplayName(jobId, newName);
    setDisplayNameState(newName);
    window.dispatchEvent(new CustomEvent("tp_job_rename", { detail: { jobId, name: newName } }));
    setRenaming(false);
  }

  function openTabAndScroll(next: "checklist" | "risks" | "questions" | "draft" | "text") {
  setTab(next);
  requestAnimationFrame(() => {
    tabsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}



  function jumpToPageMarker(page: number, reason?: string) {
    const full = String(extractedText ?? "");
    const marker = `[PAGE ${page}]`;
    const idx = full.indexOf(marker);

    if (idx < 0) {
      setSourceFocus({
        query: `Page ${page}`,
        snippet:
          reason ||
          `Exact clause not found. Page marker ${marker} was not found in extracted text. Verify in the original PDF.`,
        idx: null,
        highlightStart: null,
        highlightEnd: null,
      });
      openTabAndScroll("text");
      return;
    }

    if (idx > SOURCE_TEXT_PREVIEW_LIMIT) setShowFullSourceText(true);

    setSourceFocus({
      query: `Page ${page}`,
      snippet:
        reason ||
        `Exact clause not found in extracted text. Jumped to ${marker} as a reliable anchor. Verify the clause in the original PDF.`,
      idx,
      highlightStart: idx,
      highlightEnd: idx + marker.length,
    });

    openTabAndScroll("text");
  }


  function onJumpToSource(query: string) {
    // 100% precision rule:
    // - If the caller passes an evidence payload (verbatim excerpt or SECTION_REF), we use it directly.
    // - We NEVER "guess" or reuse a previous match (that causes wrong highlights).
    const rawQuery = String(query ?? "").trim();

    const looksLikeEvidencePayload =
      rawQuery.includes("\n") ||
      rawQuery.includes("|") ||
      /^SECTION_REF\s*:/i.test(rawQuery) ||
      rawQuery.length > 220;

    // Only try MUST evidence override when the caller passed the human-visible item text (not the evidence itself).
    const evidenceOverride = !looksLikeEvidencePayload
      ? mustEvidenceByText.get(rawQuery)
      : null;

    const effectiveQuery = evidenceOverride || rawQuery;
    const displayQuery = /^SECTION_REF\s*:/i.test(String(effectiveQuery))
      ? String(effectiveQuery).replace(/^SECTION_REF\s*:/i, "").trim()
      : effectiveQuery;


    // If we have a verbatim excerpt from the model but it is NOT present in the extracted text,
    // we must NOT fall back to fuzzy matching (that is how wrong highlights happen).
    if (evidenceOverride) {
      const hay = String(extractedText ?? "").toLowerCase();
      const rawEvidence = String(evidenceOverride).trim();
      const needleText = /^SECTION_REF\s*:/i.test(rawEvidence)
        ? rawEvidence.replace(/^SECTION_REF\s*:/i, "").trim()
        : rawEvidence;
      const needle = needleText.toLowerCase();
      const hasNeedle = needle ? hay.includes(needle) : false;
      const hasAnchorLine = rawEvidence
        .split("\n")
        .some((l) => /^SECTION_REF\s*:|^SECTION\b|^ANNEX\b|^\[PAGE\b/i.test(l.trim()));
      if (!hasNeedle && !hasAnchorLine) {
        setSourceFocus({
          query: displayQuery,
          snippet:
            "No exact supporting clause found for this item in the extracted text. Verify in the original PDF / tender portal.",
          idx: null,
          highlightStart: null,
          highlightEnd: null,
        });
        openTabAndScroll("text");
        return;
      }
    }

    const match = findExcerpt(extractedText, effectiveQuery);

    if (!match) {
      // Never highlight the wrong clause. If we can't find an exact match, show an explicit message.
      const msg = evidenceOverride
        ? "No exact supporting clause found for this item in the extracted text. Verify in the original PDF / tender portal."
        : "Exact match not found in extracted text (OCR/layout differences are common). Use the evidence snippet above and search the phrase in the original PDF.";
      setSourceFocus({ query: displayQuery, snippet: msg, idx: null, highlightStart: null, highlightEnd: null });
      openTabAndScroll("text");
      return;
    }

    if (match.idx > SOURCE_TEXT_PREVIEW_LIMIT) {
      setShowFullSourceText(true);
    }

    setSourceFocus({
      query: displayQuery,
      snippet: match.snippet,
      idx: match.idx,
      highlightStart: match.highlightStart,
      highlightEnd: match.highlightEnd,
    });

    openTabAndScroll("text");
  }

  // Auto-scroll the Source text viewport to the matched location when opening the tab
  useEffect(() => {
    if (tab !== "text") return;
    if (!sourceFocus || sourceFocus.idx === null) return;

    requestAnimationFrame(() => {
      if (sourceAnchorRef.current) {
        sourceAnchorRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  }, [tab, sourceFocus?.idx, showFullSourceText]);

  async function exportSummaryTxt() {
    if (!job) return;

    const text = toPlainTextSummary({
      fileName: displayName || job.file_name,
      createdAt: job.created_at,
      verdictLabel:
        verdictState === "hold" ? "Hold — resolve blockers to bid" : verdictState === "caution" ? "Proceed with caution" : "Proceed",
      decisionLine: String(executive?.decisionLine ?? "").trim() || verdictMicrocopy(verdictState),
      rationaleSnapshot: (mustItems ?? []).slice(0, 3).map((t) => String(t).trim()).filter(Boolean),
      recommendedAction:
        verdictState === "hold"
          ? "Verify all mandatory requirements and submission conditions before investing in a full response."
          : verdictState === "caution"
          ? "Proceed, but validate the risks and any missing information before committing resources."
          : "Proceed to bid. Confirm the deadline and submission method, then start drafting.",
      whereToVerify:
        "tender portal / e-proc platform (deadlines, submission method, mandatory forms); Instructions to Tenderers / submission instructions (format, signatures, upload steps); annexes / templates (declarations, pricing, required forms)",
      checklist,
      risks,
      questions,
      draftText: draftForUi,
      evidenceById,
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TenderPilot_summary_${jobId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportTenderBriefPdf() {
    if (!job) return;

    setError(null);

    const title = String(displayName || job.file_name || "Tender brief").trim() || "Tender brief";
    const created = formatDate(job.created_at);


    function evidenceBlocksHtml(ids: any) {
      const arrAll = Array.isArray(ids) ? ids.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
      if (!arrAll.length) return "";

      const MAX_BLOCKS = 3;
      const arr = arrAll.slice(0, MAX_BLOCKS);
      const overflow = arrAll.length - arr.length;

      const blocks = arr
        .map((id: string) => {
          const ev = evidenceById.get(id);
          if (!ev) {
            return `<div class="ev"><div class="ev-head">Evidence ${escapeHtml(id)} • Page ?</div><div class="ev-body">Missing evidence snippet. Verify in the PDF / portal.</div></div>`;
          }
          const pageLabel = ev.page === null || ev.page === undefined ? "Page ?" : `Page ${ev.page}`;
          const excerpt = escapeHtml(String(ev.excerpt ?? "").trim());
          return `<div class="ev"><div class="ev-head">Evidence ${escapeHtml(ev.id)} • ${escapeHtml(pageLabel)}</div><div class="ev-body">${excerpt || "(empty excerpt)"}</div></div>`;
        })
        .filter(Boolean)
        .join("\n");

      const overflowLine =
        overflow > 0
          ? `<div class="ev"><div class="ev-head">More evidence IDs</div><div class="ev-body">+${overflow} more: ${escapeHtml(
              arrAll.slice(MAX_BLOCKS).join(", ")
            )}</div></div>`
          : "";

      const out = [blocks, overflowLine].filter(Boolean).join("\n");
      return out ? `<div class="ev-wrap">${out}</div>` : "";
    }

    const mustBlockers = checklist.filter((i: any) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"));

    const mustLines = mustBlockers.length
      ? `<ol>${mustBlockers
          .slice(0, 40)
          .map((x: any) => {
            const t = escapeHtml(String(x?.text ?? x?.requirement ?? "").trim());
            const ev = evidenceBlocksHtml((x as any)?.evidence_ids);
            return `<li><span class="li-title">${t}</span>${ev}</li>`;
          })
          .join("")}</ol>`
      : `<p class="empty">No MUST blockers detected.</p>`;

    const riskLines = risks.length
      ? `<ol>${risks
          .slice(0, 25)
          .map((r: any) => {
            const sevRaw = String(r?.severity ?? r?.level ?? r?.rating ?? "medium").toLowerCase();
            const sev = sevRaw === "high" || sevRaw === "medium" || sevRaw === "low" ? sevRaw : "medium";
            const riskTitle = escapeHtml(pickText(r));
            const detail = escapeHtml(String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim());
            const sevLabel = sev === "high" ? "High" : sev === "low" ? "Low" : "Medium";
            const ev = evidenceBlocksHtml((r as any)?.evidence_ids);

            return `
              <li>
                <span class="sev sev-${sev}">${sevLabel}</span>
                <span class="li-title">${riskTitle}</span>
                ${detail ? `<div class="li-detail">${detail}</div>` : ""}
                ${ev}
              </li>
            `;
          })
          .join("")}</ol>`
      : `<p class="empty">No risks detected.</p>`;

    // Mirror the on-screen executive summary (rationale snapshot + recommended action)
    
const rationaleDrivers = buildRationaleDrivers({
  verdict: verdictState,
  mustItems,
  risksCount: risks.length,
  clarificationsCount: questions.length,
	  coverage: coverageNormalized,
  confidence,
});

const rationaleLines = rationaleDrivers.length
  ? `<ul>${rationaleDrivers.map((t) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ul>`
  : `<p class="empty">No decision drivers detected.</p>`;

    const recommendedAction =
      verdictState === "hold"
        ? "Verify all mandatory requirements and submission conditions before investing in a full response."
        : verdictState === "caution"
        ? "Proceed, but validate the risks and any missing information before committing resources."
        : "Proceed to bid. Confirm the deadline and submission method, then start drafting.";

    const manualChecks =
      `Where to verify: tender portal / e-proc platform (deadlines, submission method, mandatory forms); ` +
      `“Instructions to Tenderers” / submission instructions (format, signatures, upload steps); ` +
      `annexes / templates (declarations, pricing, required forms).`;

    const decisionLineRaw = String(executive.decisionLine ?? "").trim();
    const decisionLine = decisionLineRaw || verdictMicrocopy(verdictState);
    

    const buyerEmailText = (() => {
      const name = title;
      const subject = `Clarification questions — ${name}`;
      const lines: string[] = [];
      lines.push(`Subject: ${subject}`);
      lines.push("");
      lines.push("Hello,");
      lines.push("");
      lines.push("We are preparing our tender response and would appreciate clarification on the points below.");
      lines.push("Thank you.");
      lines.push("");
      questions.slice(0, 40).forEach((q: any, i: number) => lines.push(`${i + 1}. ${String(q)}`));
      return lines.join("\n");
    })();

    const draftOutlineLines = (() => {
      const draftLines = renderDraftPlain(draftForUi);
      if (!draftLines.length) return `<p class="empty">No outline available.</p>`;
      const body = draftLines.slice(0, 220).map((l) => escapeHtml(String(l))).join("\n");
      return `<pre style="white-space:pre-wrap;margin:0">${body}</pre>`;
    })();
const deadlineRaw = executive.submissionDeadline ? String(executive.submissionDeadline) : "";
    const deadlinePill = (() => {
      const raw = deadlineRaw.trim();
      if (!raw) return "";
      // Try to detect a plausible year in common tender formats (dd/mm/yyyy, dd.mm.yyyy, yyyy-mm-dd, etc.)
      const yearMatch = raw.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : NaN;
      if (!Number.isFinite(year)) return "Deadline present — verify in portal/PDF";
      // Guard against obviously stale / test dates
      if (year < 2020 || year > 2100) return "Deadline present — verify in portal/PDF";
      return `Submission deadline ${raw}`;
    })();

    const verdictLabel =
      verdictState === "hold" ? "Hold — resolve blockers to bid" : verdictState === "caution" ? "Proceed with caution" : "Proceed";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} tender brief</title>
    <style>
      @page { size: A4; margin: 14mm; }
      :root{ --ink:#111; --muted:#5b5b5b; --line:#dedede; --panel:#f7f7f7; --soft:#fbfbfb; }
      body{
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        margin:0; color:var(--ink);
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
        font-size: 12px; line-height: 1.45;
      }
      .page{ padding-bottom: 10mm; }
      .header{
        display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
        padding: 0 0 12px 0; border-bottom: 1px solid var(--line);
      }
      .brand{ font-size: 12px; font-weight: 700; letter-spacing: 0.2px; }
      .docTitle{ margin-top: 6px; font-size: 22px; font-weight: 750; }
      .meta{ text-align:right; font-size: 12px; color: var(--muted); max-width: 45%; }
      .meta strong{ color: var(--ink); font-weight: 600; }
      .pillRow{ margin-top: 10px; display:flex; flex-wrap:wrap; gap:8px; }
      .pill{
        display:inline-block; padding: 6px 10px; border-radius: 999px;
        border: 1px solid var(--line); background: var(--soft);
        font-size: 12px; color: var(--ink); white-space: nowrap;
      }
      .pill.emph{ border-color: #cfcfcf; background: #f1f1f1; font-weight: 650; }
      .section{ margin-top: 14px; }
      .section h2{ font-size: 13px; margin: 0 0 8px 0; letter-spacing: 0.2px; }
      .card{
        border: 1px solid var(--line); background: var(--panel);
        border-radius: 14px; padding: 12px;
        break-inside: avoid; page-break-inside: avoid;
      }
      .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .subhead{ font-size: 12px; font-weight: 700; margin: 0 0 6px 0; }
      ol{ padding-left: 18px; margin: 0; }
      li{ margin: 6px 0; }
      .empty{ margin: 0; color: var(--muted); }
      .sev{
        display:inline-block; min-width: 56px; text-align:center;
        padding: 3px 8px; border-radius: 999px;
        border: 1px solid var(--line); background: #fff;
        font-size: 11px; font-weight: 700; margin-right: 8px; vertical-align: top;
      }
      .sev-high{ border-color:#c9c9c9; background:#f0f0f0; }
      .sev-medium{ border-color:#d6d6d6; background:#f6f6f6; }
      .sev-low{ border-color:#e2e2e2; background:#fafafa; }
      .li-title{ font-weight: 650; }
      .li-detail{ margin-top: 4px; color: var(--muted); font-size: 12px; }
      .ev-wrap{ margin-top: 8px; }
      .ev{ border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; margin-top: 8px; background:#fff; }
      .ev-head{ font-size: 11px; font-weight: 700; color: var(--muted); }
      .ev-body{ margin-top: 6px; font-size: 12px; color: var(--ink); white-space: pre-wrap; }
      .disclaimer{
        margin-top: 14px; border: 1px solid var(--line);
        border-radius: 14px; padding: 10px 12px;
        background: #fff; color: var(--muted); font-size: 11.5px;
      }
      .footer{
        position: fixed; left: 0; right: 0; bottom: 0;
        display:flex; justify-content:space-between; align-items:center;
        gap: 12px;
        color: var(--muted); font-size: 11px;
        padding: 6px 0 0 0;
        border-top: 1px solid var(--line);
        background: #fff;
      }
      .footer .left{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .footer .right{ white-space:nowrap; }
      .footer span{ white-space: nowrap; }
    </style>
  </head>

  <body>
    <div class="page">
      <div class="header">
        <div>
          <div class="brand">TenderPilot</div>
          <div class="docTitle">Tender brief</div>
          <div class="pillRow">
            <span class="pill emph">${escapeHtml(verdictLabel)}</span>
            ${deadlinePill ? `<span class="pill">${escapeHtml(deadlinePill)}</span>` : ""}
          </div>
        </div>

        <div class="meta">
          <div><strong>${escapeHtml(title)}</strong></div>
          ${created ? `<div>Created ${escapeHtml(created)}</div>` : ""}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>Executive summary</h2>
          ${decisionLine ? `<p style="margin:0;color:var(--muted)">${escapeHtml(decisionLine)}</p>` : ""}

          <div style="margin-top:12px" class="grid2">
            <div class="card" style="background:#fff">
              <div class="subhead">Rationale snapshot</div>
              ${rationaleLines}
            </div>

            <div class="card" style="background:#fff">
              <div class="subhead">Recommended action</div>
              <p style="margin:0;color:var(--ink)">${escapeHtml(recommendedAction)}</p>
              <p class="note" style="margin-top:10px">${escapeHtml(manualChecks)}</p>
              <p class="note" style="margin-top:8px">Tip: In the print dialog, choose “Save as PDF”. Disable “Headers and footers” to remove the URL/footer line.</p>
            </div>
          <div class="disclaimer" style="margin-top:12px">Coverage: ${escapeHtml(String(coverageNormalized).toUpperCase())} • Confidence: ${escapeHtml(String(confidence).toUpperCase())}<br/>Evidence snippets are authoritative. Locate in source is a pointer only.</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>MUST blockers</h2>
          <p class="note">Each blocker includes deterministic evidence snippets. Locate-in-source highlights are not authoritative.</p>
          ${mustLines}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>Risks</h2>
          ${riskLines}
        </div>
      </div>


      <div class="section">
        <div class="card">
          <h2>Clarifications</h2>
          ${questions && questions.length
            ? `<div class="subhead">Ready-to-send email</div><pre style="white-space:pre-wrap;margin:0">${escapeHtml(buyerEmailText)}</pre><div style="height:10px"></div><div class="subhead">Raw list</div><ol>${questions
                .slice(0, 40)
                .map((q: any) => `<li>${escapeHtml(String(q))}</li>`)
                .join("")}</ol>`
            : `<p class="empty">No clarifications suggested.</p>`}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>Tender outline</h2>
          ${draftOutlineLines}
        </div>
      </div>

    </div>

    <div class="footer">
      <span class="left">Drafting support only. Always verify against the original tender documents.</span>
      <span class="right">TenderPilot • Tender brief</span>
    </div>
  </body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      setError("Could not create the print view. Please try again.");
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        setError("Could not open the print dialog. Please try again.");
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 300);
  }

  async function exportBidPackXlsx() {
    if (!job) return;
    setError(null);

    const res = await fetch(`/api/jobs/${jobId}/export/bid-pack`, {
      method: "GET",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Bid Pack export failed", res.status, txt);
      setError("Could not export the Bid Pack. Please try again.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TenderPilot_BidPack_${jobId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async function exportCsv(type: "overview" | "requirements" | "risks" | "clarifications" | "outline") {
    if (!job) return;
    setError(null);

    const res = await fetch(`/api/jobs/${jobId}/export/csv?type=${encodeURIComponent(type)}`, {
      method: "GET",
      headers: { Accept: "text/csv" },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("CSV export failed", type, res.status, txt);
      setError(`Could not export ${type} CSV. Please try again.`);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TenderPilot_${type}_${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  async function handleDelete() {
    if (!job) return;
    const ok = window.confirm("Delete this tender review? This cannot be undone.");
    if (!ok) return;

    try {
      const supabase = supabaseBrowser();
      await supabase.from("job_results").delete().eq("job_id", jobId);
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
      router.push("/app/jobs");
    } catch (e) {
      console.error(e);
      setError("Could not delete this tender review. Please try again.");
    }
  }

  if (invalidLink || (!loading && !job && !error)) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Tender review</p>
            <p className="mt-1 text-sm text-muted-foreground">Your tender review will appear here.</p>
            <p className="mt-2 text-sm text-red-600">This tender link is invalid. Return to your jobs and open it again.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/jobs">Back to jobs</Link>
            </Button>
            <Button variant="outline" className="rounded-full" disabled>
              Export tender brief PDF
            </Button>
            <Button className="rounded-full" disabled>
              Download summary
            </Button>
            <Button variant="destructive" className="rounded-full" disabled>
              Delete
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Preparing
          </Badge>
          <p className="text-sm text-muted-foreground">Your tender review will appear here.</p>
        </div>

        <Card className="rounded-2xl border border-white/10 bg-background/70 dark:bg-zinc-900/50 backdrop-blur-xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deadlineText = executive.submissionDeadline ? String(executive.submissionDeadline).trim() : "";

  function parseDeadlineToDate(input: string): Date | null {
    const s = String(input ?? "").trim();
    if (!s) return null;

    // Common format seen in the UI: "15:00 28/05/2014"
    const m = s.match(/(\d{1,2}:\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const [hh, mm] = m[1].split(":").map((x) => parseInt(x, 10));
      const dd = parseInt(m[2], 10);
      const mo = parseInt(m[3], 10) - 1;
      const yyyy = parseInt(m[4], 10);
      const d = new Date(yyyy, mo, dd, hh, mm, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // ISO-like fallback
    const d2 = new Date(s);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  const deadlineDate = useMemo(() => parseDeadlineToDate(deadlineText), [deadlineText]);
  const timeToDeadline = useMemo(() => {
    if (!deadlineDate) return "";
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin <= 0) return "Deadline passed";

    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 2) return `In ${diffDays} days`;
    if (diffDays === 1) return "In 1 day";
    if (diffHours >= 2) return `In ${diffHours} hours`;
    if (diffHours === 1) return "In 1 hour";
    return `In ${diffMin} min`;
  }, [deadlineDate]);

  const todayFocus = useMemo(() => {
    if (!showReady) return "";
    if (verdictState === "hold") return "Today focus: verify blockers and submission rules.";
    if (verdictState === "caution") return "Today focus: validate top risks and missing information.";
    return "Today focus: confirm submission basics, then start drafting.";
  }, [showReady, verdictState]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{displayName || job?.file_name || "Tender review"}</h1>

            <Button variant="outline" className="rounded-full" onClick={() => setRenaming(true)} disabled={!job || showProgress}>
              Rename
            </Button>

            {(job?.status === "queued" || job?.status === "processing") && (
              <Button variant="secondary" className="rounded-full" onClick={triggerProcessingOnce} disabled={!job}>
                Retry processing
              </Button>
            )}

            {statusBadge(job?.status ?? "queued")}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {showProgress
              ? "Your tender review is being prepared. This page updates automatically."
              : showFailed
              ? "This tender review needs attention."
              : "Your tender review is ready."}
          </p>

          <p className="mt-2 text-sm text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Back to jobs</Link>
          </Button>

          <Button
          variant="outline"
          className="rounded-full"
          onClick={async () => {
            if (!canDownload) return;
            setExporting("brief");
            try {
              await exportTenderBriefPdf();
            } finally {
              setExporting(null);
            }
          }}
          disabled={!canDownload || exporting !== null}
        >
          {exporting === "brief" ? "Preparing…" : "Export tender brief PDF"}
        </Button>

        <Button
          variant="outline"
          className="rounded-full"
          onClick={async () => {
            if (!canDownload) return;
            setExporting("xlsx");
            try {
              await exportBidPackXlsx();
            } finally {
              setExporting(null);
            }
          }}
          disabled={!canDownload || exporting !== null}
        >
          {exporting === "xlsx" ? "Preparing…" : "Export Bid Pack (Excel)"}
        </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full" disabled={!canDownload || exporting !== null}>
                More exports
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportCsv("overview");
                }}
              >
                Overview (CSV)
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportCsv("requirements");
                }}
              >
                Requirements (CSV)
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportCsv("risks");
                }}
              >
                Risks (CSV)
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportCsv("clarifications");
                }}
              >
                Clarifications (CSV)
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportCsv("outline");
                }}
              >
                Outline (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="rounded-full"
            onClick={async () => {
              if (!canDownload) return;
              setExporting("summary");
              try {
                await exportSummaryTxt();
              } finally {
                setExporting(null);
              }
            }}
            disabled={!canDownload || exporting !== null}
          >
            {exporting === "summary" ? "Preparing…" : "Download summary"}
          </Button>

          <Button variant="destructive" className="rounded-full" onClick={handleDelete} disabled={!canDelete}>
            Delete
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

     {showProgress ? <ProgressCard status={job?.status ?? "processing"} events={events} /> : null}
	{showFailed ? <ProgressCard status="failed" events={events} /> : null}


      
      {/* Decision (Go/No-Go) — decision-first layout */}
      <Card className="rounded-2xl border border-white/10 bg-background/70 dark:bg-zinc-900/50 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="rounded-xl bg-background/90 dark:bg-zinc-950/70 ring-1 ring-black/5 dark:ring-white/10 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between md:gap-6">
              {/* Left column should fill available space and keep breathing room from the deadline card */}
              <div className="min-w-0 flex-1 space-y-2 md:pr-4">
                <p className="text-sm font-semibold">Go/No-Go</p>

                {showFailed ? (
                  <>
                    <p className="text-sm text-foreground/80">This tender review could not be completed.</p>
                    <p className="text-xs text-muted-foreground">Re-upload the tender document or try again.</p>
                  </>
                ) : !showReady ? (
                  <>
                    <p className="text-sm text-foreground/80">Preparing decision support for this tender…</p>
                    <p className="text-xs text-muted-foreground">This page updates automatically while processing.</p>
                  </>
                ) : finalizingResults ? (
                  <>
                    <p className="text-sm text-foreground/80">Finalizing results…</p>
                    <p className="text-xs text-muted-foreground">Results are still being written. Refresh in a moment if needed.</p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <VerdictBadge state={verdictState} />
                      <p className="text-sm text-foreground/80">{verdictMicrocopy(verdictState)}</p>
                    </div>

                    <p className="text-sm text-foreground/80">{verdictDriverLine}</p>
                    
                  </>
                )}
              </div>

              {/* Deadline box: kept secondary, not competing with the verdict */}
              <div className="rounded-2xl border bg-muted/30 dark:bg-white/5 p-3 w-full md:w-[360px] lg:w-[400px] h-full flex flex-col">
                <p className="text-xs font-semibold">Submission deadline</p>
                <p className="mt-1 text-sm">
                  {showReady && deadlineText ? (
                    <span className="font-medium">{deadlineText}</span>
                  ) : (
                    <span className="text-muted-foreground">Not detected</span>
                  )}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Verify on the tender cover page or timeline section.</p>
                {showReady && timeToDeadline ? (
                  <p className="mt-2 text-xs text-muted-foreground">{timeToDeadline}</p>
                ) : null}
                {showReady && todayFocus ? (
                  <p className="mt-2 text-xs text-muted-foreground">{todayFocus}</p>
                ) : null}

                {/* keep the card visually aligned with the decision column height on desktop */}
                <div className="flex-1" />
              </div>
            </div>



      {/* Blockers + Document review (kept in the same workspace grid dimensions as Action plan / Secondary risks) */}
      {showReady && !showFailed && !finalizingResults ? (
        <div className="mt-4 space-y-4">
          {verdictState === "hold" && (mustItems ?? []).length > 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-red-900">Blockers to resolve before bidding</p>
                                          <p className="text-xs text-red-900/80">
                                            Bid is possible only if these MUST gate-checks are satisfied or formally waived. Verify in the tender portal and original PDF.
                                          </p>
                                          <ul className="list-disc pl-5 text-xs text-red-900/80 space-y-1">
                                            {(mustItems ?? []).slice(0, 3).map((t, i) => (
                                              <li key={i}>{t}</li>
                                            ))}
                                          </ul>
                                          <div className="pt-1">
                                            <Button className="rounded-full" onClick={openRequirementsForVerification}>
                                              Review MUST items
                                            </Button>
                                          </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="hidden md:block" />
          )}

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <div className="space-y-1">
                                      <p className="text-xs font-semibold text-foreground/90">Document review</p>

                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>
                                          Source text processed:{" "}
                                          <span className="text-foreground/90">
                                            {coverage === "full"
                                              ? "Complete"
                                              : coverage === "partial"
                                              ? "Mostly complete"
                                              : "Partial"}
                                          </span>
                                        </span>

                                        <span className="text-muted-foreground">•</span>

                                        <span title={confidence === "high" ? "Strong evidence coverage" : confidence === "medium" ? "Some items need verification" : "Evidence coverage is limited"}>
                                          Confidence:{" "}
                                          <span className="text-foreground/90">
                                            {confidence === "high"
                                              ? "High"
                                              : confidence === "medium"
                                              ? "Medium"
                                              : "Low"}
                                          </span>
                                        </span>
                                      </div>

                                      <p className="text-xs text-muted-foreground">
                                        Where to verify (manual checks): tender portal / e-proc platform (deadlines, submission method, mandatory forms); “Instructions to Tenderers” (format, signatures, upload steps); annexes / templates (declarations, pricing, required forms).
                                      </p>

                                      {coverage !== "full" ? (
                                        <p className="text-xs text-muted-foreground">
                                          Some content may be missing from this review. Treat this decision as provisional until you verify the key gate-checks in the original tender.
                                        </p>
                                      ) : null}
                                    </div>

                                    {evidenceCoverage.mustTotal > 0 && evidenceCoverage.mustCovered < evidenceCoverage.mustTotal ? (
                                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold text-amber-900">Some MUST requirements need verification</p>
                                            <p className="text-xs text-amber-900/80">
                                              MUST evidence coverage is {evidenceCoverage.mustCovered}/{evidenceCoverage.mustTotal}. Review the MUST items marked “Needs verification” before committing.
                                            </p>
                                          </div>
                                          <Button className="rounded-full" onClick={openRequirementsForVerification}>
                                            Review MUST items
                                          </Button>
                                        </div>
                                      </div>
                                    ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
{/* What blocks us right now — actions (only when ready) */}
      {showReady && !showFailed && !finalizingResults ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Action plan (next steps)</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ordered by priority. Start with blockers that could invalidate the bid. Evidence snippets are authoritative; “Locate in source” is a best-effort pointer only.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                {nextActionsForUi.map((a: any, i: number) => (
                  <div
                    key={`${i}-${a.target}-${a.text}`}
                    className="rounded-xl border bg-background/60 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{a.text}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full border bg-background px-2 py-0.5">{a.label}</span>
                          <span>•</span>
                          <span>{a.owner}</span>
                          <span>•</span>
                          <span>{a.eta}</span>
                        </div>

                        {a.dueMoment ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{a.dueMoment}</p>
                        ) : null}

                        <p className="mt-2 text-xs text-muted-foreground">{a.why}</p>
                        {a.doneWhen ? (
                          <p className="mt-2 text-xs text-muted-foreground">{a.doneWhen}</p>
                        ) : null}

                        {a.evidencePreview ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Evidence: <span className="text-foreground/70">{a.evidencePreview}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => openTabAndScroll(a.target)}
                        >
                          Open section
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => onJumpToSource(a.evidenceQuery)}
                          disabled={!extractedText}
                        >
                          Locate in source
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: start with blockers and submission rules. Then validate risks and unknowns.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Secondary risks to validate</p>
                  <p className="mt-1 text-xs text-muted-foreground">Items that can change effort, feasibility, or risk.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowRisksSection((v) => !v)}
                  className="w-full rounded-xl border bg-background/60 p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Other risks</p>
                    <p className="text-xs text-muted-foreground">{risks.length}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Delivery, commercial, legal, or scope risks to validate.</p>
                </button>

                {showRisksSection ? (
                  <div className="rounded-xl border bg-background p-3 space-y-2">
                    {(topRisksForPanel.length ? topRisksForPanel : risks.slice(0, 5)).map((r: any, i: number) => {
                      const title = String(r?.title ?? r?.risk ?? r?.text ?? "").trim();
                      const detail = String(r?.detail ?? r?.description ?? "").trim();
                      const jumpText = detail ? `${title}\n${detail}` : title;
                      if (!title) return null;
                      return (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{title}</p>
                            {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                          {(() => {
                            const ids = (r as any)?.evidence_ids;
                            if (Array.isArray(ids) && ids.length) {
                              return (
                                <Button
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => showEvidenceByIds(ids, jumpText)}
                                >
                                  Open evidence
                                </Button>
                              );
                            }
                            return null;
                          })()}
                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => onJumpToSource(jumpText)}
                            disabled={!extractedText}
                          >
                            Locate in source
                          </Button>
                        </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-end">
                      <Button variant="outline" className="rounded-full" onClick={() => openTabAndScroll("risks")}>
                        Open all risks
                      </Button>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowUnknownsSection((v) => !v)}
                  className="w-full rounded-xl border bg-background/60 p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Missing or unclear information</p>
                    <p className="text-xs text-muted-foreground">{questions.length}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Ambiguities and buyer questions to resolve before submission. Not blockers by themselves unless a P1 gate-check fails.</p>
                </button>

                {showUnknownsSection ? (
                  <div className="rounded-xl border bg-background p-3 space-y-2">
                    {(questions ?? []).slice(0, 5).map((q, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground/90">{q}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{classifyClarification(q).hint}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={async () => {
                            const ok = await safeCopy(`- ${q}`);
                            if (ok) {
                              setCopiedSection(`qemail_${i}`);
                              window.setTimeout(() => setCopiedSection(null), 1200);
                            }
                          }}
                        >
                          {copiedSection === `qemail_${i}` ? "Copied" : "Add to buyer email"}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => onJumpToSource(q)}
                          disabled={!extractedText}
                        >
                          Locate in source
                        </Button>
                      </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Button variant="outline" className="rounded-full" onClick={() => openTabAndScroll("questions")}>
                        Open clarifications
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

            {/* Decision drivers — only when ready */}
            {showReady && !showFailed && !finalizingResults ? (
              <>
                {/* Executive summary — decision in 10 seconds */}
                <div className="mt-6 rounded-2xl border bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Executive summary</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Decision rationale and immediate next step.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    
<div className="rounded-xl border bg-background p-3">
                      <p className="text-xs font-semibold">Rationale snapshot</p>
                      {rationaleDrivers?.length ? (
                        <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-foreground/80">
                          {rationaleDrivers.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">No decision drivers detected.</p>
                      )}
                    </div>

                    <div className="rounded-xl border bg-background p-3">
                      <p className="text-xs font-semibold">Recommended action</p>
                      <p className="mt-2 text-sm text-foreground/80">
                        {verdictState === "hold"
                          ? "Verify all mandatory requirements and submission conditions before investing in a full response."
                          : verdictState === "caution"
                          ? "Proceed, but validate the risks and any missing information before committing resources."
                          : "Proceed to bid. Confirm the deadline and submission method, then start drafting."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Why this decision</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This decision is driven primarily by submission method, compliance requirements, and document completeness. Use “Evidence” to highlight the matching passage in the Source text tab, then confirm in the original PDF (especially tender portal rules, submission instructions, and annexes/templates).
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setShowAllDrivers((v) => !v)}
                    disabled={!showReady}
                  >
                    {showAllDrivers ? "Show less" : "Show all blockers"}
                  </Button>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-xs font-semibold">Mandatory blockers</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mustItems.length ? `Showing ${Math.min(showAllDrivers ? mustItems.length : 3, mustItems.length)} of ${mustItems.length}.` : "None detected."}
                  </p>

                  <div className="mt-3 space-y-2">
                    {(mustItems ?? [])
                      .slice(0, showAllDrivers ? 12 : 3)
                      .map((t, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground/90 leading-relaxed">{t}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{classifyBlocker(t).hint}</p>
                            {blockerEvidence.get(t) ? (
                              <div className="mt-2 rounded-lg border bg-muted/30 dark:bg-white/5 p-2">
                                <p className="text-[11px] font-semibold text-muted-foreground">Excerpt</p>
                                <p className="mt-1 text-xs text-foreground/80 line-clamp-3">
                                  {blockerEvidence.get(t)}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Pointer only: use this excerpt to locate the clause in the original PDF (Ctrl+F), then confirm in the portal rules, “Instructions to Tenderers”, and relevant annexes/templates.
                                </p>
                              </div>
                            ) : null}
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-full shrink-0"
                            onClick={() => showEvidenceByIds(mustEvidenceIdsByText.get(t) ?? undefined, t)}
                            disabled={((mustEvidenceIdsByText.get(t)?.length ?? 0) === 0) && !extractedText}
                          >
                            Evidence
                          </Button>
                        </div>
                      ))}
                  </div>

                  {!mustItems?.length ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No MUST blockers detected. Still verify eligibility and submission format in the tender portal and submission instructions.
                    </p>
                  ) : null}
                </div>
              </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Explore — reference mode (tabs) */}
      <div className="pt-2" ref={tabsTopRef}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Explore the tender</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reference view. Use this to verify details, export text, and inspect all extracted items.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">{showReady ? "Click a section to open it." : null}</div>
        </div>
      </div>


      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList className="rounded-full">
          <TabsTrigger value="checklist" className="rounded-full">
            Requirements
          </TabsTrigger>
          <TabsTrigger value="risks" className="rounded-full">
            Risks
          </TabsTrigger>
          <TabsTrigger value="questions" className="rounded-full">
            Clarifications
          </TabsTrigger>
          <TabsTrigger value="draft" className="rounded-full">
            Tender Outline
          </TabsTrigger>
          <TabsTrigger value="work" className="rounded-full">
            Bid room
          </TabsTrigger>
          <TabsTrigger value="text" className="rounded-full">
            Source text
          </TabsTrigger>
        </TabsList>

        
		  {showReady && !finalizingResults ? (
			<div className="mt-3 flex flex-wrap items-center gap-2">
			  <Badge variant="outline" className="rounded-full">
				MUST evidence coverage: {evidenceCoverage.mustCovered}/{evidenceCoverage.mustTotal}
			  </Badge>
			  <Badge variant="outline" className="rounded-full">
				Overall evidence coverage: {evidenceCoverage.overallCovered}/{evidenceCoverage.overallTotal}
			  </Badge>
			  {evidenceCoverage.mustTotal > 0 && evidenceCoverage.mustCovered < evidenceCoverage.mustTotal ? (
				<Badge variant="secondary" className="rounded-full">
				  Some MUST items need verification
				</Badge>
			  ) : null}
			</div>
		  ) : null}

			<TabsContent value="checklist">
          <div className="mt-3">
            {showFailed ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Analysis failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">This tender review could not be completed. Please re-upload the document or try again.</p>
                </CardContent>
              </Card>
            ) : !showReady ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Requirements are being extracted</p>
                  <p className="mt-1 text-sm text-muted-foreground">We&apos;re scanning the tender for MUST/SHOULD/INFO items. This section will populate automatically.</p>
                </CardContent>
              </Card>
            ) : finalizingResults ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Finalizing results…</p>
                  <p className="mt-1 text-sm text-muted-foreground">The job is marked as done, but results are still being written. Please wait a few seconds or refresh.</p>
                </CardContent>
              </Card>
            ) : checklist.length ? (
              <Checklist
                checklist={checklist}
                extractedText={extractedText}
                onJumpToSource={onJumpToSource}
                onShowEvidence={showEvidenceByIds}
                knownEvidenceIds={knownEvidenceIds}
              evidenceById={evidenceById}
              />
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">No requirements extracted</p>
                  <p className="mt-1 text-sm text-muted-foreground">We didn&apos;t detect explicit MUST/SHOULD/INFO items. Verify the source text, or try re-uploading a cleaner PDF.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="flex items-center justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => copySection("risks")} disabled={!canDownload}>
              {copiedSection === "risks" ? "Copied" : "Copy section"}
            </Button>
          </div>

          <div className="mt-3">
            {showFailed ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Analysis failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">This tender review could not be completed. Please re-upload the document or try again.</p>
                </CardContent>
              </Card>
            ) : !showReady ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Identifying key risks</p>
                  <p className="mt-1 text-sm text-muted-foreground">We&apos;re highlighting technical, legal, commercial, and delivery risks from the tender.</p>
                </CardContent>
              </Card>
            ) : finalizingResults ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Finalizing results…</p>
                  <p className="mt-1 text-sm text-muted-foreground">The job is marked as done, but results are still being written. Please wait a few seconds or refresh.</p>
                </CardContent>
              </Card>
            ) : risks.length ? (
              <Risks
                risks={risks}
                extractedText={extractedText}
                onJumpToSource={onJumpToSource}
                onShowEvidence={showEvidenceByIds}
                knownEvidenceIds={knownEvidenceIds}
              />
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">No major risks detected</p>
                  <p className="mt-1 text-sm text-muted-foreground">We didn&apos;t flag high-impact risks. Still verify deadlines, eligibility, and mandatory deliverables in the source text.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

       <TabsContent value="questions">
		  <div className="mt-3">
			{showFailed ? (
			  <Card className="rounded-2xl">
				<CardContent className="p-6">
				  <p className="text-sm font-semibold">Analysis failed</p>
				  <p className="mt-1 text-sm text-muted-foreground">
					This tender review could not be completed. Please re-upload the document or try again.
				  </p>
				</CardContent>
			  </Card>
			) : !showReady ? (
			  <Card className="rounded-2xl">
				<CardContent className="p-6">
				  <p className="text-sm font-semibold">Generating clarifications</p>
				  <p className="mt-1 text-sm text-muted-foreground">
					We&apos;re listing buyer questions and ambiguities to resolve before submission. These are not disqualifiers
					by themselves unless a P1 gate-check fails (eligibility/submission).
				  </p>
				</CardContent>
			  </Card>
			) : finalizingResults ? (
			  <Card className="rounded-2xl">
				<CardContent className="p-6">
				  <p className="text-sm font-semibold">Finalizing results…</p>
				  <p className="mt-1 text-sm text-muted-foreground">
					The job is marked as done, but results are still being written. Please wait a few seconds or refresh.
				  </p>
				</CardContent>
			  </Card>
			) : questions.length ? (
			  <BuyerQuestions
				checklist={checklist}
				risks={risks}
				extractedText={extractedText}
				onJumpToSource={onJumpToSource}
				questions={questions}
				tenderName={String(displayName || job?.file_name || "Tender").trim()}
			  />
			) : (
			  <Card className="rounded-2xl">
				<CardContent className="p-6">
				  <p className="text-sm font-semibold">No clarifications identified</p>
				  <p className="mt-1 text-sm text-muted-foreground">
					We didn&apos;t detect explicit buyer questions or ambiguities. Still verify eligibility, deadlines, and
					submission format in the tender source (often in annexes or the portal instructions).
				  </p>
				</CardContent>
			  </Card>
			)}
		  </div>
		</TabsContent>


        <TabsContent value="draft">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold">Tender  outline</p>
                  <p className="mt-1 text-sm text-muted-foreground"> A structured outline based on the tender text. <span className="font-medium text-foreground">Not a full quotation.</span> Use it to start your tender response, then tailor and verify.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => copySection("draft")} disabled={!canDownload}>
                    {copiedSection === "draft" ? "Copied" : "Copy section"}
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              {showFailed ? (
                <p className="text-sm text-muted-foreground">This tender review could not be completed. Please re-upload the document or try again.</p>
              ) : !showReady ? (
                <p className="text-sm text-muted-foreground">Preparing a tender draft outline…</p>
              ) : finalizingResults ? (
                <p className="text-sm text-muted-foreground">Finalizing results… this should take only a few seconds. If it doesn&apos;t, refresh the page.</p>
              ) : hasDraftForUi ? (
                (() => {
                  const sections =
                    typeof draftForUi === "object" &&
                    draftForUi &&
                    Array.isArray((draftForUi as any).sections)
                      ? (((draftForUi as any).sections as any[]) ?? [])
                      : null;

                  if (sections && sections.length) {
                    return (
                      <div className="space-y-4">
                        {sections.map((s: any, idx: number) => {
                          const title = String(s?.title ?? "").trim();
                          const bullets = Array.isArray(s?.bullets) ? s.bullets : [];
                          const payloadLines = [
                            title || `Section ${idx + 1}`,
                            ...bullets
                              .map((b: any) => String(b ?? "").trim())
                              .filter(Boolean)
                              .map((b: string) => `- ${b}`),
                          ].filter(Boolean);

                          const payload = payloadLines.join("\n").trim();
                          if (!payload) return null;

                          return (
                            <div key={idx} className="rounded-xl border bg-background/60 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold">{title || `Section ${idx + 1}`}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Copy a section brief to assign writing work. Tailor and verify against the tender source.
                                  </p>
                                </div>

                                <Button
                                  variant="outline"
                                  className="rounded-full shrink-0"
                                  onClick={async () => {
                                    const ok = await safeCopy(payload);
                                    if (ok) {
                                      setCopiedSection(`draftbrief_${idx}`);
                                      window.setTimeout(() => setCopiedSection(null), 1200);
                                    }
                                  }}
                                >
                                  {copiedSection === `draftbrief_${idx}` ? "Copied" : "Copy section brief"}
                                </Button>
                              </div>

                              {bullets.length ? (
                                <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-foreground/80">
                                  {bullets
                                    .map((b: any) => String(b ?? "").trim())
                                    .filter(Boolean)
                                    .map((b: string, i2: number) => (
                                      <li key={i2}>{b}</li>
                                    ))}
                                </ul>
                              ) : (
                                <p className="mt-3 text-sm text-muted-foreground">No bullet points detected for this section.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  return <pre className="text-sm whitespace-pre-wrap">{draftLinesForUi.join("\n")}</pre>;
                })()
              ) : (
                <p className="text-sm text-muted-foreground">No draft outline was generated. Try re-uploading the PDF or verify the source text tab.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Bid room</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assign owners, track status, and leave short notes. This overlays the evidence-first results (it does not change them).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/jobs/${jobId}/export/bid-pack`, { method: "GET" });
                        if (!res.ok) throw new Error(String(res.status));
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `TenderPilot_BidPack_${jobId}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch {
                        setWorkError("Could not export the Bid Pack.");
                      }
                    }}
                    disabled={!canDownload}
                  >
                    Export Bid Pack
                  </Button>
                </div>
              </div>

              {workError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{workError}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full">
                  Items: {workBaseRows.length}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  Done: {workItems.filter((w) => String(w?.status ?? "") === "done").length}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  Blocked: {workItems.filter((w) => String(w?.status ?? "") === "blocked").length}
                </Badge>
              </div>

              <div className="rounded-xl border bg-background/60">
                <div className="grid grid-cols-12 gap-2 border-b bg-background/60 p-2 text-[11px] font-medium text-muted-foreground">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Owner</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Due</div>
                  <div className="col-span-1">Notes</div>
                </div>

                <ScrollArea className="h-[520px]">
                  <div className="divide-y">
                    {workBaseRows.map((r) => {
                      const key = `${r.type}:${r.ref_key}`;
                      const w = workByKey.get(key);
                      const status = String(w?.status ?? "todo");
                      const owner = String(w?.owner_label ?? "");
                      const due = w?.due_at ? String(w.due_at).slice(0, 10) : "";
                      const notes = String(w?.notes ?? "");

                      return (
                        <div key={key} className="grid grid-cols-12 gap-2 p-2 text-sm">
                          <div className="col-span-2">
                            <p className="text-xs font-medium">
                              {r.type}
                              {r.meta ? <span className="text-muted-foreground"> • {r.meta}</span> : null}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">{r.ref_key}</p>
                          </div>

                          <div className="col-span-5 min-w-0">
                            <p className="text-sm text-foreground/90 break-words">{r.title}</p>
                          </div>

                          <div className="col-span-2">
                            <Input
                              value={owner}
                              placeholder="e.g., Michela"
                              className="h-8"
                              onChange={(e) => {
                                const v = e.target.value;
                                // local-only update for instant feedback
                                setWorkItems((prev) => {
                                  const k = `${r.type}:${r.ref_key}`;
                                  const next = [...prev];
                                  const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === k);
                                  if (idx >= 0) next[idx] = { ...next[idx], owner_label: v };
                                  else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status, owner_label: v });
                                  return next;
                                });
                              }}
                              onBlur={async (e) => {
                                await upsertWorkItem({
                                  type: r.type,
                                  ref_key: r.ref_key,
                                  title: r.title,
                                  status,
                                  owner_label: e.target.value,
                                  due_at: due || null,
                                  notes,
                                });
                              }}
                              disabled={workSaving === key}
                            />
                          </div>

                          <div className="col-span-1">
                            <select
                              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                              value={status}
                              onChange={async (e) => {
                                const v = e.target.value;
                                await upsertWorkItem({
                                  type: r.type,
                                  ref_key: r.ref_key,
                                  title: r.title,
                                  status: v,
                                  owner_label: owner,
                                  due_at: due || null,
                                  notes,
                                });
                              }}
                              disabled={workSaving === key}
                            >
                              {[
                                "todo",
                                "in_progress",
                                "done",
                                "blocked",
                                "rejected",
                              ].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-1">
                            <Input
                              type="date"
                              value={due}
                              className="h-8"
                              onChange={(e) => {
                                const v = e.target.value;
                                setWorkItems((prev) => {
                                  const k = `${r.type}:${r.ref_key}`;
                                  const next = [...prev];
                                  const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === k);
                                  if (idx >= 0) next[idx] = { ...next[idx], due_at: v };
                                  else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status, due_at: v });
                                  return next;
                                });
                              }}
                              onBlur={async (e) => {
                                await upsertWorkItem({
                                  type: r.type,
                                  ref_key: r.ref_key,
                                  title: r.title,
                                  status,
                                  owner_label: owner,
                                  due_at: e.target.value || null,
                                  notes,
                                });
                              }}
                              disabled={workSaving === key}
                            />
                          </div>

                          <div className="col-span-1">
                            <Input
                              value={notes}
                              placeholder="Short note"
                              className="h-8"
                              onChange={(e) => {
                                const v = e.target.value;
                                setWorkItems((prev) => {
                                  const k = `${r.type}:${r.ref_key}`;
                                  const next = [...prev];
                                  const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === k);
                                  if (idx >= 0) next[idx] = { ...next[idx], notes: v };
                                  else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status, notes: v });
                                  return next;
                                });
                              }}
                              onBlur={async (e) => {
                                await upsertWorkItem({
                                  type: r.type,
                                  ref_key: r.ref_key,
                                  title: r.title,
                                  status,
                                  owner_label: owner,
                                  due_at: due || null,
                                  notes: e.target.value,
                                });
                              }}
                              disabled={workSaving === key}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          {evidenceFocus ? (
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Evidence snippet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {evidenceFocus.id ? (
                        <>ID: <span className="font-medium text-foreground">{evidenceFocus.id}</span></>
                      ) : (
                        <>Evidence</>
                      )}
                      {typeof evidenceFocus.page === "number" ? (
                        <> • Page {evidenceFocus.page}</>
                      ) : null}
                      {evidenceFocus.anchor ? (
                        <> • <span className="text-foreground/70">{evidenceFocus.anchor}</span></>
                      ) : null}
                    </p>

                    {Array.isArray(evidenceFocus.allIds) && evidenceFocus.allIds.length > 1 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Switch evidence:</span>
                        {evidenceFocus.allIds.slice(0, 12).map((eid) => {
                          const active = String(eid) === String(evidenceFocus.id);
                          return (
                            <Button
                              key={eid}
                              type="button"
                              size="sm"
                              variant={active ? "default" : "outline"}
                              className="rounded-full"
                              onClick={() => {
                                const cand = evidenceById.get(String(eid));
                                if (!cand) {
                                  setEvidenceFocus((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          id: String(eid),
                                          excerpt: "",
                                          page: null,
                                          anchor: null,
                                          note:
                                            "Evidence id not found in the pipeline evidence map. It may have been trimmed or generated with a different version. Verify in the original PDF.",
                                        }
                                      : prev
                                  );
                                  return;
                                }

                                const ex = String((cand as any)?.excerpt ?? "").trim();
                                setEvidenceFocus((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        id: String((cand as any)?.id ?? eid),
                                        excerpt: ex,
                                        page: (cand as any)?.page ?? null,
                                        anchor: (cand as any)?.anchor ?? null,
                                        note: null,
                                      }
                                    : prev
                                );

                                openTabAndScroll("text");
                                if (ex) window.setTimeout(() => onJumpToSource(ex), 0);
                              }}
                            >
                              {eid}
                            </Button>
                          );
                        })}
                      </div>
                    ) : null}

                    {evidenceFocus.note ? (
                      <p className="mt-2 text-xs text-muted-foreground">{evidenceFocus.note}</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Deterministic evidence-first view: this snippet is shown directly from the pipeline evidence map. Verify it in the original PDF.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {evidenceFocus.excerpt ? (
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={async () => {
                          const ok = await safeCopy(evidenceFocus.excerpt);
                          if (ok) {
                            setCopiedSection("evidence");
                            window.setTimeout(() => setCopiedSection(null), 1200);
                          }
                        }}
                      >
                        {copiedSection === "evidence" ? "Copied" : "Copy"}
                      </Button>
                    ) : null}

                    {evidenceFocus.excerpt ? (
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          const ex = String(evidenceFocus.excerpt ?? "").trim();
                          const hay = String(extractedText ?? "");
                          const hasExact = ex ? hay.toLowerCase().includes(ex.toLowerCase()) : false;

                          if (hasExact) {
                            onJumpToSource(ex);
                            return;
                          }

                          const p = evidenceFocus.page;
                          if (p !== null && p !== undefined) {
                            const pageNum = Number(p);
                            if (!Number.isNaN(pageNum)) {
                              jumpToPageMarker(
                                pageNum,
                                "Exact clause not found in extracted text. Jumped to the page marker as a reliable anchor. Verify in the original PDF."
                              );
                              return;
                            }
                          }

                          // fallback (keeps safe behavior)
                          onJumpToSource(ex);
                        }}
                        disabled={!extractedText}
                      >
                        Locate in source
                      </Button>
                    ) : null}

                    <Button variant="outline" className="rounded-full" onClick={() => setEvidenceFocus(null)}>
                      Close excerpt
                    </Button>
                  </div>
                </div>

                {evidenceFocus.excerpt ? (
                  <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{evidenceFocus.excerpt}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {sourceFocus ? (
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Focused excerpt</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Match for: <span className="font-medium text-foreground">{sourceFocus.query}</span>
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Evidence highlights the matching line in the Source text below. Use it as a pointer only: locate the same clause in the original PDF (search the phrase) and verify the exact wording and formatting.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={async () => {
                        const ok = await safeCopy(sourceFocus.query);
                        if (ok) {
                          setCopiedSection("sourcePhrase");
                          window.setTimeout(() => setCopiedSection(null), 1200);
                        }
                      }}
                    >
                      {copiedSection === "sourcePhrase" ? "Copied" : "Copy phrase"}
                    </Button>

                    <Button variant="outline" className="rounded-full" onClick={() => setSourceFocus(null)}>
                      Close excerpt
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{sourceFocus.snippet}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {(() => {
            const fullText = extractedText || "";
            const isLarge = fullText.length > SOURCE_TEXT_PREVIEW_LIMIT;

            const visibleText = !isLarge || showFullSourceText ? fullText : fullText.slice(0, SOURCE_TEXT_PREVIEW_LIMIT);

            return (
              <>
                <ScrollArea className="mt-4 h-[520px] rounded-2xl border bg-muted/20">
				  <div className="w-full overflow-x-auto">
					<pre
					  className="min-w-max whitespace-pre p-4 text-xs leading-relaxed"
					  style={{ scrollbarGutter: "stable both-edges" }}
					>
						  {(() => {
							const raw = visibleText || "";
							if (!raw) return "No source text yet.";

							const hs = sourceFocus?.highlightStart;
							const he = sourceFocus?.highlightEnd;

							// If we do not have reliable highlight bounds, always render the raw source text.
							if (hs === null || hs === undefined || he === null || he === undefined) {
							  return raw;
							}

							const start = Math.max(0, Math.min(hs, raw.length));
							const end = Math.max(start, Math.min(he, raw.length));

							// Degenerate bounds: fall back to raw text.
							if (end <= start) return raw;

							const before = raw.slice(0, start);
							const mid = raw.slice(start, end);
							const after = raw.slice(end);

							return (
							  <>
								{before}
								<span
								  ref={sourceAnchorRef}
								  className="bg-yellow-200/50 border-l-4 border-yellow-500 px-2 py-1 rounded-md"
								>
								  {mid}
								</span>
								{after}
							  </>
							);
						  })()}
					</pre>
				  </div>
				</ScrollArea>



                {isLarge && (
                  <div className="mt-2 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowFullSourceText((v) => !v)}>
                      {showFullSourceText ? "Show preview" : "Show full text"}
                    </Button>
                  </div>
                )}
              </>
            );
          })()}

          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            This is drafting support. Always verify requirements and legal language against the original tender document.
          </p>
        </TabsContent>
      </Tabs>

      {/* Rename modal (simple inline) */}
      {renaming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-lg">
            <p className="text-sm font-semibold">Rename</p>
            <p className="mt-1 text-sm text-muted-foreground">This is a local display name for your tender review.</p>

            <input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="mt-4 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter a name…"
              autoFocus
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              <Button className="rounded-full" onClick={handleRenameSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
