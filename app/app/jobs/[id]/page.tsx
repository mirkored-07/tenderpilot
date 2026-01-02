"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { cn } from "@/lib/utils";
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
  if (status === "failed") return <Badge variant="destructive" className="rounded-full">Failed</Badge>;
  if (status === "queued") return <Badge variant="outline" className="rounded-full">Queued</Badge>;
  return <Badge variant="secondary" className="rounded-full">Processing</Badge>;
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

    const supabase = supabaseBrowser();

    const { data: jobData, error: jobErr } = await supabase
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status,credits_used,created_at,updated_at")
      .eq("id", jobId)
      .single();

    if (jobErr) {
      setError(jobErr.message);
      setLoading(false);
      return;
    }

    setJob(jobData as DbJob);

    const { data: resData } = await supabase
      .from("job_results")
      .select("job_id,user_id,extracted_text,checklist,risks,proposal_draft,created_at,updated_at")
      .eq("job_id", jobId)
      .maybeSingle();

    setResult((resData ?? null) as DbJobResult | null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const proposal = result?.proposal_draft ?? null;
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
            <Link href="/app/jobs">Back to jobs</Link>
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
              {[
                { label: "Uploaded", state: "done" as const },
                { label: "Extracting", state: job?.status === "queued" ? "todo" as const : "done" as const },
                { label: "Drafting", state: job?.status === "done" ? "done" as const : "active" as const },
                { label: "Ready", state: job?.status === "done" ? "done" as const : "todo" as const },
              ].map((s) => (
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
        <TabsList className="rounded-full">
          <TabsTrigger value="checklist" className="rounded-full">Requirements</TabsTrigger>
          <TabsTrigger value="risks" className="rounded-full">Risks</TabsTrigger>
          <TabsTrigger value="questions" className="rounded-full">Clarifications</TabsTrigger>
          <TabsTrigger value="draft" className="rounded-full">Draft</TabsTrigger>
          <TabsTrigger value="text" className="rounded-full">Source text</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist">
          <Checklist checklist={result?.checklist ?? []} />
        </TabsContent>

        <TabsContent value="risks">
          <Risks risks={result?.risks ?? []} />
        </TabsContent>

        <TabsContent value="questions">
          <BuyerQuestions checklist={result?.checklist ?? []} risks={result?.risks ?? []} />
        </TabsContent>

        <TabsContent value="draft">
          <pre className="rounded-2xl border bg-muted/30 p-4 text-sm">
            {proposal ? JSON.stringify(proposal, null, 2) : "Draft not ready yet."}
          </pre>
        </TabsContent>

        <TabsContent value="text">
          <ScrollArea className="h-[520px] rounded-2xl border bg-muted/20">
            <pre className="p-4 whitespace-pre-wrap text-sm">
              {result?.extracted_text ?? "No extracted text yet."}
            </pre>
          </ScrollArea>

          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            This tool provides drafting support only and may contain errors.
            You must verify all requirements against the original RFP before submission.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
