"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

import { BidRoomPanel } from "@/components/bidroom/BidRoomPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type JobStatus = "queued" | "processing" | "done" | "failed";

function normalizeChecklist(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.items ?? raw?.checklist ?? null);
  return Array.isArray(items) ? items : [];
}

function normalizeRisks(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : (raw?.items ?? raw?.risks ?? null);
  return Array.isArray(items) ? items : [];
}

function normalizeQuestions(raw: any): string[] {
  const arr = Array.isArray(raw) ? raw : (raw?.questions ?? raw?.items ?? null);
  return Array.isArray(arr) ? arr.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

function normalizeOutlineSections(rawDraft: any): Array<{ title: string; bullets?: string[] }> {
  if (rawDraft && typeof rawDraft === "object" && Array.isArray((rawDraft as any).sections)) {
    return ((rawDraft as any).sections as any[])
      .map((s) => ({
        title: String(s?.title ?? "").trim(),
        bullets: Array.isArray(s?.bullets) ? s.bullets.map((b: any) => String(b ?? "").trim()).filter(Boolean) : [],
      }))
      .filter((s) => s.title);
  }
  return [];
}

export default function JobBidRoomPage() {
  const params = useParams();
  const jobId = String((params as any)?.id ?? "").trim();

  const [job, setJob] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    const supabase = supabaseBrowser();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: jobRow, error: jobErr } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
        if (cancelled) return;
        if (jobErr || !jobRow) {
          setError("Job not found or not accessible.");
          setJob(null);
          setResult(null);
          setLoading(false);
          return;
        }
        setJob(jobRow as any);

        const { data: resultRow, error: resErr } = await supabase
          .from("job_results")
          .select("*")
          .eq("job_id", jobId)
          .maybeSingle();
        if (cancelled) return;
        if (resErr) {
          console.warn(resErr);
          setResult(null);
        } else {
          setResult((resultRow as any) ?? null);
        }
      } catch (e) {
        console.error(e);
        setError("Could not load this bid room.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const status: JobStatus = useMemo(() => String(job?.status ?? "queued") as JobStatus, [job]);
  const canDownload = useMemo(() => Boolean(job && status === "done"), [job, status]);

  const checklist = useMemo(() => normalizeChecklist(result?.checklist), [result]);
  const risks = useMemo(() => normalizeRisks(result?.risks), [result]);
  const questions = useMemo(() => normalizeQuestions(result?.clarifications), [result]);
  const outlineSections = useMemo(() => normalizeOutlineSections((result as any)?.proposal_draft), [result]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Bid room</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {job?.file_name ? (
              <>
                Job: <span className="font-medium text-foreground">{String(job.file_name)}</span>
              </>
            ) : (
              <>Job: {jobId}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/app/jobs/${jobId}`}>Back to job</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Loading bid room…</p>
          </CardContent>
        </Card>
      ) : status !== "done" ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-2">
            <p className="text-sm font-medium">This job is not ready yet.</p>
            <p className="text-sm text-muted-foreground">Status: {status}. When the review finishes, the bid room will show items to assign.</p>
          </CardContent>
        </Card>
      ) : (
        <BidRoomPanel
          jobId={jobId}
          checklist={checklist}
          risks={risks}
          questions={questions}
          outlineSections={outlineSections}
          canDownload={canDownload}
        />
      )}
    </div>
  );
}
