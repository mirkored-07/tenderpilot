"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

import Checklist from "@/components/checklist/Checklist";
import Risks from "@/components/risks/Risks";
import BuyerQuestions from "@/components/questions/BuyerQuestions";

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
          <p className="text-xs text-muted-foreground">
            Results appear automatically on this page
          </p>
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

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
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

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;

  const [job, setJob] = useState<DbJob | null>(null);
  const [result, setResult] = useState<DbJobResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"checklist" | "risks" | "questions" | "draft" | "text">("checklist");
  const [sourceFocus, setSourceFocus] = useState<{ query: string; snippet: string } | null>(null);

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

  const mustCount = useMemo(
    () => checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST")).length,
    [checklist]
  );
  const highRiskCount = useMemo(
    () => risks.filter((r) => String(r?.severity ?? r?.level ?? r?.rating ?? "").toLowerCase().includes("high")).length,
    [risks]
  );

  const questions = useMemo(() => {
    const q: string[] = [];
    checklist
      .filter((c) => String(c?.type ?? c?.level ?? c?.priority ?? "").toUpperCase().includes("SHOULD"))
      .forEach((c) => {
        const text = String(c?.text ?? c?.statement ?? c?.requirement ?? c?.item ?? c?.title ?? "").trim();
        if (text) q.push(`Can you clarify expectations regarding: "${text}"?`);
      });
    risks.forEach((r) => {
      const title = String(r?.title ?? r?.risk ?? r?.name ?? r?.summary ?? r?.text ?? "").trim();
      if (title) q.push(`Can you clarify the following risk or ambiguity: "${title}"?`);
    });
    return Array.from(new Set(q));
  }, [checklist, risks]);

  // ✅ Snapshot logic updated so we never say "Looks clear" when extraction returned nothing
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

    // If no query: just open source tab (no "no match" message).
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
      fileName: job?.file_name,
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
    a.download = `tenderpilot_summary_${jobId ?? "job"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const canDownload = job?.status === "done";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {loading ? "Loading…" : job?.file_name ?? "Bid kit"}
            </h1>
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
                  Credits used:{" "}
                  <span className="ml-2">{typeof job?.credits_used === "number" ? job.credits_used : "-"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  File type: <span className="ml-2 uppercase">{job?.source_type ?? "-"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <p className="text-xs text-muted-foreground">
              Drafting support only. Always verify against the original tender document.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Back to jobs</Link>
          </Button>
          <Button className="rounded-full" onClick={downloadSummary} disabled={!canDownload}>
            Download summary
          </Button>
        </div>
      </div>

      {job && (job.status === "queued" || job.status === "processing" || job.status === "failed") ? (
        <ProgressCard status={job.status} />
      ) : null}

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
          <Checklist checklist={checklist} extractedText={extractedText} onJumpToSource={onJumpToSource} />
        </TabsContent>

        <TabsContent value="risks">
          <Risks risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} />
        </TabsContent>

        <TabsContent value="questions">
          <BuyerQuestions checklist={checklist} risks={risks} extractedText={extractedText} onJumpToSource={onJumpToSource} />
        </TabsContent>

        <TabsContent value="draft">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <p className="text-sm font-semibold">Draft outline</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A short structured starting point. Always tailor before submission.
              </p>

              <Separator className="my-4" />

              {result?.proposal_draft ? (
                <pre className="text-sm whitespace-pre-wrap">
                  {typeof result.proposal_draft === "string"
                    ? result.proposal_draft
                    : JSON.stringify(result.proposal_draft, null, 2)}
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
    </div>
  );
}
