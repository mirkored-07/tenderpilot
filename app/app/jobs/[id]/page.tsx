"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { getJobDisplayName, setJobDisplayName, clearJobDisplayName } from "@/lib/pilot-job-names";

import Checklist from "@/components/checklist/Checklist";
import Risks from "@/components/risks/Risks";
import BuyerQuestions from "@/components/questions/BuyerQuestions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  checklist: any | null;
  risks: any | null;
  proposal_draft: any | null;
  created_at: string;
  updated_at: string;
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
    return <span className={`${base} border-red-200 bg-red-50 text-red-800`}>Hold – potential blocker</span>;
  }
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-900`}>Proceed with caution</span>;
}

function verdictMicrocopy(state: VerdictState) {
  if (state === "proceed") return "No major blockers detected. You can start tender response work.";
  if (state === "hold") return "A potential blocker was detected. Verify compliance or waiver before continuing.";
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

function ProgressCard({ status }: { status: JobStatus }) {
  const title =
    status === "failed"
      ? "Something needs attention"
      : status === "queued"
      ? "Getting started"
      : "Working on your tender review";

  const subtitle =
    status === "queued"
      ? "Preparing your workspace…"
      : status === "processing"
      ? "Extracting requirements, risks, clarifications, and a short draft"
      : "Please try again or re-upload the file.";

  return (
    <Card className="rounded-2xl">
      <CardContent className="py-5 space-y-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">Results appear automatically on this page</p>
        </div>

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={[
              "absolute left-0 top-0 h-full rounded-full transition-all duration-700",
              status === "failed"
                ? "w-full bg-red-500"
                : status === "queued"
                ? "w-1/3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-pulse"
                : "w-2/3 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-pulse",
            ].join(" ")}
          />
        </div>

        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <p className="text-xs text-muted-foreground">
		  Steps: upload → extract → analyze → results. This usually takes 1–3 minutes (large files can take longer).
		  If it takes longer, refresh this page or open{" "}
		  <Link href="/app/jobs" className="underline underline-offset-4">
			My jobs
		  </Link>
		  .
		</p>

      </CardContent>
    </Card>
  );
}

function findExcerpt(text: string, query: string) {
  const t = text ?? "";
  const q = (query ?? "").trim();
  if (!t || !q) return null;

  const hay = t.toLowerCase();

  function makeSnippet(centerIdx: number, needleLen: number) {
    const start = Math.max(0, centerIdx - 220);
    const end = Math.min(t.length, centerIdx + Math.max(needleLen, 40) + 260);
    const snippet = t.slice(start, end).replace(/\s+/g, " ").trim();
    return { idx: centerIdx, snippet };
  }

  // 1) Try exact match first (fast path)
  const exactIdx = hay.indexOf(q.toLowerCase());
  if (exactIdx >= 0) return makeSnippet(exactIdx, q.length);

  // 2) Try short contiguous needles (first 12 / 8 words)
  const wordsAll = q.split(/\s+/).filter(Boolean);
  const needles = [wordsAll.slice(0, 12).join(" "), wordsAll.slice(0, 8).join(" ")].filter(Boolean);

  for (const n of needles) {
    const idx = hay.indexOf(n.toLowerCase());
    if (idx >= 0) return makeSnippet(idx, n.length);
  }

  // 3) Fuzzy keyword match
  const STOP = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "by",
    "via",
    "is",
    "are",
    "be",
    "as",
    "at",
    "from",
    "that",
    "this",
    "these",
    "those",
    "must",
    "should",
    "shall",
    "will",
    "may",
    "can",
    "not",
    "only",
    "all",
  ]);

  const tokens = wordsAll
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length >= 4 && !STOP.has(w));

  if (!tokens.length) return null;

  const uniq = Array.from(new Set(tokens)).slice(0, 12);

  const MAX_OCC_PER_TOKEN = 25;

  type Occ = { idx: number; token: string };
  const occs: Occ[] = [];

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

  const WINDOW = 700;

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
      if (best.score >= Math.min(6, uniq.length)) break;
    }
  }

  if (best.score < 2) return null;

  return makeSnippet(best.center, best.tokenLen);
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
  checklist: any[];
  risks: any[];
  questions: string[];
  draftText: any;
}) {
  const { fileName, createdAt, checklist, risks, questions, draftText } = args;

  const must = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"));
  const should = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("SHOULD"));
  const info = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("INFO"));

  const lines: string[] = [];
  lines.push("TenderRay summary");
  lines.push("");
  if (fileName) lines.push(`File: ${fileName}`);
  if (createdAt) lines.push(`Created: ${formatDate(createdAt)}`);
  lines.push("");

  function render(label: string, items: string[]) {
    lines.push(label);
    if (!items.length) lines.push("None detected.");
    else items.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }

  render(
    "MUST requirements",
    must.map((x) => String(x?.text ?? x?.requirement ?? "").trim()).filter(Boolean)
  );
  render(
    "SHOULD items",
    should.map((x) => String(x?.text ?? x?.requirement ?? "").trim()).filter(Boolean)
  );
  render(
    "INFO items",
    info.map((x) => String(x?.text ?? x?.requirement ?? "").trim()).filter(Boolean)
  );

  lines.push("Risks");
  if (!risks.length) lines.push("No risks detected.");
  else {
    risks.slice(0, 20).forEach((r, i) => {
      const sev = String(r?.severity ?? r?.level ?? "medium").toUpperCase();
      const title = String(r?.title ?? r?.risk ?? r?.text ?? "").trim();
      const detail = String(r?.detail ?? r?.description ?? "").trim();
      lines.push(`${i + 1}. [${sev}] ${title}${detail ? ` — ${detail}` : ""}`);
    });
  }
  lines.push("");

  lines.push("Clarifications");
  if (!questions.length) lines.push("No clarifications suggested.");
  else questions.slice(0, 20).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  lines.push("");

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

  return { label: "General", hint: "Check this requirement in the tender source." };
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


export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = String((params as any)?.id ?? "").trim();
  const jobId = rawId;

  const [invalidLink, setInvalidLink] = useState(false);

  const [job, setJob] = useState<DbJob | null>(null);
  const [result, setResult] = useState<DbJobResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"checklist" | "risks" | "questions" | "draft" | "text">("checklist");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const [displayName, setDisplayNameState] = useState<string>("");
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const [sourceFocus, setSourceFocus] = useState<{ query: string; snippet: string; idx: number | null } | null>(null);

  /** UI safety state for very large extracted text */
  const [showFullSourceText, setShowFullSourceText] = useState(false);

  const [exporting, setExporting] = useState<null | "summary">(null);

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

  const showProgress = useMemo(() => {
    const s = job?.status;
    return s === "queued" || s === "processing";
  }, [job]);

  const showReady = useMemo(() => job?.status === "done", [job]);
  const showFailed = useMemo(() => job?.status === "failed", [job]);

  const canDownload = useMemo(() => Boolean(job && job.status === "done"), [job]);
  const canDelete = Boolean(job) && !showProgress;

  const extractedText = useMemo(() => String(result?.extracted_text ?? "").trim(), [result]);
  const checklist = useMemo(() => normalizeChecklist(result?.checklist), [result]);
  const risks = useMemo(() => normalizeRisks(result?.risks), [result]);

  // IMPORTANT: questions come from proposal_draft.buyer_questions (DB contract)
  const questions = useMemo(() => {
    const pd = (result as any)?.proposal_draft ?? null;
    return normalizeQuestions(pd?.buyer_questions ?? pd?.clarifications ?? (result as any)?.buyer_questions ?? (result as any)?.clarifications);
  }, [result]);

  const mustItems = useMemo(() => {
    return checklist
      .filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"))
      .map((x) => String(x?.text ?? x?.requirement ?? "").trim())
      .filter(Boolean);
  }, [checklist]);

  const executive = useMemo(() => {
    const pd = (result as any)?.proposal_draft ?? {};
    const raw = pd?.executive_summary ?? {};
    return toExecutiveModel({ raw });
  }, [result]);

  const draftForUi = useMemo(() => {
    const pd = (result as any)?.proposal_draft ?? null;
    return pd?.proposal_draft ?? null;
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
	  }> = [];


  // Fallback action 1
  if (mustItems.length) {
    const text = "Verify potential blockers (MUST requirements)";
    const evidenceQuery = evidenceForAction("checklist", text);
	const meta = classifyOwnerAndEta({ text, target: "checklist", label: "Compliance" });
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

    });
  } else if (executive?.topRisks?.length) {
    const text = "Validate the top risks and mitigations";
    const evidenceQuery = evidenceForAction("risks", text);
    const meta = classifyOwnerAndEta({ text, target: "risks", label: "Risks" });

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
    });

  } else {
    const text = "Confirm mandatory submission requirements";
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: "Source" });

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
    });
  }

  // Fallback action 2
  {
    const text = "Confirm deadline and submission method";
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: "Source" });

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
    });

  }

  // Fallback action 3
  if (questions.length) {
    const text = "Draft clarifications to the buyer";
    const evidenceQuery = evidenceForAction("questions", text);
    const meta = classifyOwnerAndEta({ text, target: "questions", label: "Clarifications" });

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
    });

  } else if (hasDraftForUi) {
    const text = "Review the tender outline and estimate effort";
    const evidenceQuery = evidenceForAction("draft", text);
    const meta = classifyOwnerAndEta({ text, target: "draft", label: "Tender outline" });

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
    });

    } else {
    const text = "Scan the tender for mandatory forms and formatting";
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: "Source" });

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
		
  const whyLine = useMemo(() => {
    if (!showReady) return "Why: Analyzing requirements, risks, and clarifications.";
    if (verdictState === "hold") return `Why: ${mustItems.length} blockers detected. Review blockers first.`;
    if (verdictState === "caution") {
      const hasHigh = topRisksForPanel.some((r: any) => String(r?.severity ?? "").toLowerCase() === "high");
      if (hasHigh) return "Why: High-severity risk detected. Confirm feasibility before committing.";
      return "Why: Key points need validation before committing.";
    }
    return "Why: No potential blockers detected from MUST requirements.";
  }, [showReady, verdictState, mustItems.length, topRisksForPanel]);

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
      setRenaming(false);
      return;
    }

    setJobDisplayName(jobId, newName);
    setDisplayNameState(newName);
    setRenaming(false);
  }

  function openTabAndScroll(next: "checklist" | "risks" | "questions" | "draft" | "text") {
  setTab(next);
  requestAnimationFrame(() => {
    tabsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}


  function onJumpToSource(query: string) {
    const match = findExcerpt(extractedText, query);

    if (!match) {
      setSourceFocus({ query, snippet: "No matching excerpt found in the source text.", idx: null });
      openTabAndScroll("text");
      return;
    }

    if (match.idx > SOURCE_TEXT_PREVIEW_LIMIT) {
      setShowFullSourceText(true);
    }

    setSourceFocus({ query, snippet: match.snippet, idx: match.idx });
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
      checklist,
      risks,
      questions,
      draftText: draftForUi,
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TenderRay_summary_${jobId}.txt`;
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

    const mustLines = mustItems.length
      ? `<ol>${mustItems.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol>`
      : `<p class="empty">No MUST requirements detected.</p>`;

    const riskLines = risks.length
      ? `<ol>${risks
          .slice(0, 25)
          .map((r: any) => {
            const sevRaw = String(r?.severity ?? r?.level ?? r?.rating ?? "medium").toLowerCase();
            const sev = sevRaw === "high" || sevRaw === "medium" || sevRaw === "low" ? sevRaw : "medium";
            const riskTitle = escapeHtml(pickText(r));
            const detail = escapeHtml(String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim());

            const sevLabel = sev === "high" ? "High" : sev === "low" ? "Low" : "Medium";
            return `
              <li>
                <span class="sev sev-${sev}">${sevLabel}</span>
                <span class="li-title">${riskTitle}</span>
                ${detail ? `<div class="li-detail">${detail}</div>` : ""}
              </li>
            `;
          })
          .join("")}</ol>`
      : `<p class="empty">No risks detected.</p>`;

    const keyFindingsLines = executive.keyFindings?.length
      ? `<ol>${executive.keyFindings.map((t: unknown) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ol>`
      : `<p class="empty">No key findings available.</p>`;

    const nextActionsLines = executive.nextActions?.length
      ? `<ol>${executive.nextActions.map((t: unknown) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ol>`
      : `<p class="empty">No next actions available.</p>`;

    const decisionLine = String(executive.decisionLine ?? "").trim();
    const deadline = executive.submissionDeadline ? escapeHtml(String(executive.submissionDeadline)) : "";

    const verdictLabel =
      verdictState === "hold" ? "Hold – potential blocker" : verdictState === "caution" ? "Proceed with caution" : "Proceed";

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
      .page{ padding-bottom: 18mm; }
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
      .disclaimer{
        margin-top: 14px; border: 1px solid var(--line);
        border-radius: 14px; padding: 10px 12px;
        background: #fff; color: var(--muted); font-size: 11.5px;
      }
      .footer{
        position: fixed; left: 14mm; right: 14mm; bottom: 10mm;
        display:flex; justify-content:space-between;
        color: var(--muted); font-size: 11px;
      }
      .footer span{ white-space: nowrap; }
    </style>
  </head>

  <body>
    <div class="page">
      <div class="header">
        <div>
          <div class="brand">TenderRay</div>
          <div class="docTitle">Tender brief</div>
          <div class="pillRow">
            <span class="pill emph">${escapeHtml(verdictLabel)}</span>
            ${deadline ? `<span class="pill">Submission deadline ${deadline}</span>` : ""}
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
              <div class="subhead">Key findings</div>
              ${keyFindingsLines}
            </div>

            <div class="card" style="background:#fff">
              <div class="subhead">Next actions</div>
              ${nextActionsLines}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>MUST requirements</h2>
          ${mustLines}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>Risks</h2>
          ${riskLines}
        </div>
      </div>

      <div class="disclaimer">
        Drafting support only. Always verify requirements against the original tender documents.
      </div>
    </div>

    <div class="footer">
      <span>TenderRay</span>
      <span>Tender brief</span>
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

        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deadlineText = executive.submissionDeadline ? String(executive.submissionDeadline).trim() : "";

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

          <Button variant="outline" className="rounded-full" onClick={exportTenderBriefPdf} disabled={!canDownload}>
            Export tender brief PDF
          </Button>

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

      {showProgress ? <ProgressCard status={job?.status ?? "processing"} /> : null}

      {/* Go/No-Go (Iteration 1) */}
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Go/No-Go</p>

              {showFailed ? (
                <>
                  <p className="text-sm text-muted-foreground">This tender review could not be completed.</p>
                  <p className="text-xs text-muted-foreground">Re-upload the tender document or try again.</p>
                </>
              ) : !showReady ? (
                <>
                  <p className="text-sm text-muted-foreground">Preparing decision support for this tender…</p>
                  <p className="text-xs text-muted-foreground">This panel populates automatically when processing completes.</p>
                </>
              ) : finalizingResults ? (
                <>
                  <p className="text-sm text-muted-foreground">Finalizing results…</p>
                  <p className="text-xs text-muted-foreground">The job is marked as done, but results are still being written. Refresh in a moment if needed.</p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <VerdictBadge state={verdictState} />
                    <p className="text-sm text-muted-foreground">{verdictMicrocopy(verdictState)}</p>
                  </div>

                  <p className="text-sm text-muted-foreground">{whyLine}</p>

				<div className="mt-3 flex flex-wrap gap-2">
				  <button
					type="button"
					onClick={() => openTabAndScroll("checklist")}
					className={`${pillBase} ${pillTone("blockers")}`}
					aria-label="Open Requirements tab"
				  >
					<span className="font-medium">Blockers</span>
					<span className={`${countBase} ${countTone("blockers")}`}>{mustItems.length}</span>
				  </button>

				  <button
					type="button"
					onClick={() => openTabAndScroll("risks")}
					className={`${pillBase} ${pillTone("risks")}`}
					aria-label="Open Risks tab"
				  >
					<span className="font-medium">Risks</span>
					<span className={`${countBase} ${countTone("risks")}`}>{risks.length}</span>
				  </button>

				  <button
					type="button"
					onClick={() => openTabAndScroll("questions")}
					className={`${pillBase} ${pillTone("questions")}`}
					aria-label="Open Clarifications tab (Open questions)"
				  >
					<span className="font-medium">Open questions</span>
					<span className={`${countBase} ${countTone("questions")}`}>{questions.length}</span>
				  </button>

				  <button
					type="button"
					onClick={() => openTabAndScroll("draft")}
					className={`${pillBase} ${pillTone("outline")}`}
					aria-label="Open Tender outline tab"
				  >
					<span className="font-medium">Outline</span>
					<span className={`${countBase} ${countTone("outline")}`}>
					  {hasDraftForUi ? "Available" : "Not detected"}
					</span>
				  </button>
				</div>

                </>
              )}
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4 md:min-w-[320px]">
              <p className="text-xs font-semibold">Submission deadline</p>
              <p className="mt-1 text-sm">
                {showReady && deadlineText ? <span className="font-medium">{deadlineText}</span> : <span className="text-muted-foreground">Not detected</span>}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Verify on the tender cover page or timeline section.</p>
            </div>
          </div>

          {showReady && !showFailed && !finalizingResults ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Potential blockers */}
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Potential blockers</p>
                      <p className="mt-1 text-xs text-muted-foreground">Items that could block a compliant tender response. Use Jump to verify the source.</p>
                    </div>
                    <Button variant="outline" className="rounded-full" onClick={() => openTabAndScroll("checklist")} disabled={!showReady}>
                      Open Requirements
                    </Button>
                  </div>

                  <Separator className="my-3" />

                  {mustItems.length ? (
                    <>
                      <p className="text-xs text-muted-foreground">MUST requirements detected: {mustItems.length}</p>
                      <div className="mt-3 space-y-2">
						  {mustItems.slice(0, 6).map((x, i) => {
							const meta = classifyBlocker(x);

							return (
							  <div key={i} className="rounded-2xl border bg-background p-3">
								<div className="flex items-start justify-between gap-3">
								  <div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
									  <span className="inline-flex items-center rounded-full border bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">
										{meta.label}
									  </span>
									  <span className="text-[11px] text-muted-foreground">{meta.hint}</span>
									</div>

									<p className="mt-2 text-sm text-muted-foreground leading-relaxed">{x}</p>
								  </div>

								  <Button
									variant="outline"
									className="rounded-full shrink-0"
									onClick={() => onJumpToSource(x)}
									disabled={!extractedText}
								  >
									Jump
								  </Button>
								</div>
							  </div>
							);
						  })}
						</div>

                      {mustItems.length > 6 ? (
                        <p className="mt-2 text-xs text-muted-foreground">Showing top 6. Review all in Requirements.</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">No potential blockers detected from MUST requirements.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Still review eligibility and mandatory forms in the tender.</p>
                    </>
                  )}
                </div>

                {/* Top risks */}
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Top risks</p>
                      <p className="mt-1 text-xs text-muted-foreground">Risks that could derail delivery, cost, or compliance.</p>
                    </div>
                    <Button variant="outline" className="rounded-full" onClick={() => openTabAndScroll("risks")} disabled={!showReady}>
                      Open Risks
                    </Button>
                  </div>

                  <Separator className="my-3" />

									  {topRisksForPanel.length ? (
					  <div className="space-y-2">
						{topRisksForPanel.map((r: any, i: number) => {
						  const sev = String(r?.severity ?? "medium").toLowerCase();
						  const sevLabel = sev === "high" ? "High" : sev === "low" ? "Low" : "Medium";

						  // Outline-only severity chips (don’t compete with Go/No-Go badge)
						  const sevCls =
							sev === "high"
							  ? "border-red-200 text-red-800"
							  : sev === "low"
							  ? "border-muted/60 text-muted-foreground"
							  : "border-amber-200 text-amber-900";

						  const title = String(r?.title ?? "").trim();
						  const detail = String(r?.detail ?? "").trim();
						  const jumpText = detail ? `${title}\n${detail}` : title;
						  const meta = classifyRisk(`${title} ${detail}`.trim());

						  return (
							<div key={i} className="rounded-2xl border bg-background p-3">
							  <div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
								  <div className="flex flex-wrap items-center gap-2">
									<span
									  className={`inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium ${sevCls}`}
									>
									  {sevLabel}
									</span>

									<span className="inline-flex items-center rounded-full border bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">
									  {meta.label}
									</span>

									<span className="text-[11px] text-muted-foreground">{meta.hint}</span>
								  </div>

								  <p className="mt-2 text-sm font-medium">{title || "Risk"}</p>
								  {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
								</div>

								<Button
								  variant="outline"
								  className="rounded-full shrink-0"
								  onClick={() => onJumpToSource(jumpText)}
								  disabled={!extractedText}
								>
								  Jump
								</Button>
							  </div>
							</div>
						  );
						})}
					  </div>
					) : (
					  <>
						<p className="text-sm text-muted-foreground">No risks detected.</p>
						<p className="mt-1 text-xs text-muted-foreground">
						  Scan legal terms, delivery constraints, and submission format in the tender.
						</p>
					  </>
					)}


                </div>
              </div>

              {/* Next actions + key findings */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm font-semibold">Next actions</p>
                  <p className="mt-1 text-xs text-muted-foreground">Do these before writing a full tender response.</p>
                  <Separator className="my-3" />

                  <div className="space-y-2">
                    {nextActionsForUi.map(
                      (
                        a: {
						  text: string;
						  target: ActionTargetTab;
						  label: string;
						  why: string;
						  metric: string;
						  evidenceQuery: string;
						  evidencePreview?: string;
						},

                        i: number
                      ) => (
                        <div
						  key={`${i}-${a.target}-${a.text}`}
						  role="button"
						  tabIndex={0}
						  onClick={() => openTabAndScroll(a.target)}
						  onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
							  e.preventDefault();
							  openTabAndScroll(a.target);
							}
						  }}
						  className="group w-full cursor-pointer rounded-xl border bg-background/60 p-3 text-left transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>

                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                              {i + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{a.text}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{a.why}</p>

								{a.evidencePreview ? (
								  <p className="mt-1 text-xs text-muted-foreground">
									<span className="font-medium text-foreground">Evidence:</span> {a.evidencePreview}
								  </p>
								) : null}

                              <div className="mt-2 flex flex-wrap items-center gap-2">
								  <Badge variant="secondary" className="rounded-full">
									{a.label}
								  </Badge>

								  <Badge variant="outline" className="rounded-full text-muted-foreground">
									{a.metric}
								  </Badge>

								  <Badge variant="outline" className="rounded-full text-muted-foreground">
									Owner: <span className="ml-1 text-foreground font-medium">{(a as any).owner}</span>
								  </Badge>

								  <Badge variant="outline" className="rounded-full text-muted-foreground">
									Time: <span className="ml-1 text-foreground font-medium">{(a as any).eta}</span>
								  </Badge>
								</div>

                            </div>

                            <div className="shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onJumpToSource(a.evidenceQuery);
                                }}
                                disabled={!extractedText}
                              >
                                Evidence
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Tip: click an action to jump to the relevant tab. “Evidence” opens Source and highlights the excerpt used.
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm font-semibold">Key findings</p>
                  <p className="mt-1 text-xs text-muted-foreground">Useful context from the tender, not urgent for the go/no-go decision.</p>
                  <Separator className="my-3" />

                  {executive.keyFindings?.length ? (
					  <ul className="space-y-2">
						{executive.keyFindings.slice(0, 7).map((x: string, i: number) => {
						  const raw = String(x ?? "").replace(/\s+/g, " ").trim();
						  const evidenceQuery = raw.length > 240 ? raw.slice(0, 239) + "…" : raw;

						  return (
							<li key={i} className="flex items-start justify-between gap-3">
							  <div className="min-w-0 flex-1">
								<p className="text-sm text-muted-foreground leading-relaxed">
								  <span className="mr-2">•</span>
								  {x}
								</p>
							  </div>

							  <Button
								variant="secondary"
								size="sm"
								className="h-7 shrink-0 rounded-full px-3 text-xs transition hover:bg-background hover:border-foreground/20 hover:shadow-sm hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								onClick={(e) => {
								  e.preventDefault();
								  onJumpToSource(evidenceQuery);
								}}
								disabled={!extractedText}
								aria-label={`Show evidence for key finding ${i + 1}`}
							  >
								Evidence
							  </Button>
							</li>
						  );
						})}
					  </ul>
					) : (
					  <p className="text-sm text-muted-foreground">No key findings detected.</p>
					)}

                </div>
              </div>

              {String(executive.decisionLine ?? "").trim() ? (
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs font-semibold">Executive note</p>
                  <p className="mt-1 text-sm text-muted-foreground">{String(executive.decisionLine).trim()}</p>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Drafting support only. Always verify requirements and legal language against the original tender documents.
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
      <div ref={tabsTopRef} />

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
          <TabsTrigger value="text" className="rounded-full">
            Source text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist">
          <div className="flex items-center justify-end gap-2">
			  <Button
				variant="outline"
				className="rounded-full"
				onClick={async () => {
				  if (!canDownload) return;
				  const text = `${clarificationsPack.subject}\n\n${clarificationsPack.intro}${clarificationsPack.body}\n`;
				  const ok = await safeCopy(text);
				  if (ok) {
					setCopiedSection("clarifications_ready");
					window.setTimeout(() => setCopiedSection(null), 1200);
				  }
				}}
				disabled={!canDownload || !questions.length}
			  >
				{copiedSection === "clarifications_ready" ? "Copied" : "Copy ready-to-send"}
			  </Button>

			  <Button variant="outline" className="rounded-full" onClick={() => copySection("clarifications")} disabled={!canDownload}>
				{copiedSection === "clarifications" ? "Copied" : "Copy raw list"}
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
              <Checklist checklist={checklist} extractedText={extractedText} onJumpToSource={onJumpToSource} />
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
              <Risks risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} />
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
          <div className="flex items-center justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => copySection("clarifications")} disabled={!canDownload}>
              {copiedSection === "clarifications" ? "Copied" : "Copy section"}
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
                  <p className="text-sm font-semibold">Generating clarifications</p>
                  <p className="mt-1 text-sm text-muted-foreground">We&apos;re listing buyer questions and ambiguities to resolve before committing to a tender response.</p>
                </CardContent>
              </Card>
            ) : finalizingResults ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Finalizing results…</p>
                  <p className="mt-1 text-sm text-muted-foreground">The job is marked as done, but results are still being written. Please wait a few seconds or refresh.</p>
                </CardContent>
              </Card>
            ) : questions.length ? (
			  <>
				<Card className="rounded-2xl">
				  <CardContent className="p-6 space-y-3">
					<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
					  <div>
						<p className="text-sm font-semibold">Ready-to-send clarifications</p>
						<p className="mt-1 text-sm text-muted-foreground">
						  Copy into an email or the buyer Q&amp;A portal. Prioritized as P1 (urgent) and P2 (nice-to-have).
						</p>
					  </div>
					  <Button
						variant="outline"
						className="rounded-full"
						onClick={async () => {
						  const text = `${clarificationsPack.subject}\n\n${clarificationsPack.intro}${clarificationsPack.body}\n`;
						  const ok = await safeCopy(text);
						  if (ok) {
							setCopiedSection("clarifications_ready");
							window.setTimeout(() => setCopiedSection(null), 1200);
						  }
						}}
						disabled={!questions.length}
					  >
						{copiedSection === "clarifications_ready" ? "Copied" : "Copy ready-to-send"}
					  </Button>
					</div>

					<Separator />

					<div className="rounded-2xl border bg-muted/20 p-4">
					  <p className="text-xs font-semibold">Subject</p>
					  <p className="mt-1 text-sm">{clarificationsPack.subject}</p>

					  <p className="mt-4 text-xs font-semibold">Body</p>
					  <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
						{clarificationsPack.intro}
						{clarificationsPack.body}
					  </pre>
					</div>

					<p className="text-xs text-muted-foreground">
					  Tip: Send P1 items first if the deadline is close. Always verify wording against the tender source text.
					</p>
				  </CardContent>
				</Card>

				<div className="mt-4">
				  <BuyerQuestions checklist={checklist} risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} questions={questions} />
				</div>
			  </>
			) : (

              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">No clarifications identified</p>
                  <p className="mt-1 text-sm text-muted-foreground">We didn&apos;t detect explicit buyer questions or ambiguities. Double-check eligibility, scope boundaries, and submission format in the source text.</p>
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
                <pre className="text-sm whitespace-pre-wrap">{draftLinesForUi.join("\n")}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">No draft outline was generated. Try re-uploading the PDF or verify the source text tab.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          {sourceFocus ? (
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Focused excerpt</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Match for: <span className="font-medium text-foreground">{sourceFocus.query}</span>
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-full" onClick={() => setSourceFocus(null)}>
                    Clear
                  </Button>
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
						if (!sourceFocus?.idx && sourceFocus?.idx !== 0) {
						  return visibleText || "No source text yet.";
						}

						const idx = sourceFocus.idx ?? 0;
						if (idx < 0 || idx >= visibleText.length) {
						  return visibleText || "No source text yet.";
						}

						const lineStartIdx = visibleText.lastIndexOf("\n", idx);
						const start = lineStartIdx === -1 ? 0 : lineStartIdx + 1;

						const lineEndIdx = visibleText.indexOf("\n", idx);
						const end = lineEndIdx === -1 ? visibleText.length : lineEndIdx;

						const before = visibleText.slice(0, start);
						const mid = visibleText.slice(start, end);
						const after = visibleText.slice(end);

						return (
						  <>
							{before}
							<span
							  ref={sourceAnchorRef}
							  className="block whitespace-pre rounded-md bg-yellow-200/50 px-2 py-1 border-l-4 border-yellow-500"
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
