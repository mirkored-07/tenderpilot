"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/browser";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return iso;
  }
}

function statusBadge(status: JobStatus) {
  if (status === "done") return <Badge className="rounded-full">Ready</Badge>;
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="rounded-full">
        Failed
      </Badge>
    );
  }
  if (status === "queued") {
    return (
      <Badge variant="outline" className="rounded-full">
        Queued
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="rounded-full">
      Processing
    </Badge>
  );
}

function Step({ label, state }: { label: string; state: "done" | "active" | "todo" }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          state === "done" && "bg-foreground/70",
          state === "active" && "bg-foreground",
          state === "todo" && "bg-muted-foreground/30"
        )}
      />
      <span
        className={cn(
          "text-xs",
          state === "active" && "text-foreground font-medium",
          state === "done" && "text-muted-foreground",
          state === "todo" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function normalizeChecklist(input: any): Array<{ title: string; evidence?: string; mandatory?: boolean }> {
  if (!input) return [];
  const items = Array.isArray(input) ? input : Array.isArray(input?.items) ? input.items : [];
  return items
    .map((it: any) => ({
      title: String(it?.title ?? it?.requirement ?? it?.text ?? ""),
      evidence: it?.evidence ? String(it.evidence) : it?.source ? String(it.source) : undefined,
      mandatory: typeof it?.mandatory === "boolean" ? it.mandatory : it?.type === "mandatory" ? true : undefined,
    }))
    .filter((x: any) => x.title);
}

function normalizeRisks(input: any): Array<{ title: string; detail?: string; severity?: string }> {
  if (!input) return [];
  const items = Array.isArray(input) ? input : Array.isArray(input?.items) ? input.items : [];
  return items
    .map((it: any) => ({
      title: String(it?.title ?? it?.risk ?? it?.name ?? ""),
      detail: it?.detail ? String(it.detail) : it?.description ? String(it.description) : undefined,
      severity: it?.severity ? String(it.severity) : undefined,
    }))
    .filter((x: any) => x.title);
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;

  const [job, setJob] = useState<DbJob | null>(null);
  const [result, setResult] = useState<DbJobResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  async function load() {
    if (!jobId) return;

    setError(null);
    const supabase = supabaseBrowser();

    const { data: jobData, error: jobErr } = await supabase
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status,credits_used,created_at,updated_at")
      .eq("id", jobId)
      .single();

    if (jobErr) {
      setError(jobErr.message);
      setJob(null);
      setResult(null);
      setLoading(false);
      return;
    }

    setJob(jobData as DbJob);

    const { data: resData, error: resErr } = await supabase
      .from("job_results")
      .select("job_id,user_id,extracted_text,checklist,risks,proposal_draft,created_at,updated_at")
      .eq("job_id", jobId)
      .maybeSingle();

    if (resErr) {
      setResult(null);
    } else {
      setResult((resData ?? null) as DbJobResult | null);
    }

    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!jobId) return;
      setLoading(true);
      await load();
      if (cancelled) return;
    }

    start();

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    if (!job) return;

    const isTerminal = job.status === "done" || job.status === "failed";
    if (isTerminal) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    if (pollRef.current) return;

    pollRef.current = window.setInterval(() => {
      load();
    }, 4000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.status]);

  const steps = useMemo(() => {
    const st = job?.status ?? "processing";

    if (st === "queued") {
      return [
        { label: "Uploaded", state: "done" as const },
        { label: "Queued", state: "active" as const },
        { label: "Extracting", state: "todo" as const },
        { label: "Drafting", state: "todo" as const },
        { label: "Ready", state: "todo" as const },
      ];
    }

    if (st === "processing") {
      return [
        { label: "Uploaded", state: "done" as const },
        { label: "Extracting", state: "active" as const },
        { label: "Drafting", state: "todo" as const },
        { label: "Ready", state: "todo" as const },
      ];
    }

    if (st === "failed") {
      return [
        { label: "Uploaded", state: "done" as const },
        { label: "Extracting", state: "done" as const },
        { label: "Drafting", state: "active" as const },
        { label: "Ready", state: "todo" as const },
      ];
    }

    return [
      { label: "Uploaded", state: "done" as const },
      { label: "Extracting", state: "done" as const },
      { label: "Drafting", state: "done" as const },
      { label: "Ready", state: "done" as const },
    ];
  }, [job?.status]);

  const checklist = useMemo(() => normalizeChecklist(result?.checklist), [result?.checklist]);
  const risks = useMemo(() => normalizeRisks(result?.risks), [result?.risks]);
  const proposal = (result?.proposal_draft ?? null) as any;

  const canExport = job?.status === "done";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {loading ? "Loading…" : job?.file_name ?? "Job"}
            </h1>
            {job ? statusBadge(job.status) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Job ID: <span className="font-mono">{jobId ?? ""}</span>
            {job?.created_at ? <> • Created: {formatDate(job.created_at)}</> : null}
            {typeof job?.credits_used === "number" ? <> • Credits: {job.credits_used}</> : null}
          </p>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Back to History</Link>
          </Button>
          <Button className="rounded-full" disabled={!canExport}>
            Export (soon)
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              {steps.map((s) => (
                <Step key={s.label} label={s.label} state={s.state} />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Drafting support only. Always verify against the original RFP.
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checklist" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="rounded-full">
            <TabsTrigger value="checklist" className="rounded-full">Checklist</TabsTrigger>
            <TabsTrigger value="draft" className="rounded-full">Draft Proposal</TabsTrigger>
            <TabsTrigger value="risks" className="rounded-full">Risks</TabsTrigger>
            <TabsTrigger value="text" className="rounded-full">Extracted text</TabsTrigger>
          </TabsList>

          <div className="text-sm text-muted-foreground">
            {job?.status === "done"
              ? "Results saved and ready to download."
              : job?.status === "failed"
              ? "Processing failed. Check logs or retry later."
              : "This page updates automatically while processing."}
          </div>
        </div>

        <TabsContent value="checklist">
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Requirements checklist</CardTitle>
              <p className="text-sm text-muted-foreground">Mandatory and non mandatory items with evidence.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.length === 0 ? (
                <div className="rounded-2xl border p-8 text-center">
                  <p className="text-sm font-medium">No checklist yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Checklist items will appear here once processing finishes.
                  </p>
                </div>
              ) : (
                checklist.map((item, idx) => (
                  <div key={`${idx}-${item.title}`} className="rounded-2xl border bg-card/40 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{item.title}</div>
                        {item.evidence ? (
                          <div className="mt-1 text-xs text-muted-foreground">Evidence: {item.evidence}</div>
                        ) : null}
                      </div>
                      {typeof item.mandatory === "boolean" ? (
                        <Badge variant={item.mandatory ? "default" : "secondary"} className="rounded-full">
                          {item.mandatory ? "Mandatory" : "Optional"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft">
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Draft proposal</CardTitle>
              <p className="text-sm text-muted-foreground">A structured first draft to edit and finalize.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!proposal ? (
                <div className="rounded-2xl border p-8 text-center">
                  <p className="text-sm font-medium">No draft yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Draft content will appear here once processing finishes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposal.executive_summary ? (
                    <section className="space-y-2">
                      <div className="text-sm font-medium">Executive summary</div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {proposal.executive_summary}
                      </p>
                    </section>
                  ) : null}

                  {proposal.outline ? (
                    <section className="space-y-2">
                      <div className="text-sm font-medium">Outline</div>
                      <pre className="whitespace-pre-wrap rounded-2xl border bg-muted/30 p-4 text-sm">
                        {typeof proposal.outline === "string"
                          ? proposal.outline
                          : JSON.stringify(proposal.outline, null, 2)}
                      </pre>
                    </section>
                  ) : null}

                  {proposal.draft_text ? (
                    <section className="space-y-2">
                      <div className="text-sm font-medium">Draft text</div>
                      <pre className="whitespace-pre-wrap rounded-2xl border bg-muted/30 p-4 text-sm">
                        {String(proposal.draft_text)}
                      </pre>
                    </section>
                  ) : null}

                  {!proposal.executive_summary && !proposal.outline && !proposal.draft_text ? (
                    <pre className="whitespace-pre-wrap rounded-2xl border bg-muted/30 p-4 text-sm">
                      {JSON.stringify(proposal, null, 2)}
                    </pre>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks">
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Risks and ambiguities</CardTitle>
              <p className="text-sm text-muted-foreground">Potential disqualifiers, unclear points, and follow ups.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {risks.length === 0 ? (
                <div className="rounded-2xl border p-8 text-center">
                  <p className="text-sm font-medium">No risks yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Risk items will appear here once processing finishes.
                  </p>
                </div>
              ) : (
                risks.map((r, idx) => (
                  <div key={`${idx}-${r.title}`} className="rounded-2xl border bg-card/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{r.title}</div>
                        {r.detail ? <div className="mt-1 text-sm text-muted-foreground">{r.detail}</div> : null}
                      </div>
                      {r.severity ? <Badge className="rounded-full">{r.severity}</Badge> : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Extracted text</CardTitle>
              <p className="text-sm text-muted-foreground">Raw text extracted from your uploaded file.</p>
            </CardHeader>
            <CardContent>
              {!result?.extracted_text ? (
                <div className="rounded-2xl border p-8 text-center">
                  <p className="text-sm font-medium">No extracted text yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Text will appear here once extraction completes.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[520px] rounded-2xl border bg-muted/20">
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">{result.extracted_text}</pre>
                  </div>
                </ScrollArea>
              )}
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                This tool provides drafting support only and may contain errors. You must verify all requirements against
                the original RFP before submission. Not legal advice. Not procurement advice.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
