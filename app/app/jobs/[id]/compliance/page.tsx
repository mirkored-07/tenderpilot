"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

import { ComplianceMatrix } from "@/components/compliance/ComplianceMatrix";
import { Card, CardContent } from "@/components/ui/card";
import { useAppI18n } from "../../../_components/app-i18n-provider";

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
  const { t } = useAppI18n();
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
          setError(t("app.tender.notFound"));
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
        setError(t("app.compliance.loadError"));
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
          <p className="text-sm font-semibold">{t("app.common.loading")}…</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.compliance.loadingBody")}</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <p className="text-sm font-semibold">{t("app.common.couldNotOpenPage")}</p>
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
            <p className="text-sm font-semibold">{t("app.compliance.notFinalTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("app.compliance.notFinalBody")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ComplianceMatrix jobId={jobId} checklist={checklist} backHref={`/app/jobs/${jobId}`} workHref={`/app/jobs/${jobId}/bid-room`} />
    </div>
  );
}
