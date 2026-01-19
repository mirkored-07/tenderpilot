"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { getJobDisplayName, setJobDisplayName, clearJobDisplayName } from "@/lib/pilot-job-names";

import Checklist from "@/components/checklist/Checklist";
import Risks from "@/components/risks/Risks";
import BuyerQuestions from "@/components/questions/BuyerQuestions";
import { ExecutiveSummary, type ExecutiveRisk } from "@/components/executive-summary/ExecutiveSummary";

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

type DecisionState = "proceed" | "caution" | "risk";

/** UI safety: cap initial source-text render to avoid freezing on huge extractions */
const SOURCE_TEXT_PREVIEW_LIMIT = 20_000;

function DecisionBadge({ state }: { state: DecisionState }) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs";
  if (state === "proceed") {
    return <span className={`${base} border-green-200 bg-green-50 text-green-800`}>Proceed</span>;
  }
  if (state === "risk") {
    return <span className={`${base} border-red-200 bg-red-50 text-red-800`}>High disqualification risk</span>;
  }
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-900`}>Proceed with caution</span>;
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
  const raw = String(input ?? "").trim() || "bid_brief";
  return (
    raw
      .replaceAll(/\s+/g, " ")
      .replaceAll(/[\\/:*?"<>|]/g, "")
      .replaceAll(".", "_")
      .slice(0, 80)
      .trim() || "bid_brief"
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
      : "Working on your bid review";

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
          Steps: upload → extract → AI → results. If this stays here for more than 2 minutes, check job_events.
        </p>
      </CardContent>
    </Card>
  );
}

function SnapshotBadge({
  tone,
  label,
}: {
  tone: "good" | "warn" | "risk" | "neutral";
  label: string;
}) {
  const cls =
    tone === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "risk"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-muted bg-muted/30 text-muted-foreground";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${cls}`}>{label}</span>;
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
  const needles = [
    wordsAll.slice(0, 12).join(" "),
    wordsAll.slice(0, 8).join(" "),
  ].filter(Boolean);

  for (const n of needles) {
    const idx = hay.indexOf(n.toLowerCase());
    if (idx >= 0) return makeSnippet(idx, n.length);
  }

  // 3) Fuzzy keyword match:
  // Pick meaningful tokens, find occurrences, then choose the best window.
  const STOP = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","by","via",
    "is","are","be","as","at","from","that","this","these","those",
    "must","should","shall","will","may","can","not","only","all"
  ]);

  const tokens = wordsAll
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length >= 4 && !STOP.has(w));

  if (!tokens.length) return null;

  // Prefer rarer/stronger tokens first
  const uniq = Array.from(new Set(tokens)).slice(0, 12);

  // Collect up to N occurrences per token (avoid heavy loops)
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

  // Score windows around occurrence positions:
  // best window is where most tokens appear in ~700 char neighborhood.
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
      // Early exit if we matched most tokens
      if (best.score >= Math.min(6, uniq.length)) break;
    }
  }

  // Require at least 2 strong tokens to avoid random matches
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

function decisionFromExecutive(executive: any): DecisionState {
  const badge = String(executive?.decisionBadge ?? executive?.decision ?? "").toLowerCase();
  if (badge.includes("risk") || badge.includes("no-go") || badge.includes("no go")) return "risk";
  if (badge.includes("caution")) return "caution";
  if (badge.includes("go") || badge.includes("proceed")) return "proceed";
  return "caution";
}

function toExecutiveModel(args: { raw: any }) {
  const { raw } = args;

  const decisionBadge = String(raw?.decisionBadge ?? raw?.decision ?? "").trim();
  const decisionLine = String(raw?.decisionLine ?? "").trim();

  const keyFindings = Array.isArray(raw?.keyFindings) ? raw.keyFindings : [];
  const nextActions = Array.isArray(raw?.nextActions) ? raw.nextActions : [];
  const topRisks = Array.isArray(raw?.topRisks) ? raw.topRisks : [];

  const submissionDeadline = raw?.submissionDeadline ? String(raw.submissionDeadline).trim() : "";

  const normalizedTopRisks: ExecutiveRisk[] = topRisks
    .slice(0, 3)
    .map((r: any) => {
      const titleCandidate = String(r?.title ?? r?.risk ?? r?.text ?? "").trim();
      const detailCandidate = String(
        r?.detail ??
          r?.description ??
          r?.why ??
          r?.impact ??
          r?.mitigation ??
          ""
      ).trim();

      // If the model puts the “risk text” into description/detail instead of title, use that.
      const title = titleCandidate || detailCandidate;

      return {
        title,
        severity: String(r?.severity ?? r?.level ?? "medium").toLowerCase() as any,
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
  // We store proposal_draft.proposal_draft typically as a STRING with the outline.
  if (!draft) return ["Draft not available."];

  if (typeof draft === "string") {
    const lines = draft.split("\n").map((l) => l.trimEnd());
    return lines.filter((l) => l.trim().length > 0);
  }

  // If someone stores structured sections, render a clean outline.
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
  lines.push("TenderPilot summary");
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

  // ✅ now includes idx so we can auto-scroll
  const [sourceFocus, setSourceFocus] = useState<{ query: string; snippet: string; idx: number | null } | null>(null);

  /** UI safety state for very large extracted text */
  const [showFullSourceText, setShowFullSourceText] = useState(false);

  const [exporting, setExporting] = useState<null | "summary">(null);

  const mountedRef = useRef(true);
  const sourceAnchorRef = useRef<HTMLSpanElement | null>(null);

  // ✅ used to scroll the ScrollArea viewport to the excerpt
  const sourceScrollRef = useRef<HTMLDivElement | null>(null);

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

  // ✅ PATCH 1A: polling robustness + graceful stop + error pressure guard
  useEffect(() => {
    if (invalidLink) return;

    const supabase = supabaseBrowser();

    const POLL_INTERVAL_MS = 2500;
    const MAX_POLL_MS = 10 * 60 * 1000; // hard stop (frontend only)
    const DONE_GRACE_POLLS = 12; // ~30s grace window when status flips to done but results not visible yet
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
          setError("This bid review could not be loaded. Please return to your jobs and open it again.");
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
          // Can happen temporarily (session/RLS timing); don't fail the page.
          console.warn(resErr);
        }

        setResult((resultRow as any) ?? null);

        setLoading(false);

        const status = String((jobRow as any)?.status ?? "queued") as JobStatus;
        setPolling(status === "queued" || status === "processing" || (status === "done" && !resultRow));
      } catch (e) {
        console.error(e);
        setError("This bid review could not be loaded. Please refresh and try again.");
        setJob(null);
        setResult(null);
        setLoading(false);
        stopPolling();
      }
    }

    async function poll() {
      // Hard stop: prevent infinite polling from UI side.
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setError("This bid review is taking longer than expected. Please refresh the page or check again later.");
        stopPolling();
        return;
      }

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
          // relieve pressure a bit after successful reads
          pollErrors = Math.max(0, pollErrors - 1);
        }

        setResult((resultRow as any) ?? null);

        // Terminal state logic:
        // - failed: stop polling immediately (results may or may not exist)
        // - done: stop when results exist; otherwise allow a short grace window
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
          // reset terminal grace counter if we’re not terminal anymore (rare but safe)
          doneWithoutResult = 0;
        }

        if (pollErrors >= MAX_POLL_ERRORS) {
          setError("We are having trouble loading this bid review. Please refresh the page and try again.");
          stopPolling();
          return;
        }

        setPolling(status === "queued" || status === "processing" || (status === "done" && !resultRow));
      } catch (e) {
        console.error(e);
        pollErrors += 1;
        if (pollErrors >= MAX_POLL_ERRORS) {
          setError("We are having trouble loading this bid review. Please refresh the page and try again.");
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

  // ✅ IMPORTANT: questions come from proposal_draft.buyer_questions (DB contract)
  const questions = useMemo(() => {
    const pd = (result as any)?.proposal_draft ?? null;
    return normalizeQuestions(
      pd?.buyer_questions ?? pd?.clarifications ?? (result as any)?.buyer_questions ?? (result as any)?.clarifications
    );
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

  // ✅ PATCH 1B: derive "finalizing" state (job done, but results payload is still empty)
  const draftLinesForUi = useMemo(() => renderDraftPlain(draftForUi), [draftForUi]);

  const hasDraftForUi = useMemo(() => {
    if (!draftLinesForUi.length) return false;
    if (draftLinesForUi.length === 1 && draftLinesForUi[0].toLowerCase().includes("not available")) return false;
    return true;
  }, [draftLinesForUi]);

  const hasAnyResultsPayload = useMemo(() => {
    return Boolean(extractedText || checklist.length || risks.length || questions.length || hasDraftForUi);
  }, [extractedText, checklist.length, risks.length, questions.length, hasDraftForUi]);

  const finalizingResults = useMemo(() => showReady && !hasAnyResultsPayload, [showReady, hasAnyResultsPayload]);

  const decisionState = useMemo(() => decisionFromExecutive(executive), [executive]);

  const mustCount = mustItems.length;
  const topRisks = (executive.topRisks ?? []).slice(0, 3);

  const snapshotBadge = useMemo(() => {
    if (!showReady) return { tone: "neutral" as const, label: "Proceed with caution" };
    if (mustCount >= 1) return { tone: "risk" as const, label: "High disqualification risk" };
    if (topRisks.some((r) => String(r?.severity ?? "").toLowerCase() === "high")) return { tone: "warn" as const, label: "Proceed with caution" };
    return { tone: "good" as const, label: "Proceed" };
  }, [showReady, mustCount, topRisks]);

  const snapshotReasons = useMemo(() => {
    const list: { tone: "good" | "warn" | "risk" | "neutral"; label: string }[] = [];

    if (!showReady) {
      list.push({ tone: "neutral", label: "Analyzing requirements, risks, and clarifications." });
      return list;
    }

    if (mustCount >= 1) list.push({ tone: "risk", label: `Potential disqualifiers found (${mustCount} MUST). Review these first.` });
    else list.push({ tone: "good", label: "No potential disqualifiers detected from MUST items." });

    if (topRisks.some((r) => String(r?.severity ?? "").toLowerCase() === "high")) {
      list.push({ tone: "warn", label: "High risk items detected. Confirm feasibility before committing resources before committing resources." });
    } else if (topRisks.length) {
      list.push({ tone: "good", label: "Top risks look manageable with clarifications and careful response." });
    } else {
      list.push({ tone: "good", label: "No risks detected." });
    }

    if (executive.submissionDeadline) list.push({ tone: "warn", label: "Deadline appears strict. Prepare submission early to avoid format errors." });

    return list.slice(0, 3);
  }, [showReady, mustCount, topRisks, executive.submissionDeadline]);

  const potentialDisqualifiers = useMemo(() => {
    if (!showReady) return [];
    return mustItems.slice(0, 10);
  }, [showReady, mustItems]);

  const decisionSummaryReasons = useMemo(() => {
    if (!showReady) return [];
    return snapshotReasons.map((x) => x.label);
  }, [showReady, snapshotReasons]);

  const decisionSummaryDisqualifiers = useMemo(() => {
    if (!showReady) return [];
    return potentialDisqualifiers.map((x) => String(x ?? "").trim()).filter(Boolean);
  }, [showReady, potentialDisqualifiers]);

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

  function onJumpToSource(query: string) {
    const match = findExcerpt(extractedText, query);

    if (!match) {
      setSourceFocus({ query, snippet: "No matching excerpt found in the source text.", idx: null });
      setTab("text");
      return;
    }

    // If the match is beyond the preview limit, ensure the full text is rendered so we can scroll to it.
    if (match.idx > SOURCE_TEXT_PREVIEW_LIMIT) {
      setShowFullSourceText(true);
    }

    setSourceFocus({ query, snippet: match.snippet, idx: match.idx });
    setTab("text");
  }

  // ✅ Auto-scroll the Source text viewport to the matched location when opening the tab
	useEffect(() => {
	  if (tab !== "text") return;
	  if (!sourceFocus || sourceFocus.idx === null) return;

	  // wait for render, then scroll to the real anchor
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
    a.download = `tenderpilot_summary_${jobId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportBidBriefPdf() {
    if (!job) return;

    setError(null);

    const title = String(displayName || job.file_name || "Bid brief").trim() || "Bid brief";
    const created = formatDate(job.created_at);

    const mustLines = mustItems.length
      ? `<ol>${mustItems.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol>`
      : `<p class="empty">No mandatory requirements detected.</p>`;

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
    const decisionBadgeRaw = String(executive.decisionBadge ?? "").trim();
    const decisionBadge = decisionBadgeRaw.toLowerCase();

    const decisionLabel =
      decisionBadge.includes("risk") || decisionBadge.includes("no-go") || decisionBadge.includes("no go")
        ? "High disqualification risk"
        : decisionBadge.includes("caution")
        ? "Proceed with caution"
        : decisionBadge.includes("go") || decisionBadge.includes("proceed")
        ? "Proceed"
        : decisionBadgeRaw
        ? decisionBadgeRaw
        : decisionLine
        ? "Decision summary"
        : "";

    const deadline = executive.submissionDeadline ? escapeHtml(String(executive.submissionDeadline)) : "";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} bid brief</title>
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
          <div class="brand">TenderPilot</div>
          <div class="docTitle">Bid brief</div>
          <div class="pillRow">
            ${decisionLabel ? `<span class="pill emph">${escapeHtml(decisionLabel)}</span>` : ""}
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
              <div class="subhead">Recommended next actions</div>
              ${nextActionsLines}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <h2>Mandatory requirements</h2>
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
      <span>TenderPilot</span>
      <span>Bid brief</span>
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
    const ok = window.confirm("Delete this bid review? This cannot be undone.");
    if (!ok) return;

    try {
      const supabase = supabaseBrowser();
      await supabase.from("job_results").delete().eq("job_id", jobId);
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
      router.push("/app/jobs");
    } catch (e) {
      console.error(e);
      setError("Could not delete this job. Please try again.");
    }
  }

  if (invalidLink || (!loading && !job && !error)) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Bid kit</p>
            <p className="mt-1 text-sm text-muted-foreground">Your bid kit will appear here.</p>
            <p className="mt-2 text-sm text-red-600">This bid link is invalid. Return to your jobs and open it again.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/jobs">Back to jobs</Link>
            </Button>
            <Button variant="outline" className="rounded-full" disabled>
              Export bid brief PDF
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
          <p className="text-sm text-muted-foreground">Your bid kit will appear here.</p>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{displayName || job?.file_name || "Bid kit"}</h1>

            <Button variant="outline" className="rounded-full" onClick={() => setRenaming(true)} disabled={!job || showProgress}>
              Rename
            </Button>

            {/* ✅ no double-badge nesting */}
            {statusBadge(job?.status ?? "queued")}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {showProgress
              ? "Your bid review is being prepared. This page updates automatically."
              : showFailed
              ? "This bid review needs attention."
              : "Your bid review is ready."}
          </p>

          <p className="mt-2 text-sm text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Back to jobs</Link>
          </Button>

          <Button variant="outline" className="rounded-full" onClick={exportBidBriefPdf} disabled={!canDownload}>
            Export bid brief PDF
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

      {/* Executive summary */}
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Executive summary</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {showReady
                  ? "Mandatory requirements require careful verification before committing resources."
                  : "We’ll populate findings, risks, and actions once processing completes."}
              </p>
            </div>
            <SnapshotBadge tone={snapshotBadge.tone} label={snapshotBadge.label} />
          </div>

          <div className="mt-4">
            <ExecutiveSummary
              decisionBadge={snapshotBadge.label}
              decisionLine={executive.decisionLine}
              keyFindings={executive.keyFindings}
              topRisks={executive.topRisks}
              nextActions={executive.nextActions}
              submissionDeadline={executive.submissionDeadline}
            />
          </div>
        </CardContent>
      </Card>

      {/* Decision summary block */}
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <DecisionBadge state={decisionState} />
              <p className="text-sm text-muted-foreground">Based on mandatory requirements, identified risks, and ambiguities.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">Key reasons</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {decisionSummaryReasons.length ? decisionSummaryReasons.map((x, i) => <li key={i}>{x}</li>) : <li>Analyzing…</li>}
              </ul>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">Potential disqualifiers</p>
              {decisionSummaryDisqualifiers.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {decisionSummaryDisqualifiers.slice(0, 6).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">None detected.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            This assessment supports go/no-go decisions and early drafting. Always verify mandatory requirements against the original tender documents.
          </p>
        </CardContent>
      </Card>

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
            Draft
          </TabsTrigger>
          <TabsTrigger value="text" className="rounded-full">
            Source text
          </TabsTrigger>
        </TabsList>

        {/* ✅ PATCH 1C: section guards + finalizing state + better empty states */}
        <TabsContent value="checklist">
          <div className="flex items-center justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => copySection("requirements")} disabled={!canDownload}>
              {copiedSection === "requirements" ? "Copied" : "Copy section"}
            </Button>
          </div>

          <div className="mt-3">
            {showFailed ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Analysis failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This bid review could not be completed. Please re-upload the document or try again.
                  </p>
                </CardContent>
              </Card>
            ) : !showReady ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Requirements are being extracted</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We&apos;re scanning the tender for MUST/SHOULD/INFO items. This section will populate automatically.
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
            ) : checklist.length ? (
              <Checklist checklist={checklist} extractedText={extractedText} onJumpToSource={onJumpToSource} />
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">No requirements extracted</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We didn&apos;t detect explicit MUST/SHOULD/INFO items. Verify the source text, or try re-uploading a cleaner PDF.
                  </p>
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    This bid review could not be completed. Please re-upload the document or try again.
                  </p>
                </CardContent>
              </Card>
            ) : !showReady ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Identifying key risks</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We&apos;re highlighting technical, legal, commercial, and delivery risks from the tender.
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
            ) : risks.length ? (
              <Risks risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} />
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">No major risks detected</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We didn&apos;t flag high-impact risks. Still verify deadlines, eligibility, and mandatory deliverables in the source text.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="questions">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => copySection("clarifications")}
              disabled={!canDownload}
            >
              {copiedSection === "clarifications" ? "Copied" : "Copy section"}
            </Button>
          </div>

          <div className="mt-3">
            {showFailed ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Analysis failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This bid review could not be completed. Please re-upload the document or try again.
                  </p>
                </CardContent>
              </Card>
            ) : !showReady ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">Generating clarifications</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We&apos;re listing buyer questions and ambiguities to resolve before committing to a proposal.
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
              />
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold">No clarifications identified</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We didn&apos;t detect explicit buyer questions or ambiguities. Double-check eligibility, scope boundaries, and submission format in the source text.
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
                  <p className="text-sm font-semibold">Draft outline</p>
                  <p className="mt-1 text-sm text-muted-foreground">A short structured starting point. Always tailor before submission.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => copySection("draft")} disabled={!canDownload}>
                    {copiedSection === "draft" ? "Copied" : "Copy section"}
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              {showFailed ? (
                <p className="text-sm text-muted-foreground">
                  This bid review could not be completed. Please re-upload the document or try again.
                </p>
              ) : !showReady ? (
                <p className="text-sm text-muted-foreground">Preparing a proposal draft outline…</p>
              ) : finalizingResults ? (
                <p className="text-sm text-muted-foreground">
                  Finalizing results… this should take only a few seconds. If it doesn&apos;t, refresh the page.
                </p>
              ) : hasDraftForUi ? (
                <pre className="text-sm whitespace-pre-wrap">{draftLinesForUi.join("\n")}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No draft outline was generated. Try re-uploading the PDF or verify the source text tab.
                </p>
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

          {/* ✅ Only change: render-safe source text preview + toggle + scroll anchor */}
          {(() => {
            const fullText = extractedText || "";
            const isLarge = fullText.length > SOURCE_TEXT_PREVIEW_LIMIT;

            const visibleText =
              !isLarge || showFullSourceText
                ? fullText
                : fullText.slice(0, SOURCE_TEXT_PREVIEW_LIMIT);

            return (
              <>
                <div ref={sourceScrollRef}>
                  <ScrollArea className="mt-4 h-[520px] rounded-2xl border bg-muted/20">
                    <pre className="p-4 whitespace-pre-wrap text-sm">
					  {(() => {
						const fullText = extractedText || "";
						const isLarge = fullText.length > SOURCE_TEXT_PREVIEW_LIMIT;
						const visibleText = !isLarge || showFullSourceText ? fullText : fullText.slice(0, SOURCE_TEXT_PREVIEW_LIMIT);

						if (!sourceFocus?.idx && sourceFocus?.idx !== 0) {
						  return visibleText || "No source text yet.";
						}

						const idx = sourceFocus.idx ?? 0;
						if (idx < 0 || idx >= visibleText.length) {
						  return visibleText || "No source text yet.";
						}

						// Highlight a short window (avoid huge spans)
						const highlightLen = Math.min(120, visibleText.length - idx);
						const before = visibleText.slice(0, idx);
						const mid = visibleText.slice(idx, idx + highlightLen);
						const after = visibleText.slice(idx + highlightLen);

						return (
						  <>
							{before}
							<span ref={sourceAnchorRef} className="bg-yellow-200/60 rounded px-1">
							  {mid}
							</span>
							{after}
						  </>
						);
					  })()}
					</pre>

                  </ScrollArea>
                </div>

                {isLarge && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullSourceText((v) => !v)}
                    >
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
    </div>
  );
}
