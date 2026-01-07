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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function DecisionBadge({ state }: { state: DecisionState }) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs";
  if (state === "proceed") {
    return <span className={`${base} border-green-200 bg-green-50 text-green-800`}>Proceed with bid</span>;
  }
  if (state === "risk") {
    return <span className={`${base} border-red-200 bg-red-50 text-red-800`}>High disqualification risk</span>;
  }
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-900`}>Proceed with caution</span>;
}

function CompactPill({ tone, children }: { tone: "ok" | "warn" | "bad"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "bad"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${cls}`}>{children}</span>;
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

async function exportDraftDocx(args: { fileName?: string; draft: any; mode: "outline" | "full"; jobId?: string }) {
  const { fileName, draft, mode, jobId } = args;

  // Lazy import to keep bundle lean.
  const mod = await import("docx");
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = mod as any;

  const title = String(fileName ?? "Tender draft").trim() || "Tender draft";

  const sections = (() => {
    if (!draft) return [] as { title: string; bullets: string[] }[];
    if (typeof draft === "string") {
      return [{ title: "Draft", bullets: String(draft).split("\n").filter(Boolean) }];
    }
    const raw = Array.isArray(draft?.sections) ? draft.sections : [];
    return raw
      .map((s: any) => ({
        title: String(s?.title ?? "Section").trim(),
        bullets: (Array.isArray(s?.bullets) ? s.bullets : [])
          .map((b: any) => String(b ?? "").trim())
          .filter(Boolean),
      }))
      .filter((s: any) => s.title || s.bullets.length);
  })();

  const children: any[] = [];
  children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Drafting support only. Always verify requirements against the original tender documents.",
          italics: true,
        }),
      ],
    })
  );
  children.push(new Paragraph({ text: "" }));

  if (!sections.length) {
    children.push(new Paragraph("Draft not available."));
  } else {
    for (const s of sections) {
      children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }));
      if (s.bullets.length) {
        s.bullets.forEach((b: string) => {
          const line = String(b ?? "").trim();
          if (!line) return;
          children.push(new Paragraph({ text: line, bullet: { level: 0 } as any }));
        });
      } else {
        children.push(new Paragraph(""));
      }
      if (mode === "full") children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tenderpilot_${mode === "outline" ? "draft_outline" : "draft"}_${jobId ?? "job"}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  return raw
    .replaceAll(/\s+/g, " ")
    .replaceAll(/[\\/:*?"<>|]/g, "")
    .replaceAll(".", "_")
    .slice(0, 80)
    .trim() || "bid_brief";
}

function getExportBaseName(args: { displayName?: string; originalFileName?: string }) {
  const preferred = String(args.displayName ?? "").trim();
  if (preferred) return toSafeFileBaseName(preferred);

  const orig = String(args.originalFileName ?? "").trim();
  if (!orig) return "bid_brief";

  const noExt = orig.replace(/\.[^.]+$/, "");
  return toSafeFileBaseName(noExt);
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

  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;

  const start = Math.max(0, idx - 180);
  const end = Math.min(t.length, idx + q.length + 220);
  const snippet = t.slice(start, end).replace(/\s+/g, " ").trim();

  return { idx, snippet };
}

function toPlainTextSummary(args: {
  fileName?: string;
  createdAt?: string;
  checklist: any[];
  risks: any[];
  questions: string[];
  draft: any;
}) {
  const { fileName, createdAt, checklist, risks, questions, draft } = args;

  const must = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"));
  const should = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("SHOULD"));
  const info = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("INFO"));

  const lines: string[] = [];
  lines.push("TenderPilot summary");
  lines.push("");
  if (fileName) lines.push(`File: ${fileName}`);
  if (createdAt) lines.push(`Created: ${formatDate(createdAt)}`);
  lines.push("");

  lines.push("Requirements");
  lines.push(`MUST: ${must.length}  SHOULD: ${should.length}  INFO: ${info.length}`);
  lines.push("");

  const renderReq = (label: string, items: any[]) => {
    lines.push(label);
    if (!items.length) lines.push("None detected.");
    else items.forEach((x, i) => lines.push(`${i + 1}. ${String(x?.text ?? x?.statement ?? x?.requirement ?? x?.item ?? x?.title ?? "").trim()}`));
    lines.push("");
  };

  renderReq("MUST", must);
  renderReq("SHOULD", should);
  renderReq("INFO", info);

  lines.push("Risks");
  if (!risks.length) lines.push("No risks detected.");
  else {
    risks.forEach((r, i) => {
      const sev = String(r?.severity ?? r?.level ?? r?.rating ?? "medium");
      const title = String(r?.title ?? r?.risk ?? r?.name ?? r?.summary ?? r?.text ?? "").trim();
      const detail = String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim();
      lines.push(`${i + 1}. [${sev}] ${title}${detail ? ` — ${detail}` : ""}`);
    });
  }
  lines.push("");

  lines.push("Clarifications");
  if (!questions.length) lines.push("No clarifications suggested.");
  else questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  lines.push("");

  lines.push("Draft outline");
  if (!draft) lines.push("Draft not available.");
  else if (typeof draft === "string") lines.push(draft);
  else lines.push(JSON.stringify(draft, null, 2));
  lines.push("");

  lines.push("Note");
  lines.push("Drafting support only. Always verify against the original tender document.");
  return lines.join("\n");
}

function pickText(x: any) {
  return String(x?.text ?? x?.statement ?? x?.requirement ?? x?.item ?? x?.title ?? x?.summary ?? x?.name ?? "").trim();
}

function normalizeSeverity(raw: any): "High" | "Medium" | "Low" {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("high")) return "High";
  if (s.includes("low")) return "Low";
  return "Medium";
}

function extractDeadlineFromRequirements(mustItems: string[]): string | null {
  // Very lightweight: if requirement contains "submit" + a date-like token, return the sentence.
  // We intentionally avoid parsing into a date object to prevent false precision.
  for (const line of mustItems) {
    const t = line.toLowerCase();
    if (!t.includes("submit") && !t.includes("deadline")) continue;
    // If the line already has a date/time, keep it as-is (user-friendly).
    const hasDateish =
      /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/.test(line) ||
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(line) ||
      /\b\d{1,2}:\d{2}\b/.test(line);
    if (hasDateish) return line.replace(/^[-*\d.\s]+/, "").trim();
  }
  return null;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;
  const router = useRouter();

  const [job, setJob] = useState<DbJob | null>(null);
  const [result, setResult] = useState<DbJobResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string>("");
  const [renaming, setRenaming] = useState(false);

  const [tab, setTab] = useState<"checklist" | "risks" | "questions" | "draft" | "text">("checklist");
  const [sourceFocus, setSourceFocus] = useState<{ query: string; snippet: string } | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<null | "requirements" | "risks" | "clarifications" | "draft">(null);
  const [exporting, setExporting] = useState<null | "outline" | "full">(null);

  const pollRef = useRef<number | null>(null);

  async function fetchAll(opts?: { silent?: boolean }) {
    if (!jobId) return;
    const silent = opts?.silent ?? false;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    const supabase = supabaseBrowser();

    const { data: jobData, error: jobErr } = await supabase
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status,credits_used,created_at,updated_at")
      .eq("id", jobId)
      .single();

    if (jobErr) {
      setError(jobErr.message);
      if (!silent) setLoading(false);
      return;
    }

    setJob(jobData as DbJob);

    const { data: resData } = await supabase
      .from("job_results")
      .select("job_id,user_id,extracted_text,checklist,risks,proposal_draft,created_at,updated_at")
      .eq("job_id", jobId)
      .maybeSingle();

    setResult((resData ?? null) as DbJobResult | null);

    if (!silent) setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    const stored = getJobDisplayName(jobId);
    if (stored) setDisplayName(stored);
  }, [jobId]);

  useEffect(() => {
    if (!job) return;

    const isWorking = job.status === "queued" || job.status === "processing";
    if (!isWorking) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    if (pollRef.current) return;

    pollRef.current = window.setInterval(() => {
      fetchAll({ silent: true });
    }, 2000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, job?.id]);

  const checklist = useMemo(() => (Array.isArray(result?.checklist) ? result?.checklist : []), [result?.checklist]);
  const risks = useMemo(() => (Array.isArray(result?.risks) ? result?.risks : []), [result?.risks]);
  const extractedText = result?.extracted_text ?? "";

  const mustItems = useMemo(() => {
    return checklist
      .filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"))
      .map((x) => pickText(x))
      .filter(Boolean);
  }, [checklist]);

  const shouldItems = useMemo(() => {
    return checklist
      .filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("SHOULD"))
      .map((x) => pickText(x))
      .filter(Boolean);
  }, [checklist]);

  const infoItems = useMemo(() => {
    return checklist
      .filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("INFO"))
      .map((x) => pickText(x))
      .filter(Boolean);
  }, [checklist]);

  const mustCount = useMemo(() => mustItems.length, [mustItems]);

  const highRiskCount = useMemo(
    () => risks.filter((r) => String(r?.severity ?? r?.level ?? r?.rating ?? "").toLowerCase().includes("high")).length,
    [risks]
  );

  const questions = useMemo(() => {
    const q: string[] = [];
    shouldItems.forEach((t) => q.push(`Can you clarify expectations regarding: "${t}"?`));
    risks.forEach((r) => {
      const title = pickText(r);
      if (title) q.push(`Can you clarify the following risk or ambiguity: "${title}"?`);
    });
    return Array.from(new Set(q));
  }, [shouldItems, risks]);

  const decision = useMemo(() => {
    if (!job) {
      return {
        state: "caution" as DecisionState,
        summary: "Your bid review will appear here.",
        reasons: ["Analyzing requirements, risks, and clarifications."],
        disqualifiers: [] as { tone: "ok" | "warn" | "bad"; text: string }[],
        isSkeleton: true,
      };
    }

    if (job.status === "failed") {
      return {
        state: "caution" as DecisionState,
        summary: "The analysis could not be completed.",
        reasons: ["Please try again or re-upload the file.", "If the document is scanned, extraction may be incomplete."],
        disqualifiers: [{ tone: "warn" as const, text: "Potential disqualifiers could not be fully assessed." }],
        isSkeleton: false,
      };
    }

    if (job.status !== "done") {
      return {
        state: "caution" as DecisionState,
        summary: "We’re preparing your decision snapshot.",
        reasons: ["Analyzing mandatory requirements…", "Evaluating risks and ambiguities…"],
        disqualifiers: [] as { tone: "ok" | "warn" | "bad"; text: string }[],
        isSkeleton: true,
      };
    }

    const checklistEmpty = checklist.length === 0;
    const risksEmpty = risks.length === 0;

    const topMust = mustItems.slice(0, 3);

    const disqualifiers: { tone: "ok" | "warn" | "bad"; text: string }[] = [];
    if (topMust.length) {
      topMust.forEach((t) => disqualifiers.push({ tone: "warn", text: `Mandatory item to verify: ${t}` }));
    } else {
      disqualifiers.push({ tone: "ok", text: "No explicit mandatory requirements extracted." });
    }

    if (checklistEmpty && risksEmpty) {
      return {
        state: "caution" as DecisionState,
        summary: "Some sections could not be fully analyzed.",
        reasons: ["Structured items were not extracted reliably.", "Review the source text and verify key requirements manually."],
        disqualifiers,
        isSkeleton: false,
      };
    }

    if (mustCount > 0) {
      return {
        state: "risk" as DecisionState,
        summary: "Mandatory requirements require careful verification.",
        reasons: [
          `Potential disqualifiers identified (${mustCount} mandatory requirement${mustCount === 1 ? "" : "s"}).`,
          "Confirm submission steps, forms, and eligibility requirements early.",
        ],
        disqualifiers,
        isSkeleton: false,
      };
    }

    if (highRiskCount > 0) {
      return {
        state: "caution" as DecisionState,
        summary: "No obvious disqualifiers detected, but risks need review.",
        reasons: [
          `There ${highRiskCount === 1 ? "is" : "are"} ${highRiskCount} high risk${highRiskCount === 1 ? "" : "s"} to address.`,
          "Check ambiguities and clarifications before drafting.",
        ],
        disqualifiers,
        isSkeleton: false,
      };
    }

    return {
      state: "proceed" as DecisionState,
      summary: "No disqualifiers detected based on extracted items.",
      reasons: ["Review SHOULD items and clarifications before drafting.", "Tailor the draft to the buyer’s evaluation criteria."],
      disqualifiers,
      isSkeleton: false,
    };
  }, [job, checklist.length, risks.length, mustItems, mustCount, highRiskCount]);

  const snapshot = useMemo(() => {
    if (!job) return { tone: "neutral" as const, badge: "Preparing", line: "Your bid kit will appear here." };

    if (job.status === "failed") {
      return { tone: "risk" as const, badge: "Needs attention", line: "Something went wrong while creating your bid review." };
    }

    if (job.status !== "done") {
      return { tone: "neutral" as const, badge: "In progress", line: "We’re preparing your requirements, risks, and clarifications." };
    }

    const checklistEmpty = checklist.length === 0;
    const risksEmpty = risks.length === 0;

    if (checklistEmpty && risksEmpty) {
      return {
        tone: "warn" as const,
        badge: "Needs review",
        line: "We couldn’t extract structured items. Review the source text and verify key requirements manually.",
      };
    }

    if (mustCount > 0) {
      return { tone: "risk" as const, badge: "Check disqualifiers", line: `Potential disqualifiers found (${mustCount} MUST). Review these first.` };
    }

    if (highRiskCount > 0) {
      return { tone: "warn" as const, badge: "Review risks", line: `No disqualifiers detected, but there ${highRiskCount === 1 ? "is" : "are"} ${highRiskCount} high risk${highRiskCount === 1 ? "" : "s"} to review.` };
    }

    return { tone: "good" as const, badge: "Looks clear", line: "No disqualifiers detected. Review SHOULD items and clarifications before drafting." };
  }, [job, mustCount, highRiskCount, checklist.length, risks.length]);

  function onJumpToSource(query: string) {
    const q = (query ?? "").trim();

    if (!q) {
      setSourceFocus(null);
      setTab("text");
      return;
    }

    const hit = findExcerpt(extractedText, q);
    if (!hit) {
      setSourceFocus({ query: q, snippet: "No matching excerpt found in the source text." });
    } else {
      setSourceFocus({ query: q, snippet: hit.snippet });
    }
    setTab("text");
  }

  async function downloadSummary() {
    const text = toPlainTextSummary({
      fileName: displayName || job?.file_name,
      createdAt: job?.created_at,
      checklist,
      risks,
      questions,
      draft: result?.proposal_draft ?? null,
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const base = getExportBaseName({ displayName, originalFileName: job?.file_name });
    a.download = `${base}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str: string) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function exportBidBriefPdf() {
    if (!job) return;

    setError(null);

    const base = getExportBaseName({ displayName, originalFileName: job.file_name });
    const title = String(displayName || job.file_name || "Bid brief").trim() || "Bid brief";
    const created = formatDate(job.created_at);

    const mustLines = mustItems.length
      ? `<ol>${mustItems.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol>`
      : `<p>No mandatory requirements detected.</p>`;

    const riskLines = risks.length
      ? `<ol>${risks
          .slice(0, 25)
          .map((r: any) => {
            const sev = String(r?.severity ?? r?.level ?? r?.rating ?? "medium").toLowerCase();
            const title = escapeHtml(pickText(r));
            const detail = escapeHtml(String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim());
            return `<li><strong>${escapeHtml(sev.toUpperCase())}</strong>: ${title}${detail ? `<div class="muted">${detail}</div>` : ""}</li>`;
          })
          .join("")}</ol>`
      : `<p>No risks detected.</p>`;

    const keyFindingsLines = executive.keyFindings?.length
      ? `<ol>${executive.keyFindings.map((t) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ol>`
      : `<p>No key findings available.</p>`;

    const nextActionsLines = executive.nextActions?.length
      ? `<ol>${executive.nextActions.map((t) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ol>`
      : `<p>No next actions available.</p>`;

    const deadline = executive.submissionDeadline ? escapeHtml(String(executive.submissionDeadline)) : "";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} bid brief</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 0; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1 { font-size: 20px; margin: 0 0 6px 0; }
      h2 { font-size: 13px; margin: 16px 0 8px 0; break-after: avoid; page-break-after: avoid; }
      .muted { color: #555; font-size: 12px; }
      .card { border: 1px solid #ddd; border-radius: 14px; padding: 12px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
      ol { padding-left: 18px; margin: 8px 0 0 0; }
      li { margin: 6px 0; }
      .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; border: 1px solid #ddd; font-size: 12px; }
      .row { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .disclaimer { margin-top: 14px; font-size: 12px; color: #444; }
    </style>
  </head>
  <body>
    <h1>Bid brief</h1>
    <div class="muted">${escapeHtml(title)}${created ? ` · Created ${escapeHtml(created)}` : ""}</div>

    <div class="card">
      <h2>Executive summary</h2>
      <div class="row">
        ${executive.decision ? `<span class="pill">${escapeHtml(executive.decisionLine)}</span>` : ""}
        ${deadline ? `<span class="pill">Deadline ${deadline}</span>` : ""}
      </div>
      <div style="margin-top:10px"><strong>Key findings</strong>${keyFindingsLines}</div>
      <div style="margin-top:10px"><strong>Recommended next actions</strong>${nextActionsLines}</div>
    </div>

    <div class="card">
      <h2>Mandatory requirements</h2>
      ${mustLines}
    </div>

    <div class="card">
      <h2>Risks</h2>
      ${riskLines}
    </div>

    <div class="disclaimer">
      Drafting support only. Always verify requirements against the original tender documents.
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

  async function deleteJob() {
    if (!jobId || !job) return;
    const ok = window.confirm("This permanently deletes the job and all results.");
    if (!ok) return;

    const supabase = supabaseBrowser();

    // Remove storage object first (best effort)
    if (job.file_path) {
      await supabase.storage.from("uploads").remove([job.file_path]);
    }

    await supabase.from("job_results").delete().eq("job_id", jobId);
    await supabase.from("job_events").delete().eq("job_id", jobId);
    await supabase.from("jobs").delete().eq("id", jobId);

    clearJobDisplayName(jobId);
    router.push("/app/jobs");
  }

  async function copySection(which: "requirements" | "risks" | "clarifications" | "draft") {
    if (!job) return;

    if (which === "requirements") {
      const lines: string[] = [];
      lines.push("Requirements");
      lines.push("");
      const render = (label: string, items: string[]) => {
        lines.push(label);
        if (!items.length) lines.push("None detected.");
        else items.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
        lines.push("");
      };
      render("MUST", mustItems);
      render("SHOULD", shouldItems);
      render("INFO", infoItems);
      const ok = await safeCopy(lines.join("\n").trim());
      if (ok) {
        setCopiedSection("requirements");
        window.setTimeout(() => setCopiedSection(null), 1200);
      }
      return;
    }

    if (which === "risks") {
      const lines: string[] = [];
      lines.push("Risks");
      lines.push("");
      if (!risks.length) lines.push("No risks detected.");
      else {
        risks.forEach((r, i) => {
          const sev = String(r?.severity ?? r?.level ?? r?.rating ?? "medium").toLowerCase();
          const title = pickText(r);
          const detail = String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? r?.mitigation ?? "").trim();
          lines.push(`${i + 1}. [${sev}] ${title}${detail ? ` — ${detail}` : ""}`);
        });
      }
      const ok = await safeCopy(lines.join("\n").trim());
      if (ok) {
        setCopiedSection("risks");
        window.setTimeout(() => setCopiedSection(null), 1200);
      }
      return;
    }

    if (which === "clarifications") {
      const lines: string[] = [];
      lines.push("Clarifications");
      lines.push("");
      if (!questions.length) lines.push("No clarifications suggested.");
      else questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
      const ok = await safeCopy(lines.join("\n").trim());
      if (ok) {
        setCopiedSection("clarifications");
        window.setTimeout(() => setCopiedSection(null), 1200);
      }
      return;
    }

    const d = result?.proposal_draft ?? null;
    const text = !d ? "Draft not available." : typeof d === "string" ? d : JSON.stringify(d, null, 2);
    const ok = await safeCopy(String(text));
    if (ok) {
      setCopiedSection("draft");
      window.setTimeout(() => setCopiedSection(null), 1200);
    }
  }

  // -------- Executive Summary composition (no backend changes) --------
  const executive = useMemo(() => {
    const decisionLine =
      decision.state === "proceed"
        ? "No obvious blockers detected based on extracted items. Review SHOULD items before drafting."
        : decision.state === "risk"
        ? "Mandatory requirements require careful verification before committing resources."
        : "Some items or risks require clarification before committing.";

    const deadline = extractDeadlineFromRequirements(mustItems);

    // Key findings: 5–7 bullets, derived from existing items (not new AI)
    const findings: string[] = [];

    if (deadline) findings.push("Submission deadline appears strict. Prepare submission early to reduce disqualification risk.");
    if (mustItems.some((t) => t.toLowerCase().includes("gdpr"))) findings.push("GDPR compliance is mandatory and should be explicitly confirmed in the offer.");
    if (mustItems.some((t) => t.toLowerCase().includes("warranty"))) findings.push("Warranty requirements should be stated explicitly in the response.");
    if (mustItems.some((t) => t.toLowerCase().includes("eur"))) findings.push("Commercial terms suggest pricing must be provided in EUR (fixed price where requested).");
    if (shouldItems.some((t) => t.toLowerCase().includes("iso 27001"))) findings.push("ISO 27001 evidence may improve scoring but is typically optional unless stated as mandatory.");

    // Add a couple of top requirements if we still need bullets
    for (const t of mustItems.slice(0, 2)) {
      if (findings.length >= 7) break;
      if (!t) continue;
      if (findings.some((x) => x.toLowerCase().includes(t.toLowerCase().slice(0, 16)))) continue;
      findings.push(`Mandatory requirement to verify: ${t}`);
    }

    // Ensure at least 5 findings when possible
    if (findings.length < 5) {
      for (const t of shouldItems.slice(0, 3)) {
        if (findings.length >= 5) break;
        if (!t) continue;
        findings.push(`Optional / scoring item to consider: ${t}`);
      }
    }

    const topRisks: ExecutiveRisk[] = risks
      .map((r: any) => {
        const title = String(r?.title ?? r?.risk ?? r?.name ?? r?.summary ?? r?.text ?? "").trim();
        if (!title) return null;
        return { level: normalizeSeverity(r?.severity ?? r?.level ?? r?.rating), text: title };
      })
      .filter(Boolean)
      .slice(0, 3) as ExecutiveRisk[];

    const actions: string[] = [];
    if (deadline) actions.push("Prepare the submission at least 24 hours before the stated deadline and double-check required formats/signatures.");
    if (mustItems.some((t) => t.toLowerCase().includes("warranty"))) actions.push("State warranty terms explicitly and ensure they meet or exceed the minimum requirement.");
    if (mustItems.some((t) => t.toLowerCase().includes("gdpr"))) actions.push("Include a clear GDPR compliance statement and confirm handling of any personal data.");
    if (shouldItems.some((t) => t.toLowerCase().includes("iso 27001"))) actions.push("Decide whether to include ISO 27001 evidence to strengthen evaluation scoring.");

    // Keep actions concise (max 3)
    const nextActions = actions.slice(0, 3);

    return {
      decision: decision.state,
      decisionLine,
      keyFindings: findings.slice(0, 7),
      topRisks,
      nextActions,
      submissionDeadline: deadline,
    };
  }, [decision.state, mustItems, shouldItems, risks]);
  // ------------------------------------------------------------------

  const canDownload = job?.status === "done";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{loading ? "Loading…" : (displayName || job?.file_name) ?? "Bid kit"}</h1>
            {job ? (
              renaming ? (
                <input
                  className="h-8 w-64 max-w-[80vw] rounded-full border bg-background px-3 text-sm"
                  autoFocus
                  value={displayName}
                  placeholder="Enter a name"
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = displayName.trim();
                      setDisplayName(v);
                      setJobDisplayName(job.id, v);
                      setRenaming(false);
                    }
                    if (e.key === "Escape") {
                      setRenaming(false);
                    }
                  }}
                  onBlur={() => {
                    const v = displayName.trim();
                    setDisplayName(v);
                    setJobDisplayName(job.id, v);
                    setRenaming(false);
                  }}
                />
              ) : (
                <Button variant="outline" className="h-8 rounded-full" onClick={() => setRenaming(true)}>
                  Rename
                </Button>
              )
            ) : null}
            {job ? statusBadge(job.status) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SnapshotBadge tone={snapshot.tone} label={snapshot.badge} />
            <p className="text-sm text-muted-foreground">{snapshot.line}</p>
          </div>

          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

          <div className="mt-3 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  Details
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem className="text-xs">
                  Job ID: <span className="ml-2 font-mono">{jobId ?? ""}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  Created: <span className="ml-2">{formatDate(job?.created_at)}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  Credits used: <span className="ml-2">{typeof job?.credits_used === "number" ? job.credits_used : "-"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  File type: <span className="ml-2 uppercase">{job?.source_type ?? "-"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <p className="text-xs text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Back to jobs</Link>
          </Button>
          <Button variant="outline" className="rounded-full" onClick={exportBidBriefPdf} disabled={!canDownload}>
            Export bid brief PDF
          </Button>
          <Button className="rounded-full" onClick={downloadSummary} disabled={!canDownload}>
            Download summary
          </Button>
          <Button variant="destructive" className="rounded-full" onClick={deleteJob}>
            Delete
          </Button>
        </div>
      </div>

      {job && (job.status === "queued" || job.status === "processing" || job.status === "failed") ? (
        <ProgressCard status={job.status} />
      ) : null}

      {/* Executive Summary (NEW) */}
      <ExecutiveSummary
        decision={executive.decision}
        decisionLine={executive.decisionLine}
        keyFindings={executive.keyFindings}
        topRisks={executive.topRisks}
        nextActions={executive.nextActions}
        submissionDeadline={executive.submissionDeadline}
      />

      {/* Decision summary */}
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <DecisionBadge state={decision.state} />
              <p className="text-sm font-medium text-foreground">{decision.summary}</p>
            </div>
            <p className="text-xs text-muted-foreground">Based on mandatory requirements, identified risks, and ambiguities.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-medium">Key reasons</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {decision.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-medium">Potential disqualifiers</p>
              <div className="mt-2 space-y-2">
                {decision.disqualifiers.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CompactPill tone={d.tone}>{d.tone === "ok" ? "OK" : d.tone === "bad" ? "High" : "Review"}</CompactPill>
                    <p className="text-sm text-muted-foreground leading-relaxed">{d.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            This assessment supports go or no go decisions and early drafting. Always verify mandatory requirements against the original tender documents.
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

        <TabsContent value="checklist">
          <div className="flex items-center justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => copySection("requirements")} disabled={!canDownload}>
              {copiedSection === "requirements" ? "Copied" : "Copy section"}
            </Button>
          </div>
          <div className="mt-3">
            <Checklist checklist={checklist} extractedText={extractedText} onJumpToSource={onJumpToSource} />
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="flex items-center justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => copySection("risks")} disabled={!canDownload}>
              {copiedSection === "risks" ? "Copied" : "Copy section"}
            </Button>
          </div>
          <div className="mt-3">
            <Risks risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} />
          </div>
        </TabsContent>

        <TabsContent value="questions">
          <div className="flex items-center justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => copySection("clarifications")} disabled={!canDownload}>
              {copiedSection === "clarifications" ? "Copied" : "Copy section"}
            </Button>
          </div>
          <div className="mt-3">
            <BuyerQuestions checklist={checklist} risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} />
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

                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => {
                      if (!canDownload) return;
                      setExporting("outline");
                      try {
                        await exportDraftDocx({ fileName: displayName || job?.file_name, draft: result?.proposal_draft ?? null, mode: "outline", jobId });
                      } finally {
                        setExporting(null);
                      }
                    }}
                    disabled={!canDownload || exporting !== null}
                  >
                    {exporting === "outline" ? "Exporting…" : "Export outline (DOCX)"}
                  </Button>

                  <Button
                    className="rounded-full"
                    onClick={async () => {
                      if (!canDownload) return;
                      setExporting("full");
                      try {
                        await exportDraftDocx({ fileName: displayName || job?.file_name, draft: result?.proposal_draft ?? null, mode: "full", jobId });
                      } finally {
                        setExporting(null);
                      }
                    }}
                    disabled={!canDownload || exporting !== null}
                  >
                    {exporting === "full" ? "Exporting…" : "Export full draft (DOCX)"}
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              {result?.proposal_draft ? (
                <pre className="text-sm whitespace-pre-wrap">
                  {typeof result.proposal_draft === "string" ? result.proposal_draft : JSON.stringify(result.proposal_draft, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Draft not ready yet.</p>
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

          <ScrollArea className="mt-4 h-[520px] rounded-2xl border bg-muted/20">
            <pre className="p-4 whitespace-pre-wrap text-sm">{extractedText || "No source text yet."}</pre>
          </ScrollArea>

          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            This is drafting support. Always verify requirements and legal language against the original tender document.
          </p>
        </TabsContent>
      </Tabs>

      {/* Trust and limitations moved to bottom */}
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Trust and limitations</p>
              <p className="mt-1 text-sm text-muted-foreground">Important notes about how to use this output safely.</p>
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => setHowToOpen((v) => !v)}>
              {howToOpen ? "Hide" : "Show"}
            </Button>
          </div>

          {howToOpen ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs font-medium">What this helps you do</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Quickly assess bid feasibility</li>
                  <li>Identify mandatory requirements and risks</li>
                  <li>Start a structured proposal draft</li>
                </ul>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs font-medium">What you should still do</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Verify mandatory requirements against the original RFP</li>
                  <li>Confirm ambiguities with the contracting authority</li>
                  <li>Run legal and compliance checks where required</li>
                </ul>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 md:col-span-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium">This tool does</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>Highlight mandatory requirements</li>
                      <li>Flag risks and ambiguities</li>
                      <li>Provide a structured draft outline</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium">This tool does not</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>Guarantee compliance</li>
                      <li>Replace legal or procurement review</li>
                      <li>Submit or validate bids on your behalf</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
