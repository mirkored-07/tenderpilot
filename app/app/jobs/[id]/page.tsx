"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { stableRefKey } from "@/lib/bid-workflow/keys";
import { getJobDisplayName, setJobDisplayName, clearJobDisplayName } from "@/lib/pilot-job-names";

import { track } from "@/lib/telemetry";
import { canExportForProfile } from "@/lib/billing-entitlements";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppI18n } from "../../_components/app-i18n-provider";
import { JobPageFeedback } from "./_components/job-page-feedback";
import { JobPageHeader } from "./_components/job-page-header";
import { JobPageReferencePanels } from "./_components/job-page-reference-panels";
import { JobPageSourceViewer } from "./_components/job-page-source-viewer";
import { FailedStatePanel } from "./_components/job-status-panels";

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

  // Playbook (workspace policy) signals written by process-job (if configured)
  playbook_version: number | null;
  policy_triggers: any | null;

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

type DbJobMetadata = {
  job_id: string;
  deadline_override: string | null;
  portal_url: string | null;
  internal_bid_id: string | null;
  owner_label: string | null;
  decision_override: string | null;
  target_decision_at: string | null;
  updated_at: string;
};


type ActionTargetTab = "text" | "checklist" | "risks" | "questions" | "draft";

type ChecklistItem = {
  kind?: string | null;
  type?: string | null;
  level?: string | null;
  priority?: string | null;
  text?: string | null;
  requirement?: string | null;
  title?: string | null;
  source?: string | null;
  evidence_ids?: string[] | null;
  evidenceIds?: string[] | null;
  evidence?: string[] | null;
  [key: string]: any;
};

type RiskItem = {
  severity?: string | null;
  level?: string | null;
  rating?: string | null;
  title?: string | null;
  risk?: string | null;
  text?: string | null;
  detail?: string | null;
  description?: string | null;
  why_it_matters?: string | null;
  why?: string | null;
  impact?: string | null;
  mitigation?: string | null;
  evidence_ids?: string[] | null;
  evidenceIds?: string[] | null;
  evidence?: string[] | null;
  [key: string]: any;
};

// Alias to the existing UI candidate type used in this file
type EvidenceCandidate = EvidenceCandidateUi;

function stripMarkdown(input: string): string {
  const s = String(input ?? "");
  if (!s) return "";

  // Remove fenced code blocks
  let out = s.replace(/```[\s\S]*?```/g, "");

  // Replace markdown links [text](url) -> text
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // Remove inline code
  out = out.replace(/`([^`]+)`/g, "$1");

  // Remove emphasis markers
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");

  // Remove headings and blockquotes
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "");

  // Remove list bullets at start of line
  out = out.replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+\.\s+/gm, "");

  return out;
}

function evidenceExcerptFor(query: string, extractedText: string): string | null {
  const q = String(query ?? "").trim();
  const txt = String(extractedText ?? "");
  if (!q || !txt) return null;

  const match = findExcerpt(txt, q);
  const snip = match?.snippet ? String(match.snippet).replace(/\s+/g, " ").trim() : "";
  if (!snip) return null;

  return snip.length > 420 ? snip.slice(0, 420).trimEnd() + "…" : snip;
}

function classifyNextAction(
  actionText: string,
  tx?: (key: string, vars?: Record<string, string | number>) => string
): { target: ActionTargetTab; label: string; why: string } {
  const raw = String(actionText ?? "");
  const t = raw.toLowerCase();

  const pick = (key: string, fallback: string) => {
    if (!tx) return fallback;
    const v = tx(key);
    if (!v || v === key) return fallback;
    return v;
  };

  // Clarifications / questions
  if (t.includes("clarif") || t.includes("question") || t.includes("ask") || t.includes("inquir")) {
    return {
      target: "questions",
      label: pick("app.exports.tenderBrief.sections.clarifications", "Clarifications"),
      why: pick("app.review.nextActionWhy.clarifications", "Resolve unknowns early to reduce bid risk."),
    };
  }

  // Risks
  if (t.includes("risk") || t.includes("mitigat") || t.includes("exposure")) {
    return {
      target: "risks",
      label: pick("app.review.sections.strategicRisks", "Risks"),
      why: pick("app.review.nextActionWhy.risks", "Validate impact and mitigation before committing."),
    };
  }

  // Draft / outline
  if (t.includes("draft") || t.includes("outline") || t.includes("proposal") || t.includes("write") || t.includes("section")) {
    return {
      target: "draft",
      label: pick("app.review.labels.tenderOutline", "Tender outline"),
      why: pick("app.review.nextActionWhy.outline", "Use the outline to estimate effort and assign owners."),
    };
  }

  // Requirements / compliance
  if (t.includes("must") || t.includes("mandatory") || t.includes("eligib") || t.includes("requirement") || t.includes("compliance")) {
    return {
      target: "checklist",
      label: pick("app.review.sections.blockers", "Blockers"),
      why: pick("app.review.nextActionWhy.blockers", "Confirm mandatory requirements before investing in the response."),
    };
  }

  // Source / submission mechanics
  return {
    target: "text",
    label: pick("app.review.source.sectionTitle", "Source"),
    why: pick("app.review.nextActionWhy.source", "Verify submission rules directly in the tender text."),
  };
}

function buildRationaleDrivers(args: {
  verdict: VerdictState;
  mustItems: string[];
  risksCount: number;
  clarificationsCount: number;
  coverage: "none" | "partial" | "full";
  confidence: "high" | "medium" | "low";
  t?: (key: string, vars?: Record<string, string | number>) => string;
}): string[] {
  const tx = args.t;

  const coverageLabel = tx ? tx("app.exports.tenderBrief.meta.coverage") : "Coverage";
  const confidenceLabel = tx ? tx("app.exports.tenderBrief.meta.confidence") : "Confidence";

  const out: string[] = [];
  const pickText = (key: string, fallback: string, vars?: Record<string, string | number>) => {
    if (!tx) return fallback;
    const value = tx(key, vars);
    return value && value !== key ? value : fallback;
  };

  out.push(`${coverageLabel}: ${String(args.coverage).toUpperCase()}`);
  out.push(`${confidenceLabel}: ${String(args.confidence).toUpperCase()}`);

  // One truthful “driver” line (re-uses existing copy keys where available)
  if (args.verdict === "no-go") {
    out.push("Decision drivers: hard stop identified in the tender evidence. Do not proceed unless the buyer has formally reopened or extended the opportunity.");
  } else if (args.mustItems?.length) out.push(pickText("app.review.drivers.hold", "Decision drivers: mandatory requirements and submission rules that can disqualify you."));
  else if (args.risksCount >= 3) out.push(pickText("app.review.drivers.caution", "Decision drivers: risks requiring validation before committing."));
  else out.push(pickText("app.review.drivers.go", "No mandatory blockers detected in eligibility and submission requirements."));

  // Counts (use existing metric keys where possible)
  out.push(pickText("app.review.metrics.risks", `${args.risksCount} risks`, { count: args.risksCount }));
  out.push(pickText("app.review.metrics.questions", `${args.clarificationsCount} questions`, { count: args.clarificationsCount }));

  return out.filter((x) => String(x ?? "").trim()).slice(0, 5);
}


type VerdictState = "proceed" | "caution" | "hold" | "no-go";
type AnalysisTab = "text";


/** UI safety: cap initial source-text render to avoid freezing on huge extractions */
const SOURCE_TEXT_PREVIEW_LIMIT = 20_000;

function normalizeDecisionText(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isUseExtractedDecisionOverride(v: unknown): boolean {
  const t = normalizeDecisionText(String(v ?? ""));
  // Treat sentinel UI values as "no override"
  if (!t) return true;
  if (t === "extracted") return true;
  if (t.includes("use extracted")) return true;
  if (t.includes("extracted decision")) return true;
  if (t.startsWith("(") && t.includes("extracted")) return true;
  return false;
}

function decisionBucket(raw: string): "go" | "hold" | "no-go" | "unknown" {
  const t = normalizeDecisionText(raw);

  // Order matters: check no-go first so "go/no-go" doesn't classify as "go"
  const isNoGo =
    /\b(no[-\s]?go|nogo|do\s+not\s+(bid|proceed|submit)|not\s+(bid|proceed|submit)|reject|decline|withdraw)\b/.test(t);
  if (isNoGo) return "no-go";

  // Treat "Proceed with caution" as Hold (caution state)
  const isHold =
    /\b(hold|caution|clarif(y|ication)|verify|pending|tbd|conditional|depends|review)\b/.test(t) ||
    t.includes("proceed with caution");
  if (isHold) return "hold";

  const isGo = /\b(go|proceed|bid|submit)\b/.test(t);
  if (isGo) return "go";

  return "unknown";
}

function isDoneWorkStatus(s: unknown): boolean {
  const v = String(s ?? "").toLowerCase().trim();
  return v === "done" || v === "completed" || v === "closed";
}

function isBlockedWorkStatus(s: unknown): boolean {
  const v = String(s ?? "").toLowerCase().trim();
  return v === "blocked";
}

function isActionableWorkStatus(s: unknown): boolean {
  const v = String(s ?? "").toLowerCase().trim();
  return v === "todo" || v === "doing" || v === "in_progress" || v === "in-progress";
}

function isMustKind(rawKind: unknown): boolean {
  const t = String(rawKind ?? "").toLowerCase();
  return t.includes("must") || t.includes("mandatory") || t.includes("shall") || t.includes("required");
}


function VerdictBadge({ state }: { state: VerdictState }) {
  const { t } = useAppI18n();
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs";
  if (state === "proceed") {
    return (
      <span className={`${base} border-green-200 bg-green-50 text-green-800 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200`}>
        {t("app.decision.go")}
      </span>
    );
  }
  if (state === "hold") {
    return (
      <span className={`${base} border-red-200 bg-red-50 text-red-800 dark:border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-200`}>
        {t("app.decision.hold")}
      </span>
    );
  }
  return (
    <span className={`${base} border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200`}>
      {t("app.decision.go")}
    </span>
  );
}

function classifyClarification(text: string, tx?: (key: string, vars?: Record<string, string | number>) => string): { category: string; priority: "P1" | "P2"; hint: string } {
  const t = String(text ?? "").toLowerCase();
  const pick = (key: string) => (tx ? tx(key) : key);

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
    return { category: pick("app.review.clarifications.categories.submission"), priority: isP1 ? "P1" : "P2", hint: pick("app.review.clarifications.hints.submission") };
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
    return { category: pick("app.review.clarifications.categories.eligibility"), priority: "P1", hint: pick("app.review.clarifications.hints.eligibility") };
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
    return { category: pick("app.review.clarifications.categories.commercial"), priority: isP1 ? "P1" : "P2", hint: pick("app.review.clarifications.hints.commercial") };
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
    return { category: pick("app.review.clarifications.categories.legal"), priority: isP1 ? "P1" : "P2", hint: pick("app.review.clarifications.hints.legal") };
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
    return { category: pick("app.review.clarifications.categories.delivery"), priority: isP1 ? "P1" : "P2", hint: pick("app.review.clarifications.hints.delivery") };
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
    return { category: pick("app.review.clarifications.categories.scope"), priority: isP1 ? "P1" : "P2", hint: pick("app.review.clarifications.hints.scope") };
  }

  return { category: pick("app.review.clarifications.categories.general"), priority: isP1 ? "P1" : "P2", hint: pick("app.review.clarifications.hints.general") };
}

function buildReadyToSendClarifications(args: { tenderName: string; questions: string[]; tx?: (key: string, vars?: Record<string, string | number>) => string }) {
  const tx = args.tx;
  const pick = (key: string, fallback?: string) => {
    if (tx) {
      const v = tx(key);
      if (fallback && (v === key || !String(v).trim())) return fallback;
      return v;
    }
    return fallback ?? key;
  };
  const tenderName = String(args.tenderName ?? "").trim() || (tx ? tx("app.tender.label") : "Tender");
  const raw = (args.questions ?? []).map((q) => String(q ?? "").trim()).filter(Boolean);

  const items = raw.map((q) => ({ q, meta: classifyClarification(q, tx) }));

  const order = [
    pick("app.review.clarifications.categories.submission"),
    pick("app.review.clarifications.categories.eligibility"),
    pick("app.review.clarifications.categories.commercial"),
    pick("app.review.clarifications.categories.legal"),
    pick("app.review.clarifications.categories.delivery"),
    pick("app.review.clarifications.categories.scope"),
    pick("app.review.clarifications.categories.general"),
  ];

  const grouped = order
    .map((cat) => ({
      cat,
      items: items.filter((x) => x.meta.category === cat).sort((a, b) => (a.meta.priority === b.meta.priority ? 0 : a.meta.priority === "P1" ? -1 : 1)),
    }))
    .filter((g) => g.items.length);

  const subject = (tx ? tx("app.review.clarifications.email.subject") : "app.review.clarifications.email.subject").replace("{tender}", tenderName);
  const intro = pick("app.review.clarifications.email.intro", `Hello,

We are preparing our tender response and would appreciate clarification on the points below.
Thank you.

`);

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



function summarizeEventMessage(msg?: string | null) {
  const raw = String(msg ?? "").trim();
  if (!raw) return "";
  // Remove overly-technical prefixes if present
  const cleaned = raw
    .replace(/^process-job\s*:?\s*/i, "")
    .replace(/^jobs\.pipeline\.[^:]+:\s*/i, "")
    .replace(/^pipeline\s*:?\s*/i, "")
    .trim();
  // Keep it short and UI-friendly
  if (cleaned.length > 160) return cleaned.slice(0, 160).trimEnd() + "…";
  return cleaned;
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

function statusBadge(status: JobStatus, t: (key: string) => string) {
  if (status === "done") return <Badge className="rounded-full">{t("app.common.ready")}</Badge>;
  if (status === "failed")
    return (
      <Badge variant="destructive" className="rounded-full">
        {t("app.common.needsAttention")}
      </Badge>
    );
  if (status === "queued")
    return (
      <Badge variant="secondary" className="rounded-full">
        {t("app.review.progress.gettingStarted")}
      </Badge>
    );
  return (
    <Badge variant="secondary" className="rounded-full">
      {t("app.review.progress.workingShort")}
    </Badge>
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

type PolicyTriggerUi = {
  key: string;
  impact: string;
  note: string;
  rule?: string | null;
  timestamp?: string | null;
};

function normalizePolicyTriggers(raw: any): PolicyTriggerUi[] {
  if (!raw) return [];

  let v: any = raw;

  // Some environments store JSON as a string — tolerate it.
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      v = JSON.parse(s);
    } catch {
      return [];
    }
  }

  const arr: any[] = Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : [];

  return (Array.isArray(arr) ? arr : [])
    .map((t: any) => {
      const key = String(t?.key ?? t?.id ?? "").trim();
      const impact = String(t?.impact ?? t?.severity ?? t?.level ?? "").trim();
      const note = String(t?.note ?? t?.detail ?? t?.text ?? "").trim();
      const rule = t?.rule != null ? String(t.rule).trim() : null;
      const timestamp =
        t?.timestamp != null
          ? String(t.timestamp).trim()
          : t?.created_at != null
          ? String(t.created_at).trim()
          : null;

      return { key, impact, note, rule, timestamp } as PolicyTriggerUi;
    })
    .filter((tr: PolicyTriggerUi) => Boolean(tr.key || tr.note));
}

function policyKeyLabel(key: string) {
  const k = String(key ?? "").trim();
  if (!k) return "Policy";

  const map: Record<string, string> = {
    industry_tags: "Industry fit",
    offerings_summary: "Offerings fit",
    delivery_geographies: "Delivery geographies",
    languages_supported: "Languages supported",
    delivery_modes: "Delivery modes",
    capacity_band: "Capacity / sizing",
    typical_lead_time_weeks: "Lead time",
    certifications: "Certifications",
    non_negotiables: "Non-negotiables",
  };

  const hit = map[k];
  if (hit) return hit;

  return k
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function policyImpactMeta(impact: string, t: (key: string) => string) {
  const v = String(impact ?? "").trim().toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold";

  if (v === "blocks") {
    return {
      label: t("app.policyTriggers.impact.blocker"),
      className: `${base} border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-200`,
    };
  }

  if (v === "increases_risk") {
    return {
      label: t("app.policyTriggers.impact.risk"),
      className: `${base} border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200`,
    };
  }

  if (v === "requires_clarification") {
    return {
      label: t("app.policyTriggers.impact.clarify"),
      className: `${base} border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-200`,
    };
  }

  if (v === "decreases_fit") {
    return {
      label: t("app.policyTriggers.impact.fit"),
      className: `${base} border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-200`,
    };
  }

  return {
    label: impact ? policyKeyLabel(impact) : t("app.policyTriggers.impact.info"),
    className: `${base} border-border bg-muted/30 text-foreground/80`,
  };
}

function policyTriggerTitle(t: PolicyTriggerUi) {
  const rule = String(t?.rule ?? "").trim();
  if (rule && rule.length <= 80) return rule;
  return policyKeyLabel(String(t?.key ?? ""));
}

function toExecutiveModel(args: { raw: any }) {
  const { raw } = args;

  const decisionBadge = String(raw?.finalDecisionBadge ?? raw?.decisionBadge ?? raw?.decision ?? "").trim();
  const llmDecisionBadge = String(raw?.llmDecisionBadge ?? "").trim();
  const finalDecisionBadge = String(raw?.finalDecisionBadge ?? raw?.decisionBadge ?? "").trim();
  const decisionSource = String(raw?.decisionSource ?? "").trim();
  const decisionLine = String(raw?.decisionLine ?? "").trim();

  const keyFindings = Array.isArray(raw?.keyFindings) ? raw.keyFindings : [];
  const nextActions = Array.isArray(raw?.nextActions) ? raw.nextActions : [];
  const topRisks = Array.isArray(raw?.topRisks) ? raw.topRisks : [];
  const hardBlockers = Array.isArray(raw?.hard_blockers) ? raw.hard_blockers : [];
  const hardStopReasons = Array.isArray(raw?.hardStopReasons) ? raw.hardStopReasons : [];

  const submissionDeadline = raw?.submissionDeadline ? String(raw.submissionDeadline).trim() : "";
  const submissionDeadlineIso = raw?.submissionDeadlineIso ? String(raw.submissionDeadlineIso).trim() : "";
  const tenderStatus = raw?.tenderStatus ? String(raw.tenderStatus).trim() : "";

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

  const normalizedHardBlockers = hardBlockers
    .slice(0, 5)
    .map((item: any) => ({
      title: String(item?.title ?? item?.detail ?? "").trim(),
      detail: String(item?.detail ?? "").trim(),
      evidenceIds: Array.isArray(item?.evidence_ids)
        ? item.evidence_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : [],
    }))
    .filter((item: any) => item.title);

  return {
    decisionBadge: decisionBadge || "Hold",
    llmDecisionBadge: llmDecisionBadge || undefined,
    finalDecisionBadge: finalDecisionBadge || undefined,
    decisionSource: decisionSource || undefined,
    decisionLine,
    keyFindings: keyFindings.slice(0, 7).map((x: any) => String(x ?? "").trim()).filter(Boolean),
    nextActions: nextActions.slice(0, 3).map((x: any) => String(x ?? "").trim()).filter(Boolean),
    topRisks: normalizedTopRisks,
    hardBlockers: normalizedHardBlockers,
    hardStopReasons: hardStopReasons.slice(0, 4).map((x: any) => String(x ?? "").trim()).filter(Boolean),
    submissionDeadline,
    submissionDeadlineIso: submissionDeadlineIso || undefined,
    tenderStatus: tenderStatus || undefined,
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
  fileName: string;
  createdAt: string;
  verdictLabel: string;
  decisionLine: string;
  rationaleSnapshot: string[];
  recommendedAction: string;
  whereToVerify: string;
  checklist: ChecklistItem[];
  risks: RiskItem[];
  questions: string[];
  draftText: string;
  evidenceById: Map<string, EvidenceCandidate>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { t } = args;

  const lines: string[] = [];
  const pageLabel = t("app.review.source.pageLabel");
  const evidenceLabel = t("app.exports.tenderBrief.evidence.label");
  const pageUnknown = t("app.exports.tenderBrief.evidence.pageUnknown");

  const sevLabel = (sev?: string) => {
    const s = String(sev ?? "medium").toLowerCase();
    if (s === "high") return t("app.exports.tenderBrief.severity.high");
    if (s === "low") return t("app.exports.tenderBrief.severity.low");
    return t("app.exports.tenderBrief.severity.medium");
  };

  const strip = (x: any) => stripMarkdown(String(x ?? "")).replace(/\s+/g, " ").trim();

  function renderEvidenceLines(ids?: string[], max = 3) {
    const out: string[] = [];
    const safe = Array.isArray(ids) ? ids.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
    if (!safe.length) return out;

    for (const id of safe.slice(0, max)) {
      const ev = args.evidenceById.get(id);
      const pageText = ev?.page === null || ev?.page === undefined ? pageUnknown : `${pageLabel} ${ev.page}`;
      out.push(`${evidenceLabel} ${id} • ${pageText}`);
      if (ev?.excerpt) out.push(strip(ev.excerpt).slice(0, 220));
    }

    if (safe.length > max) out.push(t("app.exports.textSummary.moreEvidence", { count: safe.length - max }));
    return out;
  }

  function buildBuyerEmail(questions: string[]) {
    if (!questions.length) return "";
    const name = args.fileName || t("app.tender.single");
    const subject = t("app.exports.tenderBrief.buyerEmail.subject", { name });
    const subjectLabel = t("app.exports.tenderBrief.buyerEmail.subjectLabel");
    const greeting = t("app.exports.tenderBrief.buyerEmail.greeting");
    const intro = t("app.exports.tenderBrief.buyerEmail.intro");
    const thanks = t("app.exports.tenderBrief.buyerEmail.thanks");

    const out: string[] = [];
    out.push(`${subjectLabel}: ${subject}`);
    out.push("");
    out.push(greeting);
    out.push("");
    out.push(intro);
    out.push("");
    questions.slice(0, 40).forEach((q, i) => out.push(`${i + 1}. ${q}`));
    out.push("");
    out.push(thanks);
    return out.join("\n");
  }

  lines.push(t("app.exports.textSummary.title"));
  lines.push("");

  lines.push(`${t("app.exports.textSummary.meta.file")}: ${args.fileName || t("app.tender.single")}`);
  lines.push(`${t("app.exports.textSummary.meta.created")}: ${formatDate(args.createdAt)}`);
  lines.push(`${t("app.exports.textSummary.meta.decision")}: ${args.verdictLabel}`);
  lines.push("");

  lines.push(`${t("app.exports.textSummary.sections.why")}:`);
  lines.push(args.decisionLine || t("app.common.unknown"));
  if (args.rationaleSnapshot?.length) {
    for (const x of args.rationaleSnapshot.slice(0, 8)) lines.push(`• ${strip(x)}`);
  }
  lines.push("");

  lines.push(`${t("app.exports.textSummary.sections.recommendedAction")}: ${args.recommendedAction}`);
  lines.push("");
  lines.push(`${t("app.exports.textSummary.sections.whereToVerify")}: ${args.whereToVerify}`);
  lines.push("");

  const must = (args.checklist ?? []).filter((x) => String((x as any)?.kind ?? "").toUpperCase() === "MUST");
  const should = (args.checklist ?? []).filter((x) => String((x as any)?.kind ?? "").toUpperCase() === "SHOULD");
  const info = (args.checklist ?? []).filter((x) => String((x as any)?.kind ?? "").toUpperCase() === "INFO");

  const renderChecklist = (titleKey: string, items: ChecklistItem[], emptyText: string) => {
    lines.push(t(titleKey));
    if (!items.length) {
      lines.push(emptyText);
      lines.push("");
      return;
    }
    for (const it of items.slice(0, 40)) {
      const title = strip((it as any)?.text ?? (it as any)?.title ?? "");
      if (title) lines.push(`• ${title}`);
      const evIds = (it as any)?.evidence_ids as string[] | undefined;
      renderEvidenceLines(evIds, 2).forEach((l) => lines.push(`  ${l}`));
    }
    lines.push("");
  };

  renderChecklist("app.exports.textSummary.sections.mustBlockers", must, t("app.exports.tenderBrief.empty.noMustBlockers"));
  renderChecklist("app.exports.textSummary.sections.shouldItems", should, t("app.exports.textSummary.empty.noShouldItems"));
  renderChecklist("app.exports.textSummary.sections.infoItems", info, t("app.exports.textSummary.empty.noInfoItems"));

  lines.push(t("app.exports.textSummary.sections.risks"));
  if (!args.risks?.length) {
    lines.push(t("app.exports.tenderBrief.empty.noRisks"));
    lines.push("");
  } else {
    for (const r of args.risks.slice(0, 30)) {
      const title = strip((r as any)?.title ?? "");
      const why = strip((r as any)?.why_it_matters ?? (r as any)?.why ?? "");
      const sev = sevLabel((r as any)?.severity);
      lines.push(`• ${sev}: ${title}${why ? `: ${why}` : ""}`);
      const evIds = (r as any)?.evidence_ids as string[] | undefined;
      renderEvidenceLines(evIds, 2).forEach((l) => lines.push(`  ${l}`));
    }
    lines.push("");
  }

  lines.push(t("app.exports.textSummary.sections.clarifications"));
  if (!args.questions?.length) {
    lines.push(t("app.exports.tenderBrief.empty.noClarifications"));
    lines.push("");
  } else {
    lines.push(t("app.exports.textSummary.sections.readyToSendEmail"));
    lines.push(buildBuyerEmail(args.questions));
    lines.push("");
    lines.push(t("app.exports.textSummary.sections.rawList"));
    args.questions.slice(0, 40).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");
  }

  lines.push(t("app.exports.textSummary.sections.tenderOutline"));
  if (!args.draftText?.trim()) {
    lines.push(t("app.exports.tenderBrief.empty.noOutline"));
  } else {
    lines.push(strip(args.draftText));
  }
  lines.push("");
  lines.push(t("app.common.draftingSupport"));

  return lines.join("\n");
}

function classifyOwnerAndEta(args: {
  text: string;
  target: ActionTargetTab;
  label: string;
  tx?: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const text = String(args.text ?? "").toLowerCase();
  const tx = args.tx;

  // Default mapping by target (simple + predictable)
  let ownerKey: "bidManager" | "salesOps" | "proposalLead" | "legal" | "engineering" =
    args.target === "questions"
      ? "bidManager"
      : args.target === "checklist"
        ? "salesOps"
        : args.target === "risks"
          ? "legal"
          : args.target === "draft"
            ? "proposalLead"
            : "bidManager"; // "text" (source) defaults to Bid Manager

  // Keyword overrides (more accurate)
  if (
    text.includes("legal") ||
    text.includes("liability") ||
    text.includes("indemn") ||
    text.includes("contract") ||
    text.includes("jurisdiction") ||
    text.includes("gdpr") ||
    text.includes("data protection") ||
    text.includes("ip ") ||
    text.includes("intellectual property")
  ) {
    ownerKey = "legal";
  }

  if (
    text.includes("scope") ||
    text.includes("technical") ||
    text.includes("specification") ||
    text.includes("integration") ||
    text.includes("interface") ||
    text.includes("delivery") ||
    text.includes("timeline") ||
    text.includes("schedule") ||
    text.includes("sla")
  ) {
    // Keep Legal override if it was set above
    if (ownerKey !== "legal") ownerKey = "engineering";
  }

  if (
    text.includes("certificate") ||
    text.includes("registration") ||
    text.includes("tax") ||
    text.includes("company") ||
    text.includes("mandatory") ||
    text.includes("must") ||
    text.includes("forms") ||
    text.includes("appendix") ||
    text.includes("appendices")
  ) {
    if (ownerKey !== "legal" && ownerKey !== "engineering") ownerKey = "salesOps";
  }

  // Time estimate (by target, with a couple of keyword nudges)
  let etaKey: "min2to5" | "min10to20" | "min10to30" | "min15to30" =
    args.target === "text"
      ? "min2to5"
      : args.target === "checklist"
        ? "min10to20"
        : args.target === "risks"
          ? "min10to20"
          : args.target === "questions"
            ? "min10to30"
            : "min15to30"; // draft

  if (args.target === "text" && (text.includes("submission") || text.includes("deadline") || text.includes("portal") || text.includes("format"))) {
    etaKey = "min2to5";
  }

  const ownerFallback: Record<typeof ownerKey, string> = {
    bidManager: "Bid Manager",
    salesOps: "Sales Ops",
    proposalLead: "Proposal Lead",
    legal: "Legal",
    engineering: "Engineering",
  };

  const etaFallback: Record<typeof etaKey, string> = {
    min2to5: "2–5 min",
    min10to20: "10–20 min",
    min10to30: "10–30 min",
    min15to30: "15–30 min",
  };

  const owner = tx ? tx(`app.review.roles.${ownerKey}`) : ownerFallback[ownerKey];
  const eta = tx ? tx(`app.review.eta.${etaKey}`) : etaFallback[etaKey];

  return { owner, eta };
}

function classifyDoneWhen(args: {
  text: string;
  target: ActionTargetTab;
  label: string;
  tx?: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const text = String(args.text ?? "").toLowerCase();
  const tx = args.tx;
  const pick = (key: string, fallback?: string) => {
    if (tx) {
      const v = tx(key);
      if (fallback && (v === key || !String(v).trim())) return fallback;
      return v;
    }
    return fallback ?? key;
  };

  // Keep it operational and verifiable (no AI claims).
  if (args.target === "checklist") {
    return pick(
      "app.review.doneWhen.checklist",
      "Done when: requirement wording is verified in portal/PDF and any mandatory form/template is identified."
    );
  }
  if (args.target === "questions") {
    return pick(
      "app.review.doneWhen.questions",
      "Done when: buyer question is drafted and either answered in the tender or queued to send."
    );
  }
  if (args.target === "risks") {
    return pick(
      "app.review.doneWhen.risks",
      "Done when: risk impact/mitigation is agreed (accept, mitigate, or escalate) and evidence is noted."
    );
  }
  if (args.target === "draft") {
    return pick(
      "app.review.doneWhen.draft",
      "Done when: outline is reviewed and owners are assigned to each major section."
    );
  }

  // Source (submission/deadline/format)
  if (text.includes("deadline") || text.includes("submission") || text.includes("submit") || text.includes("portal") || text.includes("format") || text.includes("upload")) {
    return pick(
      "app.review.doneWhen.submission",
      "Done when: submission method, deadline, and required upload format are confirmed in portal/PDF."
    );
  }

  return pick(
    "app.review.doneWhen.source",
    "Done when: the clause is located in portal/PDF and confirmed against the authoritative wording."
  );
}




export default function JobDetailPage() {
  const { t } = useAppI18n();
  const params = useParams();
  const router = useRouter();

  const rawId = String((params as any)?.id ?? "").trim();
  const jobId = rawId;

  const [invalidLink, setInvalidLink] = useState(false);
const [metaOpen, setMetaOpen] = useState(false);

  const [job, setJob] = useState<DbJob | null>(null);
	const [result, setResult] = useState<DbJobResult | null>(null);
	const [jobMeta, setJobMeta] = useState<DbJobMetadata | null>(null);
	const [metaDraft, setMetaDraft] = useState<{ deadlineLocal: string; targetDecisionLocal: string; portal_url: string; internal_bid_id: string; owner_label: string; decision_override: string }>(
	  { deadlineLocal: "", targetDecisionLocal: "", portal_url: "", internal_bid_id: "", owner_label: "", decision_override: "" }
	);
const [savingMeta, setSavingMeta] = useState(false);
	const [savingTeamDecision, setSavingTeamDecision] = useState(false);

	const [events, setEvents] = useState<DbJobEvent[]>([]);

	const [workItems, setWorkItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monetization (free tier): used to gate exports
  const [notice, setNotice] = useState<string | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [billingResolved, setBillingResolved] = useState(false);

	const [tab, setTab] = useState<AnalysisTab>("text");

  // Bid room overlay is handled via BidRoomPanel (job-level route + optional tab).
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const [displayName, setDisplayNameState] = useState<string>("");
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const [sourceFocus, setSourceFocus] = useState<{ query: string; snippet: string; idx: number | null; highlightStart: number | null; highlightEnd: number | null } | null>(null);


  const [sourceQuery, setSourceQuery] = useState("");

  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus | null>(null);

  /** UI safety state for very large extracted text */
  const [showFullSourceText, setShowFullSourceText] = useState(false);

  const [showReferenceText, setShowReferenceText] = useState(false);
  const [showEvidenceExcerpt, setShowEvidenceExcerpt] = useState(true);

  const [exporting, setExporting] = useState<null | "summary" | "brief" | "xlsx">(null);

  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [showAllPolicyTriggers, setShowAllPolicyTriggers] = useState(false);
  const [showRisksSection, setShowRisksSection] = useState(false);
  const [showUnknownsSection, setShowUnknownsSection] = useState(false);

  const [showTrustOnboarding, setShowTrustOnboarding] = useState(false);

  const [retrying, setRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);
  const [processingTimeoutReached, setProcessingTimeoutReached] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);

  const mountedRef = useRef(true);
  const sourceAnchorRef = useRef<HTMLSpanElement | null>(null);
  const tabsTopRef = useRef<HTMLDivElement | null>(null);
  const evidenceExcerptRef = useRef<HTMLDivElement | null>(null);

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



  // Refresh operational overlays when returning from Bid Room (status + team decision)
  useEffect(() => {
    if (!jobId) return;
    const supabase = supabaseBrowser();

    let cancelled = false;

    async function refresh() {
      try {
        const { data: wiRows, error: wiErr } = await supabase
          .from("job_work_items")
          .select("job_id,type,ref_key,title,status,owner_label,due_at,notes,updated_at")
          .eq("job_id", jobId)
          .order("updated_at", { ascending: false });
        if (!cancelled && !wiErr) setWorkItems((wiRows as any[]) ?? []);
      } catch {
        // ignore
      }

      try {
        const { data: metaRows, error: metaErr } = await supabase
          .from("job_metadata")
          .select("job_id,deadline_override,target_decision_at,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
          .eq("job_id", jobId)
          .order("updated_at", { ascending: false })
          .limit(1);
        const metaRow = Array.isArray(metaRows) && metaRows.length ? (metaRows[0] as any) : null;
        if (!cancelled && !metaErr) setJobMeta((metaRow as any) ?? null);
      } catch {
        // ignore
      }
    }

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
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
      setProcessingTimeoutReached(false);

      try {
        const { data: jobRow, error: jobErr } = await supabase.from("jobs").select("*").eq("id", jobId).single();

        if (jobErr) {
          console.error(jobErr);
          setError(t("app.review.errors.loadFailedReturnToTenders"));
          setJob(null);
          setResult(null);
          setLoading(false);
          stopPolling();
          return;
        }

        setJob(jobRow as any);

        setCreditsLoading(true);
        try {
          const { data: u } = await supabase.auth.getUser();
          const uid = String(u?.user?.id ?? (jobRow as any)?.user_id ?? "").trim();
          if (uid) {
            const { data: profileRow, error: profErr } = await supabase
              .from("profiles")
              .select("credits_balance, plan_tier")
              .eq("id", uid)
              .maybeSingle();
            if (profErr) console.warn(profErr);
            const bal = typeof (profileRow as any)?.credits_balance === "number" ? (profileRow as any).credits_balance : 0;
            const tier = typeof (profileRow as any)?.plan_tier === "string" ? String((profileRow as any).plan_tier) : "free";
            if (mountedRef.current) {
              setCreditsBalance(bal);
              setPlanTier(tier);
              setBillingResolved(true);
            }
          } else {
            if (mountedRef.current) {
              setCreditsBalance(0);
              setPlanTier("free");
              setBillingResolved(true);
            }
          }
        } catch (e) {
          console.warn("billing profile load failed", e);
          if (mountedRef.current) {
            setCreditsBalance(null);
            setPlanTier(null);
            setBillingResolved(false);
          }
        } finally {
          if (mountedRef.current) setCreditsLoading(false);
        }

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
		// Manual overlay: job metadata (deadline, portal link, owner, decision override)
const { data: metaRows, error: metaErr } = await supabase
  .from("job_metadata")
  .select("job_id,deadline_override,target_decision_at,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
  .eq("job_id", jobId)
  .order("updated_at", { ascending: false })
  .limit(1);

const metaRow = Array.isArray(metaRows) && metaRows.length ? (metaRows[0] as any) : null;

if (metaErr) console.warn(metaErr);

setJobMeta((metaRow as any) ?? null);

// Initialize draft from stored metadata (local datetime input expects YYYY-MM-DDTHH:mm)
const dIso = (metaRow as any)?.deadline_override ? String((metaRow as any).deadline_override) : "";
const d = dIso ? new Date(dIso) : null;

const toLocalInput = (dt: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

setMetaDraft({
  deadlineLocal: d && Number.isFinite(d.getTime()) ? toLocalInput(d) : "",
  targetDecisionLocal: (() => {
    const tIso = (metaRow as any)?.target_decision_at ? String((metaRow as any).target_decision_at) : "";
    const t = tIso ? new Date(tIso) : null;
    return t && Number.isFinite(t.getTime()) ? toLocalInput(t) : "";
  })(),
  portal_url: String((metaRow as any)?.portal_url ?? ""),
  internal_bid_id: String((metaRow as any)?.internal_bid_id ?? ""),
  owner_label: String((metaRow as any)?.owner_label ?? ""),
  decision_override: String((metaRow as any)?.decision_override ?? ""),
});

// Load bid workflow work items (unblock checklist uses these; does not change pipeline output)
const { data: wiRows, error: wiErr } = await supabase
  .from("job_work_items")
  .select("job_id,type,ref_key,title,status,owner_label,due_at,notes,updated_at")
  .eq("job_id", jobId)
  .order("updated_at", { ascending: false });

if (wiErr) console.warn(wiErr);
setWorkItems((wiRows as any[]) ?? []);



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
        setError(t("app.review.errors.loadFailedRefresh"));
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
		  setProcessingTimeoutReached(true);
		  setError(t("app.review.errors.takingLonger"));
		  stopPolling();
		  return;
		}

		if (resultRow && processingTimeoutReached) {
		  setProcessingTimeoutReached(false);
		  setError(null);
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
            setError(t("app.review.errors.resultsNotReadyAfterComplete"));
            stopPolling();
            return;
          }
        } else {
          doneWithoutResult = 0;
        }

        if (pollErrors >= MAX_POLL_ERRORS) {
          setError(t("app.review.errors.troubleLoading"));
          stopPolling();
          return;
        }

        setPolling(status === "queued" || status === "processing" || (status === "done" && !resultRow));
      } catch (e) {
        console.error(e);
        pollErrors += 1;
        if (pollErrors >= MAX_POLL_ERRORS) {
          setError(t("app.review.errors.troubleLoading"));
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
  }, [jobId, invalidLink, pollCycle]);

  // BidRoomPanel handles loading/saving work items.

  const showProgress = useMemo(() => {
    const s = job?.status;
    return s === "queued" || s === "processing";
  }, [job]);


  const lastProgressEvent = useMemo(() => {
    if (!events || events.length === 0) return null;
    // events are fetched with newest first
    const first = events[0];
    const msg = summarizeEventMessage(first?.message);
    if (!msg) return null;
    return { message: msg, created_at: first?.created_at ?? null, level: first?.level ?? "info" } as const;
  }, [events]);


  const showReady = useMemo(() => job?.status === "done", [job]);
  const showFailed = useMemo(() => job?.status === "failed", [job]);

  async function requestJobRestart(source: "header" | "failed_panel") {
    if (!jobId || retrying) return;

    if (source === "failed_panel") {
      setRetryFeedback(null);
    } else {
      setNotice(null);
    }

    setRetrying(true);
    track("job_retry_requested", { jobId, source });

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" });
      const payload = await res.json().catch(() => ({} as any));
      const code = String((payload as any)?.error ?? "");
      const state = String((payload as any)?.state ?? "");

      const setFeedback = (message: string) => {
        if (source === "failed_panel") {
          setRetryFeedback(message);
        } else {
          setNotice(message);
        }
      };

      if (!res.ok) {
        if (res.status === 401) {
          track("job_retry_failed", { jobId, source, reason: "signed_out", status: res.status });
          setFeedback(t("app.review.retry.signedOut"));
        } else if (res.status === 409 && code === "job_still_processing") {
          track("job_retry_deferred", { jobId, source, reason: code, status: res.status });
          setFeedback(t("app.review.retry.stillProcessing"));
        } else if (res.status === 409 && (code === "job_not_failed" || code === "job_already_complete")) {
          track("job_retry_failed", { jobId, source, reason: code, status: res.status });
          setFeedback(t("app.review.retry.noLongerFailed"));
        } else if (res.status === 429 && code === "retry_limit_reached") {
          track("job_retry_failed", { jobId, source, reason: code, status: res.status });
          setFeedback(t("app.review.retry.limitReached"));
        } else {
          track("job_retry_failed", { jobId, source, reason: code || "retry_failed", status: res.status });
          setFeedback(t("app.review.retry.failed"));
        }
        return;
      }

      if (state === "failed_requeued" || state === "stale_processing_requeued" || state === "queued_triggered") {
        setJob((prev) => (prev ? ({ ...prev, status: "queued" } as any) : prev));
        setProcessingTimeoutReached(false);
        setError(null);
        setPolling(true);
        setPollCycle((value) => value + 1);
      }

      track("job_retry_started", { jobId, source, state: state || "started" });
      setFeedback(
        state === "queued_triggered"
          ? t("app.review.retry.triggerRequested")
          : t("app.review.retry.started")
      );
    } catch (e) {
      track("job_retry_failed", {
        jobId,
        source,
        reason: String((e as Error)?.message ?? "retry_failed"),
      });
      if (source === "failed_panel") {
        setRetryFeedback(t("app.review.retry.failed"));
      } else {
        setNotice(t("app.review.retry.failed"));
      }
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (!showReady || showFailed) return;

    try {
      const key = "tp_trust_onboarding_seen_v1";
      if (window.localStorage.getItem(key)) {
        setShowTrustOnboarding(false);
        return;
      }
      setShowTrustOnboarding(true);
    } catch {
      // ignore (e.g., private mode)
      setShowTrustOnboarding(true);
    }
  }, [showReady, showFailed]);

  useEffect(() => {
    if (!jobId) return;
    const status = job?.status;
    if (status !== "queued" && status !== "processing") return;

    try {
      const key = `tp_job_processing_started_${jobId}`;
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
      track("job_processing_started", { jobId });
    } catch {
      track("job_processing_started", { jobId });
    }
  }, [jobId, job?.status]);

  useEffect(() => {
    if (!jobId) return;
    if (job?.status !== "done") return;

    try {
      const key = `tp_job_completed_${jobId}`;
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
      track("job_completed", { jobId });
    } catch {
      track("job_completed", { jobId });
    }
  }, [jobId, job?.status]);

  const canDownload = useMemo(() => Boolean(job && job.status === "done"), [job]);
  const hasExportEntitlement = useMemo(() => {
    if (!canDownload || !billingResolved) return false;
    return canExportForProfile({ plan_tier: planTier, credits_balance: creditsBalance });
  }, [canDownload, billingResolved, planTier, creditsBalance]);
  const exportLocked = useMemo(() => canDownload && billingResolved && !hasExportEntitlement, [canDownload, billingResolved, hasExportEntitlement]);
  const canExport = useMemo(() => canDownload && (!billingResolved || hasExportEntitlement), [canDownload, billingResolved, hasExportEntitlement]);
  const unlockExportsHref = "mailto:support@tenderpilot.com?subject=Unlock%20TenderPilot%20Exports";
  const canDelete = Boolean(job) && !showProgress;

  const extractedText = useMemo(() => String(result?.extracted_text ?? "").trim(), [result]);

  const hasUsableExtractedText = useMemo(() => extractedText.length >= 500, [extractedText]);

  const extractionBadge = useMemo(() => {
    if (hasUsableExtractedText) {
      return { label: t("app.review.extraction.textExtractedLabel"), title: t("app.review.extraction.textExtractedTitle") };
    }

    return {
      label: t("app.review.extraction.limitedLabel"),
		title: t("app.review.extraction.limitedTitle"),
    };
  }, [hasUsableExtractedText]);

  const playbookVersion = useMemo(() => {
    const v = (result as any)?.playbook_version;
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s : null;
  }, [result]);

  const policyTriggers = useMemo(() => normalizePolicyTriggers((result as any)?.policy_triggers), [result]);

  const hasPlaybookConfigured = useMemo(() => playbookVersion !== null, [playbookVersion]);

  const hasPlaybookSignal = useMemo(() => {
    if (playbookVersion !== null) return true;
    // Edge case tolerance: if triggers exist but version is missing, still render them.
    return policyTriggers.length > 0;
  }, [playbookVersion, policyTriggers]);


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
		chips.push({ label: t("app.review.warnings.inputTruncated"), detail: typeof maxChars === "number" ? t("app.review.warnings.maxChars", { count: maxChars }) : undefined });
	  }

	  if (hasEmptyExtractWarning) chips.push({ label: t("app.review.warnings.noTextExtracted") });
	  if (hasCostCapFailure) chips.push({ label: t("app.review.warnings.costCapExceeded") });

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

  // BidRoomPanel derives the work rows and performs overlay upserts.


  const mustItems = useMemo(() => {
    return checklist
      .filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"))
      .map((x) => String(x?.text ?? x?.requirement ?? "").trim())
      .filter(Boolean);
  }, [checklist]);



  const blockersReadiness = useMemo(() => {
    const items = Array.isArray(checklist) ? checklist : [];

    // Index work items by requirement ref_key for quick lookup
    const workByReqKey = new Map<string, any>();
    for (const w of workItems ?? []) {
      if (String((w as any)?.type ?? "") !== "requirement") continue;
      const k = String((w as any)?.ref_key ?? "").trim();
      if (!k) continue;
      if (!workByReqKey.has(k)) workByReqKey.set(k, w);
    }

    let total = 0;
    let done = 0;
    let blocked = 0;
    let fixableRemaining = 0;

    for (const it of items) {
      const kindRaw = String((it as any)?.type ?? (it as any)?.level ?? (it as any)?.priority ?? "INFO");
      if (!isMustKind(kindRaw)) continue;

      const kind = String(kindRaw).toUpperCase();
      const text = String((it as any)?.text ?? (it as any)?.requirement ?? "").trim();
      if (!text) continue;

      total += 1;
      const ref = stableRefKey({ jobId, type: "requirement", text, extra: kind });
      const w = workByReqKey.get(ref);
      const st = (w as any)?.status;

      if (isBlockedWorkStatus(st)) {
        blocked += 1;
        continue;
      }

      if (w && isDoneWorkStatus(st)) {
        done += 1;
        continue;
      }

      // If the work item is missing or still in todo/doing/unknown, treat as fixable remaining.
      // This matches the Bid Room rule: only when blockers are NOT in todo/doing we unlock "Ready to decide".
      fixableRemaining += 1;
    }

    const readyToDecide = total > 0 && fixableRemaining === 0;
    const resolvedByTeam = readyToDecide && blocked === 0;

    return { total, done, blocked, fixableRemaining, readyToDecide, resolvedByTeam };
  }, [checklist, workItems, jobId]);

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

    setShowEvidenceExcerpt(true);
// Evidence-first UX:
    // Open Source text AND immediately jump/highlight using the candidate excerpt (deterministic).
    openTabAndScroll();

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
      note: t("app.review.evidenceNotes.idNotFound"),
      allIds: ids.length ? ids : null,
    });
  } else {
    setEvidenceFocus({
      id: "",
      excerpt: "",
      page: null,
      anchor: null,
      note: t("app.review.evidenceNotes.noEvidenceId"),
      allIds: null,
    });
  }

  // No candidate excerpt to jump to → still open Source text so the user can search manually.
  openTabAndScroll();
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

  type BlockerCard = { text: string; detail: string; evidenceIds: string[] };

  const blockerCards = useMemo<BlockerCard[]>(() => {
    const hard = Array.isArray((executive as any)?.hardBlockers) ? (executive as any).hardBlockers : [];
    if (hard.length) {
      return hard
        .map((item: any): BlockerCard => ({
          text: String(item?.title ?? item?.detail ?? "").trim(),
          detail: String(item?.detail ?? "").trim(),
          evidenceIds: Array.isArray(item?.evidence_ids)
            ? item.evidence_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
            : [],
        }))
        .filter((item: BlockerCard) => Boolean(item.text));
    }

    return mustItems.map((text): BlockerCard => ({
      text,
      detail: "",
      evidenceIds: mustEvidenceIdsByText.get(text) ?? [],
    }));
  }, [executive, mustItems, mustEvidenceIdsByText]);


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
      if (diffMin > 0 && diffMin <= 24 * 60) return t("app.review.nextActions.dueToday");
      // If already passed, still show the most actionable label.
      if (diffMin <= 0) return t("app.review.nextActions.dueToday");
    }

    if (isCommercialAction(actionText)) return t("app.review.nextActions.dueBeforePricing");
    return t("app.review.nextActions.dueBeforeSubmission");
  }

  const firstMust = mustItems[0] ?? "";
  const firstQuestion = questions[0] ?? "";
  const firstRisk = executive?.topRisks?.[0]?.title
    ? `${executive.topRisks[0].title}${executive.topRisks[0].detail ? `: ${executive.topRisks[0].detail}` : ""}`
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
    if (target === "risks") return t("app.review.metrics.risks", { count: risks.length });
    if (target === "questions") return t("app.review.metrics.questions", { count: questions.length });
    if (target === "draft") return hasDraftForUi ? t("app.review.metrics.outlineAvailable") : t("app.review.metrics.outlineNotDetected");

    // Source
    if (deadlineDetected && isSubmissionOrDeadlineAction(actionText)) return t("app.review.metrics.deadlineDetected");
    return t("app.review.metrics.source");
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
      const cls = classifyNextAction(actionText, t);
      const evidenceQuery = evidenceForAction(cls.target, actionText);
      const evidencePreview = evidencePreviewForQuery(evidenceQuery);

      const meta = classifyOwnerAndEta({ text: actionText, target: cls.target, label: cls.label, tx: t });
      const doneWhen = classifyDoneWhen({ text: actionText, target: cls.target, label: cls.label, tx: t });

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
    const text = t("app.review.nextActions.fallback.requirementsText");
    const evidenceQuery = evidenceForAction("checklist", text);
	const meta = classifyOwnerAndEta({ text, target: "checklist", label: t("app.review.labels.compliance"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "checklist", label: t("app.review.labels.compliance"), tx: t });
    out.push({
      text,
      target: "checklist",
      label: t("app.review.labels.requirements"),
      why: t("app.review.nextActions.fallback.requirementsWhy"),
      metric: metricForAction("checklist", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
	  owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.requirements"), target: "checklist" }),

    });
  } else if (executive?.topRisks?.length) {
    const text = t("app.review.nextActions.fallback.risksText");
    const evidenceQuery = evidenceForAction("risks", text);
    const meta = classifyOwnerAndEta({ text, target: "risks", label: t("app.review.labels.risks"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "risks", label: t("app.review.labels.risks"), tx: t });

    out.push({
      text,
      target: "risks",
      label: t("app.review.labels.risks"),
      why: t("app.review.nextActions.fallback.risksWhy"),
      metric: metricForAction("risks", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.risks"), target: "risks" }),
    });

  } else {
    const text = t("app.review.nextActions.fallback.sourceRequirementsText");
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: t("app.review.labels.source"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "text", label: t("app.review.labels.source"), tx: t });

    out.push({
      text,
      target: "text",
      label: t("app.review.labels.source"),
      why: t("app.review.nextActions.fallback.sourceRequirementsWhy"),
      metric: metricForAction("text", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.source"), target: "text" }),
    });
  }

  // Fallback action 2
  {
    const text = t("app.review.nextActions.fallback.sourceDeadlineText");
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: t("app.review.labels.source"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "text", label: t("app.review.labels.source"), tx: t });

    out.push({
      text,
      target: "text",
      label: t("app.review.labels.source"),
      why: t("app.review.nextActions.fallback.sourceDeadlineWhy"),
      metric: metricForAction("text", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.source"), target: "text" }),
    });

  }

  // Fallback action 3
  if (questions.length) {
    const text = t("app.review.nextActions.fallback.clarificationsText");
    const evidenceQuery = evidenceForAction("questions", text);
    const meta = classifyOwnerAndEta({ text, target: "questions", label: t("app.review.labels.clarifications"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "questions", label: t("app.review.labels.clarifications"), tx: t });

    out.push({
      text,
      target: "questions",
      label: t("app.review.labels.clarifications"),
      why: t("app.review.nextActions.fallback.clarificationsWhy"),
      metric: metricForAction("questions", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.clarifications"), target: "questions" }),
    });

  } else if (hasDraftForUi) {
    const text = t("app.review.nextActions.fallback.outlineText");
    const evidenceQuery = evidenceForAction("draft", text);
    const meta = classifyOwnerAndEta({ text, target: "draft", label: t("app.review.labels.tenderOutline"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "draft", label: t("app.review.labels.tenderOutline"), tx: t });

    out.push({
      text,
      target: "draft",
      label: t("app.review.labels.tenderOutline"),
      why: t("app.review.nextActions.fallback.outlineWhy"),
      metric: metricForAction("draft", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.tenderOutline"), target: "draft" }),
    });

    } else {
    const text = t("app.review.nextActions.fallback.sourceFormattingText");
    const evidenceQuery = evidenceForAction("text", text);
    const meta = classifyOwnerAndEta({ text, target: "text", label: t("app.review.labels.source"), tx: t });
    const doneWhen = classifyDoneWhen({ text, target: "text", label: t("app.review.labels.source"), tx: t });

    out.push({
      text,
      target: "text",
      label: t("app.review.labels.source"),
      why: t("app.review.nextActions.fallback.sourceFormattingWhy"),
      metric: metricForAction("text", text),
      evidenceQuery,
      evidencePreview: evidencePreviewForQuery(evidenceQuery),
      owner: meta.owner,
      eta: meta.eta,
      doneWhen,
      dueMoment: dueMomentForAction({ actionText: text, label: t("app.review.labels.source"), target: "text" }),
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
	  return buildReadyToSendClarifications({ tenderName, questions, tx: t });
	}, [displayName, job?.file_name, questions]);
	 

 const hasAnyResultsPayload = useMemo(() => {
    return Boolean(extractedText || checklist.length || risks.length || questions.length || hasDraftForUi);
  }, [extractedText, checklist.length, risks.length, questions.length, hasDraftForUi]);

  const finalizingResults = useMemo(() => showReady && !hasAnyResultsPayload, [showReady, hasAnyResultsPayload]);

  useEffect(() => {
    if (!showTrustOnboarding || !showReady || showFailed || finalizingResults) return;

    try {
      const key = "tp_trust_onboarding_seen_v1";
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }, [showTrustOnboarding, showReady, showFailed, finalizingResults]);

  // Verdict: prefer backend final decision, then fall back to the older UI heuristic.
  const verdictState: VerdictState = useMemo(() => {
    if (!showReady) return "caution";

    const backendDecisionBucket = decisionBucket(
      String((executive as any)?.finalDecisionBadge ?? (executive as any)?.decisionBadge ?? "").trim()
    );
    if (backendDecisionBucket === "no-go") return "no-go";
    if (backendDecisionBucket === "hold") return "hold";
    if (backendDecisionBucket === "go") return "proceed";

    if (String((executive as any)?.tenderStatus ?? "").trim().toLowerCase() === "expired") return "no-go";
    if (mustItems.length >= 1) return "hold";
    const top = (executive.topRisks ?? []).slice(0, 3);
    if (top.some((r: any) => String(r?.severity ?? "").toLowerCase() === "high")) return "caution";
    return "proceed";
  }, [showReady, mustItems.length, executive]);

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
  t,
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

	  const isHold = verdictState === "hold" || verdictState === "no-go";
	  const isCaution = verdictState === "caution";

	  const neutral =
		"border-muted/60 bg-muted/20 text-muted-foreground hover:bg-background hover:text-foreground";
	  const critical =
		"border-red-200 bg-background text-red-800 hover:border-red-300 hover:bg-red-50/40 dark:border-red-500/25 dark:text-red-200 dark:hover:border-red-500/35 dark:hover:bg-red-500/10";
	  const warn =
		"border-amber-200 bg-background text-amber-900 hover:border-amber-300 hover:bg-amber-50/40 dark:border-amber-500/25 dark:text-amber-200 dark:hover:border-amber-500/35 dark:hover:bg-amber-500/10";
	  const info =
		"border-sky-200 bg-background text-sky-900 hover:border-sky-300 hover:bg-sky-50/40 dark:border-sky-500/25 dark:text-sky-200 dark:hover:border-sky-500/35 dark:hover:bg-sky-500/10";

	  if (kind === "blockers") {
		// If HOLD, keep border red even on hover (no “second red fill” needed)
		if (isHold) return critical;
		if (blockers > 0) return warn;
		return neutral;
	  }

	  if (kind === "risks") {
		if (isCaution) return warn;
		if (r >= 3) return warn;
		if (r > 0)
		  return "border-amber-200/60 bg-background text-amber-900 hover:border-amber-300 hover:bg-amber-50/30 dark:border-amber-500/25 dark:text-amber-200 dark:hover:border-amber-500/35 dark:hover:bg-amber-500/10";
		return neutral;
	  }

	  if (kind === "questions") {
		if (q >= 5) return info;
		if (q > 0)
		  return "border-sky-200/60 bg-background text-sky-900 hover:border-sky-300 hover:bg-sky-50/30 dark:border-sky-500/25 dark:text-sky-200 dark:hover:border-sky-500/35 dark:hover:bg-sky-500/10";
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

	  const isHold = verdictState === "hold" || verdictState === "no-go";
	  const isCaution = verdictState === "caution";

	  const neutral = "border-muted/60 text-foreground";
	  const critical = "border-red-200 text-red-800 dark:border-red-500/25 dark:text-red-200";
	  const warn = "border-amber-200 text-amber-900 dark:border-amber-500/25 dark:text-amber-200";
	  const info = "border-sky-200 text-sky-900 dark:border-sky-500/25 dark:text-sky-200";

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
    if (!showReady) return t("app.review.drivers.loading");
    if (verdictState === "no-go") return "Hard stop detected in the tender evidence. Do not proceed unless the buyer has formally reopened or extended the opportunity.";
    if (verdictState === "hold") return t("app.review.drivers.hold");
    if (verdictState === "caution") return t("app.review.drivers.caution");
    return t("app.review.drivers.go");
  }, [showReady, verdictState, t]);

  const aiSuggestionLabel = useMemo(() => {
    if (verdictState === "no-go") return t("app.decision.noGo");
    if (verdictState === "hold") return t("app.decision.hold");
    // Option A: decision badge labels remain Go / Hold / No-Go; caution nuance is microcopy.
    return t("app.decision.go");
  }, [verdictState, t]);

  const teamDecision = useMemo(() => {
    const raw = (jobMeta as any)?.decision_override;
    if (isUseExtractedDecisionOverride(raw)) {
      return { active: false, bucket: "unknown" as const, label: "", raw: "" };
    }

    const txt = String(raw ?? "").trim();
    const bucket = decisionBucket(txt);
    const label =
      bucket === "go"
        ? t("app.decision.go")
        : bucket === "hold"
          ? t("app.decision.hold")
          : bucket === "no-go"
            ? t("app.decision.noGo")
            : txt;
    return { active: true, bucket, label, raw: txt };
  }, [jobMeta, t]);

  const globalDecision = useMemo(() => {
    if (teamDecision.active && teamDecision.bucket !== "unknown") {
      return { source: "team" as const, bucket: teamDecision.bucket, label: teamDecision.label };
    }

    const bucket =
      verdictState === "no-go"
        ? "no-go"
        : verdictState === "hold"
          ? "hold"
          : verdictState === "proceed"
            ? "go"
            : "caution";
    const label =
      verdictState === "no-go"
        ? t("app.decision.noGo")
        : verdictState === "hold"
          ? t("app.decision.hold")
          : t("app.decision.go");
    return { source: "ai" as const, bucket, label };
  }, [teamDecision, verdictState, t]);



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

  function openTabAndScroll() {
  setTab("text");
  setShowReferenceText(true);
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
          t("app.review.evidenceNotes.pageMarkerNotFound", { marker }),
        idx: null,
        highlightStart: null,
        highlightEnd: null,
      });
      openTabAndScroll();
      return;
    }

    if (idx > SOURCE_TEXT_PREVIEW_LIMIT) setShowFullSourceText(true);

    setSourceFocus({
      query: `Page ${page}`,
      snippet:
        reason ||
        t("app.review.evidenceNotes.jumpedToMarker", { marker }),
      idx,
      highlightStart: idx,
      highlightEnd: idx + marker.length,
    });

    openTabAndScroll();
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
            t("app.review.evidenceNotes.noExactClauseFound"),
          idx: null,
          highlightStart: null,
          highlightEnd: null,
        });
        openTabAndScroll();
        return;
      }
    }

    const match = findExcerpt(extractedText, effectiveQuery);

    if (!match) {
      // Never highlight the wrong clause. If we can't find an exact match, show an explicit message.
      const msg = evidenceOverride
        ? t("app.review.evidenceNotes.noExactClauseFound")
        : t("app.review.source.exactMatchNotFound");
      setSourceFocus({ query: displayQuery, snippet: msg, idx: null, highlightStart: null, highlightEnd: null });
      openTabAndScroll();
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

    openTabAndScroll();
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

    if (!canExport) {
      track("export_bid_pack_denied", { jobId, reason: "client_lock" });
      setNotice(t("app.review.exportsLocked"));
      return;
    }

    setNotice(null);

    const text = toPlainTextSummary({
      fileName: displayName || job.file_name,
      createdAt: job.created_at,
      verdictLabel: verdictState === "no-go" ? t("app.decision.noGo") : verdictState === "hold" ? t("app.decision.hold") : t("app.decision.go"),
      decisionLine:
        String(executive?.decisionLine ?? "").trim() ||
        (verdictState === "no-go"
          ? "No Go because a hard stop was identified in the tender evidence."
          : verdictState === "hold"
          ? t("app.review.verdictMicrocopy.hold")
          : verdictState === "caution"
            ? t("app.review.verdictMicrocopy.caution")
            : t("app.review.verdictMicrocopy.go")),
      rationaleSnapshot: (mustItems ?? []).slice(0, 3).map((t) => String(t).trim()).filter(Boolean),
      recommendedAction:
        verdictState === "no-go"
          ? "Do not proceed unless the buyer has formally reopened or extended the opportunity."
          : verdictState === "hold"
          ? t("app.exports.tenderBrief.recommendedAction.hold")
          : verdictState === "caution"
            ? t("app.exports.tenderBrief.recommendedAction.caution")
            : t("app.exports.tenderBrief.recommendedAction.go"),
      whereToVerify:
        t("app.exports.tenderBrief.whereToVerifyList"),
      checklist,
      risks,
      questions,
      draftText: draftForUi,
      evidenceById,
      t,
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

    if (!canExport) {
      track("export_tender_brief_denied", { jobId, reason: "client_lock" });
      setNotice(t("app.review.exportsLocked"));
      return;
    }

    setNotice(null);
    setError(null);

    const fallbackTitle = t("app.exports.tenderBrief.title");
    const title = String(displayName || job.file_name || fallbackTitle).trim() || fallbackTitle;
    const created = formatDate(job.created_at);
    const E = {
      tenderBrief: t("app.exports.tenderBrief.title"),
      createdLabel: t("app.exports.tenderBrief.meta.created"),
      coverageLabel: t("app.exports.tenderBrief.meta.coverage"),
      confidenceLabel: t("app.exports.tenderBrief.meta.confidence"),
      submissionDeadline: t("app.exports.tenderBrief.meta.submissionDeadline"),
      deadlinePresentVerify: t("app.exports.tenderBrief.meta.deadlinePresentVerify"),

      sections: {
        executiveSummary: t("app.exports.tenderBrief.sections.executiveSummary"),
        keyConsiderations: t("app.exports.tenderBrief.sections.keyConsiderations"),
        recommendedFocus: t("app.exports.tenderBrief.sections.recommendedFocus"),
        mustBlockers: t("app.exports.tenderBrief.sections.mustBlockers"),
        risks: t("app.exports.tenderBrief.sections.risks"),
        clarifications: t("app.exports.tenderBrief.sections.clarifications"),
        readyToSendEmail: t("app.exports.tenderBrief.sections.readyToSendEmail"),
        rawList: t("app.exports.tenderBrief.sections.rawList"),
        tenderOutline: t("app.exports.tenderBrief.sections.tenderOutline"),
      },

      mustBlockersNote: t("app.exports.tenderBrief.sections.mustBlockersNote"),
      tipPdf: t("app.exports.tenderBrief.tipPdf"),
      evidenceDisclaimer: t("app.exports.tenderBrief.evidenceDisclaimer", { locate: t("app.review.source.locate") }),

      empty: {
        noMustBlockers: t("app.exports.tenderBrief.empty.noMustBlockers"),
        noRisks: t("app.exports.tenderBrief.empty.noRisks"),
        noDrivers: t("app.exports.tenderBrief.empty.noDrivers"),
        noClarifications: t("app.exports.tenderBrief.empty.noClarifications"),
        noOutline: t("app.exports.tenderBrief.empty.noOutline"),
      },

      evidence: {
        label: t("app.exports.tenderBrief.evidence.label"),
        moreEvidenceIds: t("app.exports.tenderBrief.evidence.moreEvidenceIds"),
        pageUnknown: t("app.exports.tenderBrief.evidence.pageUnknown"),
        missingSnippet: t("app.exports.tenderBrief.evidence.missingSnippet"),
        emptyExcerpt: t("app.exports.tenderBrief.evidence.emptyExcerpt"),
        moreEvidenceLine: (vars: { count: number; ids: string }) =>
          t("app.exports.tenderBrief.evidence.moreEvidenceLine", vars),
      },

      severity: {
        high: t("app.exports.tenderBrief.severity.high"),
        medium: t("app.exports.tenderBrief.severity.medium"),
        low: t("app.exports.tenderBrief.severity.low"),
      },

      recommendedAction: {
        hold: t("app.exports.tenderBrief.recommendedAction.hold"),
        caution: t("app.exports.tenderBrief.recommendedAction.caution"),
        go: t("app.exports.tenderBrief.recommendedAction.go"),
      },

      manualChecks: t("app.exports.tenderBrief.manualChecks"),
      manualChecksExamples: t("app.exports.tenderBrief.manualChecksExamples"),

      buyerEmail: {
        subject: (vars: { name: string }) => t("app.exports.tenderBrief.buyerEmail.subject", vars),
        subjectLabel: t("app.exports.tenderBrief.buyerEmail.subjectLabel"),
        greeting: t("app.exports.tenderBrief.buyerEmail.greeting"),
        intro: t("app.exports.tenderBrief.buyerEmail.intro"),
        thanks: t("app.exports.tenderBrief.buyerEmail.thanks"),
      },

      footerLeft: t("app.exports.tenderBrief.footerLeft"),
      footerRight: t("app.exports.tenderBrief.footerRight"),
    } as const;



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
            return `<div class="ev"><div class="ev-head">${escapeHtml(E.evidence.label)} ${escapeHtml(id)} • ${escapeHtml(E.evidence.pageUnknown)}</div><div class="ev-body">${escapeHtml(E.evidence.missingSnippet)}</div></div>`;
          }
          const pageLabel =
            ev.page === null || ev.page === undefined
              ? E.evidence.pageUnknown
              : `${t("app.review.source.pageLabel")} ${ev.page}`;
          const excerpt = escapeHtml(String(ev.excerpt ?? "").trim());
          return `<div class="ev"><div class="ev-head">${escapeHtml(E.evidence.label)} ${escapeHtml(ev.id)} • ${escapeHtml(pageLabel)}</div><div class="ev-body">${excerpt || escapeHtml(E.evidence.emptyExcerpt)}</div></div>`;
        })
        .filter(Boolean)
        .join("\n");

      const overflowLine =
        overflow > 0
          ? `<div class="ev"><div class="ev-head">${escapeHtml(E.evidence.moreEvidenceIds)}</div><div class="ev-body">${escapeHtml(
              E.evidence.moreEvidenceLine({
                count: overflow,
                ids: arrAll.slice(MAX_BLOCKS).join(", "),
              })
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
      : `<p class="empty">${escapeHtml(E.empty.noMustBlockers)}</p>`;

    const riskLines = risks.length
      ? `<ol>${risks
          .slice(0, 25)
          .map((r: any) => {
            const sevRaw = String(r?.severity ?? r?.level ?? r?.rating ?? "medium").toLowerCase();
            const sev = sevRaw === "high" || sevRaw === "medium" || sevRaw === "low" ? sevRaw : "medium";
            const riskTitle = escapeHtml(pickText(r));
            const detail = escapeHtml(String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim());
            const sevLabel = sev === "high" ? E.severity.high : sev === "low" ? E.severity.low : E.severity.medium;
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
      : `<p class="empty">${escapeHtml(E.empty.noRisks)}</p>`;

    // Mirror the on-screen executive summary (rationale snapshot + recommended action)
    
const rationaleDrivers = buildRationaleDrivers({
  verdict: verdictState,
  mustItems,
  risksCount: risks.length,
  clarificationsCount: questions.length,
	  coverage: coverageNormalized,
  confidence,
  t,
});

const rationaleLines = rationaleDrivers.length
  ? `<ul>${rationaleDrivers.map((t) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ul>`
  : `<p class="empty">${escapeHtml(E.empty.noDrivers)}</p>`;

    const recommendedAction =
      verdictState === "no-go"
        ? "Do not proceed unless the buyer has formally reopened or extended the opportunity."
        : verdictState === "hold"
        ? E.recommendedAction.hold
        : verdictState === "caution"
          ? E.recommendedAction.caution
          : E.recommendedAction.go;

    const manualChecks = `${E.manualChecks} ${E.manualChecksExamples}`;

    const decisionLineRaw = String(executive.decisionLine ?? "").trim();
    const decisionLine =
      decisionLineRaw ||
      (verdictState === "no-go"
        ? "No Go because a hard stop was identified in the tender evidence."
        : verdictState === "hold"
        ? t("app.review.verdictMicrocopy.hold")
        : verdictState === "caution"
          ? t("app.review.verdictMicrocopy.caution")
          : t("app.review.verdictMicrocopy.go"));
    

    const buyerEmailText = (() => {
      if (!questions || !questions.length) return "";
      const name = title;
      const subject = E.buyerEmail.subject({ name });
      const lines: string[] = [];
      lines.push(`${E.buyerEmail.subjectLabel}: ${subject}`);
      lines.push("");
      lines.push(E.buyerEmail.greeting);
      lines.push("");
      lines.push(E.buyerEmail.intro);
      lines.push("");
      questions.slice(0, 40).forEach((q: any, i: number) => lines.push(`${i + 1}. ${String(q)}`));
      lines.push("");
      lines.push(E.buyerEmail.thanks);
      return lines.join("\n");
    })();

    const draftOutlineLines = (() => {
      const draftLines = renderDraftPlain(draftForUi);
      if (!draftLines.length) return `<p class="empty">${escapeHtml(E.empty.noOutline)}</p>`;
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
      if (!Number.isFinite(year)) return E.deadlinePresentVerify;
      // Guard against obviously stale / test dates
      if (year < 2020 || year > 2100) return E.deadlinePresentVerify;
      return t("app.exports.tenderBrief.meta.submissionDeadline", { deadline: raw });
    })();

    const verdictLabel = verdictState === "no-go" ? t("app.decision.noGo") : verdictState === "hold" ? t("app.decision.hold") : t("app.decision.go");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} ${escapeHtml(E.tenderBrief)}</title>
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
          <div class="docTitle">${escapeHtml(E.tenderBrief)}</div>
          <div class="pillRow">
            <span class="pill emph">${escapeHtml(verdictLabel)}</span>
            ${deadlinePill ? `<span class="pill">${escapeHtml(deadlinePill)}</span>` : ""}
          </div>
        </div>

        <div class="meta">
          <div><strong>${escapeHtml(title)}</strong></div>
          ${created ? `<div>${escapeHtml(E.createdLabel)} ${escapeHtml(created)}</div>` : ""}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>${escapeHtml(E.sections.executiveSummary)}</h2>
          ${decisionLine ? `<p style="margin:0;color:var(--muted)">${escapeHtml(decisionLine)}</p>` : ""}

          <div style="margin-top:12px" class="grid2">
            <div class="card" style="background:#fff">
              <div class="subhead">${escapeHtml(E.sections.keyConsiderations)}</div>
              ${rationaleLines}
            </div>

            <div class="card" style="background:#fff">
              <div class="subhead">${escapeHtml(E.sections.recommendedFocus)}</div>
              <p style="margin:0;color:var(--ink)">${escapeHtml(recommendedAction)}</p>
              <p class="note" style="margin-top:10px">${escapeHtml(manualChecks)}</p>
              <p class="note" style="margin-top:8px">${escapeHtml(E.tipPdf)}</p>
            </div>
          <div class="disclaimer" style="margin-top:12px">${escapeHtml(E.coverageLabel)}: ${escapeHtml(String(coverageNormalized).toUpperCase())} • ${escapeHtml(E.confidenceLabel)}: ${escapeHtml(String(confidence).toUpperCase())}<br/>${escapeHtml(E.evidenceDisclaimer)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>${escapeHtml(E.sections.mustBlockers)}</h2>
          <p class="note">${escapeHtml(E.mustBlockersNote)}</p>
          ${mustLines}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>${escapeHtml(E.sections.risks)}</h2>
          ${riskLines}
        </div>
      </div>


      <div class="section">
        <div class="card">
          <h2>${escapeHtml(E.sections.clarifications)}</h2>
          ${questions && questions.length
            ? `<div class="subhead">${escapeHtml(E.sections.readyToSendEmail)}</div><pre style="white-space:pre-wrap;margin:0">${escapeHtml(buyerEmailText)}</pre><div style="height:10px"></div><div class="subhead">${escapeHtml(E.sections.rawList)}</div><ol>${questions
                .slice(0, 40)
                .map((q: any) => `<li>${escapeHtml(String(q))}</li>`)
                .join("")}</ol>`
            : `<p class="empty">${escapeHtml(E.empty.noClarifications)}</p>`}
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>${escapeHtml(E.sections.tenderOutline)}</h2>
          ${draftOutlineLines}
        </div>
      </div>

    </div>

    <div class="footer">
      <span class="left">${escapeHtml(E.footerLeft)}</span>
      <span class="right">${escapeHtml(E.footerRight)}</span>
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
      setError(t("app.review.errors.printViewFailed"));
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
        setError(t("app.review.errors.printDialogFailed"));
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 300);
  }

  async function exportBidPackXlsx() {
    if (!job) return;

    if (!canExport) {
      track("export_bid_pack_denied", { jobId, reason: "client_lock" });
      setNotice(t("app.review.exportsLocked"));
      return;
    }

    setNotice(null);
    setError(null);

    const res = await fetch(`/api/jobs/${jobId}/export/bid-pack`, {
      method: "GET",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });

    if (res.status === 402) {
      track("export_bid_pack_denied", { jobId, reason: "server_402" });
      setNotice(t("app.review.exportsLocked"));
      return;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Bid Pack export failed", res.status, txt);
      track("export_bid_pack_failed", { jobId, status: res.status });
      setError(t("app.review.errors.bidPackExportFailed"));
      return;
    }

    track("export_bid_pack_succeeded", { jobId });
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

    if (!canExport) {
      track("export_csv_denied", { jobId, type, reason: "client_lock" });
      setNotice(t("app.review.exportsLocked"));
      return;
    }

    setNotice(null);
    setError(null);

    const res = await fetch(`/api/jobs/${jobId}/export/csv?type=${encodeURIComponent(type)}`, {
      method: "GET",
      headers: { Accept: "text/csv" },
    });

    if (res.status === 402) {
      track("export_csv_denied", { jobId, type, reason: "server_402" });
      setNotice(t("app.review.exportsLocked"));
      return;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("CSV export failed", type, res.status, txt);
      track("export_csv_failed", { jobId, type, status: res.status });
      setError(t("app.review.errors.exportCsvFailed", { type }));
      return;
    }

    track("export_csv_succeeded", { jobId, type });
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

async function saveJobMetadata() {
  if (!job) return;
  setSavingMeta(true);
  try {
    const supabase = supabaseBrowser();

    const deadlineIso = metaDraft.deadlineLocal ? new Date(metaDraft.deadlineLocal).toISOString() : null;
    const targetDecisionIso = metaDraft.targetDecisionLocal ? new Date(metaDraft.targetDecisionLocal).toISOString() : null;

    const payload: any = {
      job_id: job.id,
      deadline_override: deadlineIso,
      target_decision_at: targetDecisionIso,
      portal_url: metaDraft.portal_url.trim() || null,
      internal_bid_id: metaDraft.internal_bid_id.trim() || null,
      owner_label: metaDraft.owner_label.trim() || null,
      decision_override: metaDraft.decision_override.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("job_metadata")
      .upsert(payload, { onConflict: "job_id" })
      .select("job_id,deadline_override,target_decision_at,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
      .maybeSingle();

    if (error) throw error;
    setJobMeta((data as any) ?? null);
  } catch (e) {
    console.error(e);
    alert(t("app.metadata.errors.saveFailed"));
  } finally {
    setSavingMeta(false);
  }
}



async function saveTeamDecision(next: "Go" | "No-Go" | null) {
  if (!jobId) return;
  setSavingTeamDecision(true);
  setError(null);

  try {
    const supabase = supabaseBrowser();
    const payload: any = {
      job_id: jobId,
      decision_override: next,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("job_metadata")
      .upsert(payload, { onConflict: "job_id" })
      .select("job_id,deadline_override,target_decision_at,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
      .maybeSingle();

    if (error) throw error;
    setJobMeta((data as any) ?? null);
    setMetaDraft((s) => ({ ...s, decision_override: String(next ?? "") }));
  } catch (e) {
    console.error(e);
    alert(t("app.review.teamDecision.saveFailed"));
  } finally {
    setSavingTeamDecision(false);
  }
}

  async function handleDelete() {
    if (!job) return;
    const ok = window.confirm(t("app.review.delete.confirm"));
    if (!ok) return;

    try {
      const r = await fetch(`/api/jobs/${jobId}/delete`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(String((j as any)?.error ?? "delete_failed"));
      }
      router.push("/app/jobs");
    } catch (e) {
      console.error(e);
      setError(t("app.review.delete.failed"));
    }
  }

  if (invalidLink || (!loading && !job && !error)) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold">{t("app.review.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.review.empty.body")}</p>
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">{t("app.review.invalidLink")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/jobs">{t("app.review.actions.backToTenders")}</Link>
            </Button>
            <Button variant="outline" className="rounded-full" disabled>
              {t("app.review.actions.exportTenderBriefPdf")}
            </Button>
            <Button className="rounded-full" disabled>
              {t("app.review.actions.downloadSummary")}
            </Button>
            <Button variant="destructive" className="rounded-full" disabled>
              {t("app.common.delete")}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {t("app.common.preparing")}
          </Badge>
          <p className="text-sm text-muted-foreground">{t("app.review.empty.body")}</p>
        </div>

        <Card className="rounded-2xl border border-white/10 bg-background/70 dark:bg-zinc-900/50 backdrop-blur-xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t("app.common.draftingSupport")}</p>
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
    if (diffMin <= 0) return t("app.review.deadline.passed");

    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 2) return t("app.review.deadline.inDays", { days: diffDays });
    if (diffDays === 1) return t("app.review.deadline.inOneDay");
    if (diffHours >= 2) return t("app.review.deadline.inHours", { hours: diffHours });
    if (diffHours === 1) return t("app.review.deadline.inOneHour");
    return t("app.review.deadline.inMinutes", { minutes: diffMin });
  }, [deadlineDate, t]);

  const deadlineStatus = useMemo(() => {
    const tenderStatus = String((executive as any)?.tenderStatus ?? "").trim().toLowerCase();
    if (tenderStatus === "expired") return "expired" as const;
    if (deadlineDate && deadlineDate.getTime() <= Date.now()) return "expired" as const;
    if (deadlineDate || deadlineText) return "open" as const;
    return "unknown" as const;
  }, [deadlineDate, deadlineText, executive]);

  const deadlineCardTone =
    deadlineStatus === "expired"
      ? "border-rose-200/70 bg-rose-500/5 dark:border-rose-500/25 dark:bg-rose-500/10"
      : deadlineStatus === "open"
        ? "border-emerald-200/70 bg-emerald-500/5 dark:border-emerald-500/25 dark:bg-emerald-500/10"
        : "border-border bg-muted/30";

  const deadlineBadgeTone =
    deadlineStatus === "expired"
      ? "border-rose-200 bg-background text-rose-700 dark:border-rose-500/30 dark:bg-background/70 dark:text-rose-200"
      : deadlineStatus === "open"
        ? "border-emerald-200 bg-background text-emerald-700 dark:border-emerald-500/30 dark:bg-background/70 dark:text-emerald-200"
        : "border-border bg-background text-muted-foreground";

  const deadlineStatusLabel =
    deadlineStatus === "expired"
      ? t("app.review.deadline.passed")
      : deadlineStatus === "open"
        ? t("app.common.open")
        : t("app.common.unknown");

  const deadlineDisplayValue = useMemo(() => {
    const isoCandidate = String((executive as any)?.submissionDeadlineIso ?? "").trim();
    if (isoCandidate) {
      const formattedIso = formatDate(isoCandidate);
      if (formattedIso) return formattedIso;
    }
    if (deadlineDate) return formatDate(deadlineDate.toISOString());
    return deadlineText;
  }, [deadlineDate, deadlineText, executive]);

  const deadlineSourceQuery = useMemo(() => {
    const raw = String(deadlineText || "").trim();
    if (raw) return raw;
    return "Tender Submission Deadline";
  }, [deadlineText]);

  const todayFocus = useMemo(() => {
    if (!showReady) return "";
    if (verdictState === "no-go") return "Opportunity closed. Verify only whether the buyer has formally extended or reopened the tender.";
    if (verdictState === "hold") return t("app.review.todayFocus.hold");
    if (verdictState === "caution") return t("app.review.todayFocus.caution");
    return t("app.review.todayFocus.go");
  }, [showReady, verdictState]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <JobPageHeader
        title={displayName || job?.file_name || t("app.review.titleFallback")}
        showProgress={showProgress}
        showFailed={showFailed}
        showReady={showReady}
        lastProgressEvent={lastProgressEvent ? {
          message: String(lastProgressEvent.message ?? ""),
          createdAtText: lastProgressEvent.created_at ? formatDate(lastProgressEvent.created_at) : null,
        } : null}
        statusBadge={statusBadge(job?.status ?? "queued", t)}
        extractionBadge={showReady || showFailed ? extractionBadge : null}
        t={t}
        onRetryAnalysis={() => requestJobRestart("header")}
        canRetryAnalysis={Boolean(job) && !retrying}
        canDownload={canDownload}
        exportLocked={exportLocked}
        unlockExportsHref={unlockExportsHref}
        canExport={canExport}
        exporting={exporting}
        creditsLoading={creditsLoading}
        onExportBidPack={async (source) => {
          if (!canDownload || exporting !== null) return;
          track("export_bid_pack_clicked", source === "menu" ? { jobId, source: "menu" } : { jobId });
          setExporting("xlsx");
          try {
            await exportBidPackXlsx();
          } finally {
            setExporting(null);
          }
        }}
        onExportTenderBriefPdf={async () => {
          if (!canDownload || exporting !== null) return;
          setExporting("brief");
          try {
            await exportTenderBriefPdf();
          } finally {
            setExporting(null);
          }
        }}
        onExportSummaryTxt={async () => {
          if (!canDownload || exporting !== null) return;
          setExporting("summary");
          try {
            await exportSummaryTxt();
          } finally {
            setExporting(null);
          }
        }}
        onExportCsv={exportCsv}
        onRename={() => setRenaming(true)}
        canRename={Boolean(job) && !showProgress}
        onDelete={handleDelete}
        canDelete={canDelete}
      />

      <JobPageFeedback
        notice={notice}
        unlockExportsHref={unlockExportsHref}
        onDismissNotice={() => setNotice(null)}
        error={error}
        showProgress={showProgress}
        t={t}
      />
	{showFailed ? (
        <FailedStatePanel
          jobId={jobId}
          fileName={String(job?.file_name ?? "")}
          events={events}
          retrying={retrying}
          retryFeedback={retryFeedback}
          onRetry={() => requestJobRestart("failed_panel")}
        />
      ) : null}


      

      {showTrustOnboarding && showReady && !showFailed && !finalizingResults ? (
        <Card className="rounded-3xl border border-border bg-muted/20 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("app.review.trust.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("app.review.trust.subtitle")}</p>

                <ol className="mt-4 space-y-2 text-sm text-foreground/80">
                  <li>
                    <span className="font-medium">1.</span> {t("app.review.trust.step1")}
                  </li>
                  <li>
                    <span className="font-medium">2.</span> {t("app.review.trust.step2")}
                  </li>
                  <li>
                    <span className="font-medium">3.</span> {t("app.review.trust.step3")}
                  </li>
                </ol>
              </div>

              <div className="flex shrink-0 items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    try {
                      window.localStorage.setItem("tp_trust_onboarding_seen_v1", "1");
                    } catch {
                      // ignore
                    }
                    setShowTrustOnboarding(false);
                  }}
                >
                  {t("app.common.gotIt")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
            {/* Decision cockpit */}
      <Card className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <CardContent className="p-7 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{t("app.review.decision")}</p>

              {showFailed ? (
                <div className="mt-3">
                  <div className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
                    {t("app.common.failed")}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{t("app.review.failed.inlineBody")}</p>
                </div>
              ) : !showReady ? (
                <div className="mt-3">
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-200">
                    {t("app.review.state.preparingLabel")}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{t("app.review.state.preparingDecisionBody")}</p>
                </div>
              ) : finalizingResults ? (
                <div className="mt-3">
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-200">
                    {t("app.review.state.finalizingLabel")}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{t("app.review.state.finalizingBody")}</p>
                </div>
              ) : (
                <div className="mt-3 space-y-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className={[
                          "inline-flex items-center rounded-2xl px-4 py-2 text-sm font-semibold tracking-wide",
                          globalDecision.bucket === "go"
                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25"
                            : globalDecision.bucket === "hold"
                            ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/25"
                            : globalDecision.bucket === "no-go"
                            ? "bg-red-50 text-red-800 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/25"
                            : "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25",
                        ].join(" ")}
                      >
                        {globalDecision.label}
                      </div>

                      <div
                        className={[
                          "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
                          (blockersReadiness.total === 0
                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25"
                            : blockersReadiness.fixableRemaining === 0
                            ? blockersReadiness.blocked > 0
                              ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25"
                              : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25"
                            : "bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/20"),
                        ].join(" ")}
                      >
                        {globalDecision.bucket === "no-go" && String((executive as any)?.decisionSource ?? "").trim() === "hard_rule"
                          ? "Hard stop"
                          : globalDecision.bucket === "no-go" && String((executive as any)?.decisionSource ?? "").trim() === "policy_rule"
                          ? "Policy block"
                          : blockersReadiness.total === 0
                          ? t("app.review.readiness.noBlockers")
                          : blockersReadiness.fixableRemaining === 0
                          ? blockersReadiness.blocked > 0
                            ? t("app.review.readiness.readyWithBlocked", { count: blockersReadiness.blocked })
                            : t("app.review.readiness.resolvedByTeam")
                          : t("app.review.readiness.fixableRemaining", { count: blockersReadiness.fixableRemaining })}
                      </div>

                      {globalDecision.source === "team" ? (
                        <span className="text-xs text-muted-foreground">{t("app.review.teamDecisionApplied")}</span>
                      ) : null}

                      {(String((executive as any)?.decisionSource ?? "").trim() === "hard_rule" || String((executive as any)?.decisionSource ?? "").trim() === "policy_rule") && Array.isArray((executive as any)?.hardStopReasons) && (executive as any).hardStopReasons.length ? (
                        <span className="text-xs text-muted-foreground">
                          {`${String((executive as any)?.decisionSource ?? "").trim() === "policy_rule" ? "Policy block" : "Hard stop"}: ${String((executive as any).hardStopReasons[0] ?? "").trim()}`}
                        </span>
                      ) : null}
                    </div>

                    {blockersReadiness.total > 0 && (blockersReadiness.fixableRemaining === 0 || teamDecision.active) ? (
                      <div className="rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{t("app.review.readiness.readyTitle")}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{t("app.review.readiness.readyBody")}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold">
                              {t("app.review.readiness.total", { count: blockersReadiness.total })}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold">
                              {t("app.review.readiness.done", { count: blockersReadiness.done })}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold">
                              {t("app.review.readiness.blocked", { count: blockersReadiness.blocked })}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{t("app.review.teamDecision.label")}</span>

                          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 p-1">
                            <button
                              type="button"
                              disabled={!showReady || savingTeamDecision}
                              onClick={() => saveTeamDecision("Go")}
                              className={[
                                "h-8 rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                teamDecision.bucket === "go" ? "bg-foreground text-background shadow-sm" : "text-foreground/80 hover:bg-background/60",
                              ].join(" ")}
                            >
                              {t("app.decision.go")}
                            </button>

                            <button
                              type="button"
                              disabled={!showReady || savingTeamDecision}
                              onClick={() => saveTeamDecision("No-Go")}
                              className={[
                                "h-8 rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                teamDecision.bucket === "no-go" ? "bg-foreground text-background shadow-sm" : "text-foreground/80 hover:bg-background/60",
                              ].join(" ")}
                            >
                              {t("app.decision.noGo")}
                            </button>

                            <button
                              type="button"
                              disabled={!showReady || savingTeamDecision || !teamDecision.active}
                              onClick={() => saveTeamDecision(null)}
                              className="h-8 rounded-full px-3 text-xs font-semibold text-muted-foreground transition hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                            >
                              {t("app.common.clear")}
                            </button>
                          </div>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">{t("app.review.overlayNote")}</p>
                      </div>
                    ) : null}
                  </div>

                  {(verdictState === "hold" || verdictState === "no-go") && blockerCards.length ? (
                    <div className="rounded-2xl border border-rose-200/40 bg-rose-500/5 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                      <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">{t("app.review.topBlockersTitle")}</p>
                      <ul className="mt-2 space-y-2 text-sm text-rose-950/90 dark:text-rose-100">
                        {blockerCards.slice(0, 3).map((item: BlockerCard, i: number) => (
                          <li key={i} className="leading-relaxed">• {item.text}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px] lg:items-stretch">
              <div className="flex justify-end">
                <Button asChild className="rounded-full">
                  <Link href={`/app/jobs/${jobId}/bid-room`}>{t("app.dashboard.menu.openBidRoom")}</Link>
                </Button>
              </div>

              <div className={`rounded-2xl border p-4 ${deadlineCardTone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{t("app.exports.tenderBrief.meta.submissionDeadline")}</p>
                    <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
                      {deadlineDisplayValue || t("app.common.unknown")}
                    </p>
                  </div>
                  <Badge variant="outline" className={`rounded-full ${deadlineBadgeTone}`}>
                    {deadlineStatusLabel}
                  </Badge>
                </div>

                <div className="mt-3 space-y-2">
                  {deadlineText && deadlineDisplayValue !== deadlineText ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">{deadlineText}</p>
                  ) : null}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {timeToDeadline || t("app.exports.tenderBrief.meta.deadlinePresentVerify")}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onJumpToSource(deadlineSourceQuery)}
                    disabled={!extractedText}
                  >
                    {t("app.review.source.locate")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      

      {showReady && !showFailed && !finalizingResults ? (
        <Card id="decision-drivers" className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <CardContent className="p-7 md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{t("app.review.driversTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("app.review.driversSubtitle")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold">{t("app.review.sections.blockers")}</p>
                {blockerCards.length ? (
                  <div className="mt-3 space-y-2">
                    {blockerCards.slice(0, 5).map((item: BlockerCard, i: number) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-3">
                        <p className="text-sm text-foreground/80 leading-relaxed">• {item.text}</p>
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => showEvidenceByIds(item.evidenceIds ?? undefined, item.text)}
                            disabled={((item.evidenceIds?.length ?? 0) === 0) && !extractedText}
                          >
                            {t("app.bidroom.actions.openEvidence")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{t("app.common.noneDetected")}</p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold">{t("app.review.sections.strategicRisks")}</p>
                {(executive?.topRisks ?? []).length ? (
                  <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                    {(executive?.topRisks ?? []).slice(0, 5).map((r: any, i: number) => (
                      <li key={i} className="leading-relaxed">• {String(r?.title ?? "").trim()}{r?.detail ? `: ${String(r.detail).trim()}` : ""}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{t("app.review.sections.noStrategicRisks")}</p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold">{t("app.review.sections.immediateActions")}</p>
                {(nextActionsForUi ?? []).length ? (
                  <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                    {(nextActionsForUi ?? []).slice(0, 5).map((a: any, i: number) => (
                      <li key={i} className="leading-relaxed">• {String(a?.text ?? "").trim()}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{t("app.review.sections.noActions")}</p>
                )}
              </div>
            </div>

            <div className="mt-5">
{showUnknownsSection ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    {(questions ?? []).slice(0, 5).map((q, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
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
                          {copiedSection === `qemail_${i}` ? t("app.common.copied") : t("app.review.actions.addToBuyerEmail")}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => onJumpToSource(q)}
                          disabled={!extractedText}
                        >
                          {t("app.review.source.locateBestEffort")}
                        </Button>
                      </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                     <Button asChild variant="outline" className="rounded-full">
					  <Link href={`/app/jobs/${jobId}/bid-room`}>{t("app.dashboard.menu.openBidRoom")}</Link>
					</Button>

                    </div>
                  </div>
                ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
{showReady && !showFailed && !finalizingResults ? (
        <Card className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <CardContent className="p-7 md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{t("app.policyTriggers.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("app.policyTriggers.subtitle")}</p>
              </div>

              {hasPlaybookConfigured ? (
                <div className="flex flex-wrap items-center gap-2">
                  {playbookVersion ? (
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground/80">
                      {t("app.review.playbook.version", { version: playbookVersion })}
                    </span>
                  ) : null}

                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href="/app/account">{t("app.review.playbook.openSettings")}</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              {!hasPlaybookSignal ? (
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground/90">{t("app.review.playbook.noneTitle")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("app.review.playbook.noneBody")}</p>
                  <div className="mt-3">
                    <Button asChild className="rounded-full">
                      <Link href="/app/account">{t("app.review.playbook.configureCta")}</Link>
                    </Button>
                  </div>
                </div>
              ) : policyTriggers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("app.review.playbook.noTriggers")}</p>
              ) : (
                <div className="space-y-3">
                  {(showAllPolicyTriggers ? policyTriggers : policyTriggers.slice(0, 3)).map((trigger, i) => {
                    const meta = policyImpactMeta(trigger.impact, t);
                    return (
                      <div key={`${trigger.key || "trigger"}_${i}`} className="rounded-2xl border border-border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={meta.className}>{meta.label}</span>
                              <p className="text-sm font-semibold text-foreground/90">{policyTriggerTitle(trigger)}</p>
                            </div>

                            {trigger.note ? (
                              <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{trigger.note}</p>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">{t("app.review.playbook.noDetails")}</p>
                            )}

                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {t("app.common.keyLabel")} <span className="font-medium text-foreground/80">{trigger.key || "—"}</span>
                              {trigger.timestamp ? <> • {formatDate(trigger.timestamp)}</> : null}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {policyTriggers.length > 3 ? (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setShowAllPolicyTriggers((s) => !s)}
                      >
                        {showAllPolicyTriggers ? t("app.common.showLess") : t("app.common.showAllCount", { count: policyTriggers.length })}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <CardContent className="p-7 md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{t("app.review.source.sectionTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("app.review.source.sectionSubtitle")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

{/* Explore — reference mode (tabs) */}
      <div className="pt-2" ref={tabsTopRef}>
        <div className="flex items-end justify-between gap-3">
          <div>
			<p className="text-sm font-semibold">{t("app.review.source.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
			{t("app.review.source.subtitle")}
            </p>
          </div>
         
        </div>
      </div>


      <Tabs value={tab} onValueChange={(v) => setTab(v as AnalysisTab)} className="space-y-4">
		<TabsList className="rounded-full w-full justify-start overflow-x-auto">
		  <TabsTrigger value="text" className="rounded-full">
			{t("app.review.source.tabLabel")}
		  </TabsTrigger>
		</TabsList>

		       

        <TabsContent value="text">
          <JobPageReferencePanels
            t={t}
            evidenceFocus={evidenceFocus}
            copiedSection={copiedSection}
            showEvidenceExcerpt={showEvidenceExcerpt}
            evidenceExcerptRef={evidenceExcerptRef}
            onSwitchEvidenceId={(eid) => {
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
                        note: t("app.bidroom.evidence.notes.notFound"),
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

              track("evidence_opened", { jobId, evidenceId: String((cand as any)?.id ?? eid) });
              setShowEvidenceExcerpt(true);
              openTabAndScroll();
              if (ex) window.setTimeout(() => onJumpToSource(ex), 0);
            }}
            onOpenEvidenceExcerpt={() => {
              track("evidence_opened", { jobId, evidenceId: evidenceFocus?.id ?? null });
              setShowEvidenceExcerpt(true);
              window.setTimeout(() => evidenceExcerptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}
            onLocateEvidence={() => {
              const ex = String(evidenceFocus?.excerpt ?? "").trim();
              const hay = String(extractedText ?? "");
              const hasExact = ex ? hay.toLowerCase().includes(ex.toLowerCase()) : false;

              if (hasExact) {
                onJumpToSource(ex);
                return;
              }

              const p = evidenceFocus?.page;
              if (p !== null && p !== undefined) {
                const pageNum = Number(p);
                if (!Number.isNaN(pageNum)) {
                  jumpToPageMarker(pageNum, t("app.review.evidenceNotes.jumpedToMarkerGeneric"));
                  return;
                }
              }

              onJumpToSource(ex);
            }}
            onCopyEvidenceExcerpt={async () => {
              const ok = await safeCopy(String(evidenceFocus?.excerpt ?? ""));
              if (ok) {
                setCopiedSection("evidence");
                window.setTimeout(() => setCopiedSection(null), 1200);
              }
            }}
            onCloseEvidence={() => setEvidenceFocus(null)}
            sourceFocus={sourceFocus}
            onCopySourcePhrase={async () => {
              const ok = await safeCopy(String(sourceFocus?.query ?? ""));
              if (ok) {
                setCopiedSection("sourcePhrase");
                window.setTimeout(() => setCopiedSection(null), 1200);
              }
            }}
            onCloseSourceFocus={() => setSourceFocus(null)}
          />

          <JobPageSourceViewer
            t={t}
            showReferenceText={showReferenceText}
            onOpenReferenceText={() => setShowReferenceText(true)}
            sourceQuery={sourceQuery}
            onSourceQueryChange={setSourceQuery}
            onFindSource={() => {
              const q = String(sourceQuery ?? "").trim();
              if (!q) return;
              openTabAndScroll();
              window.setTimeout(() => onJumpToSource(q), 0);
            }}
            canFindSource={Boolean(extractedText)}
            sourceText={String(extractedText ?? "")}
            previewLimit={SOURCE_TEXT_PREVIEW_LIMIT}
            showFullSourceText={showFullSourceText}
            onToggleShowFullSourceText={() => setShowFullSourceText((v) => !v)}
            sourceFocus={sourceFocus}
            sourceAnchorRef={sourceAnchorRef}
          />
        </TabsContent>
      </Tabs>

      {/* Rename modal (simple inline) */}
      {renaming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-lg">
            <p className="text-sm font-semibold">{t("app.review.rename.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.review.rename.subtitle")}</p>

            <input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="mt-4 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder={t("app.review.rename.placeholder")}
              autoFocus
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setRenaming(false)}>
                {t("app.common.cancel")}
              </Button>
              <Button className="rounded-full" onClick={handleRenameSave}>
                {t("app.common.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}