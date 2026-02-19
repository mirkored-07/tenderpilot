"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

import { ComplianceMatrix } from "@/components/compliance/ComplianceMatrix";
import { Card, CardContent } from "@/components/ui/card";

type JobStatus = "queued" | "processing" | "done" | "failed";

function normalizeChecklist(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.checklist)) return raw.checklist;
  if (Array.isArray(raw?.requirements)) return raw.requirements;
  return [];
}

export default function JobCompliancePage() {
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

        const { data: resultRow, error: resErr } = await supabase.from("job_results").select("*").eq("job_id", jobId).maybeSingle();
        if (cancelled) return;

        if (resErr) {
          console.warn(resErr);
          setResult(null);
        } else {
          setResult((resultRow as any) ?? null);
        }
      } catch (e) {
        console.error(e);
        setError("Could not load compliance matrix.");
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
  const checklist = useMemo(() => normalizeChecklist(result?.checklist), [result]);

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <p className="text-sm font-semibold">Loading…</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparing your compliance matrix.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <p className="text-sm font-semibold">Could not open this page</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {status !== "done" ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm font-semibold">Results are not finalized</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You can still set compliance status, but the extracted requirement list may change until processing is complete.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ComplianceMatrix jobId={jobId} checklist={checklist} backHref={`/app/jobs/${jobId}`} workHref={`/app/jobs/${jobId}/bid-room`} />
    </div>
  );
}
