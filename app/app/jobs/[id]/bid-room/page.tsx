"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { useAppI18n } from "../../../_components/app-i18n-provider";
import { track } from "@/lib/telemetry";

import { BidRoomPanel } from "@/components/bidroom/BidRoomPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEffectiveReviewState } from "@/lib/review-state";

type JobStatus = "queued" | "processing" | "done" | "failed";

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

type DeterministicTenderFactValue = {
  value: string;
  evidenceIds: string[];
  source: string | null;
  confidence: string | null;
};

type DeterministicDeadlineValue = {
  text: string;
  iso: string | null;
  timezone: string | null;
  source: string | null;
};

type BidRoomTenderFacts = {
  reviewState: ReturnType<typeof getEffectiveReviewState>;
  clarificationDeadline: DeterministicDeadlineValue | null;
  submissionChannel: DeterministicTenderFactValue | null;
  procurementProcedure: DeterministicTenderFactValue | null;
  validityPeriod: DeterministicTenderFactValue | null;
  contractTerm: DeterministicTenderFactValue | null;
  lotStructure: DeterministicTenderFactValue | null;
  portalUrl: string | null;
};

function normalizeChecklist(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : raw?.items ?? raw?.checklist ?? null;
  return Array.isArray(items) ? items : [];
}

function normalizeRisks(raw: any): any[] {
  const items = Array.isArray(raw) ? raw : raw?.items ?? raw?.risks ?? null;
  return Array.isArray(items) ? items : [];
}

function normalizeQuestions(raw: any): string[] {
  const arr = Array.isArray(raw) ? raw : raw?.questions ?? raw?.items ?? null;
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

function normalizeDeterministicFact(raw: any): DeterministicTenderFactValue | null {
  if (!raw || typeof raw !== "object") return null;
  const value = String((raw as any)?.value ?? "").trim();
  if (!value) return null;
  const evidenceIds = Array.isArray((raw as any)?.evidence_ids)
    ? (raw as any).evidence_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const source = raw?.source ? String(raw.source).trim() : null;
  const confidence = raw?.confidence ? String(raw.confidence).trim() : null;
  return { value, evidenceIds, source, confidence };
}

function normalizeDeadlineFact(raw: any): DeterministicDeadlineValue | null {
  if (!raw || typeof raw !== "object") return null;
  const text = String((raw as any)?.text ?? "").trim();
  const iso = raw?.iso ? String(raw.iso).trim() : null;
  const timezone = raw?.timezone ? String(raw.timezone).trim() : null;
  const source = raw?.source ? String(raw.source).trim() : null;
  if (!text && !iso) return null;
  return { text, iso, timezone, source };
}

export default function JobBidRoomPage() {
  const { t } = useAppI18n();
  const params = useParams();
  const jobId = String((params as any)?.id ?? "").trim();

  const [job, setJob] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [jobMeta, setJobMeta] = useState<DbJobMetadata | null>(null);

  const [metaOpen, setMetaOpen] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<{
    deadlineLocal: string;
    portal_url: string;
    internal_bid_id: string;
    owner_label: string;
    targetDecisionLocal: string;
  }>({
    deadlineLocal: "",
    portal_url: "",
    internal_bid_id: "",
    owner_label: "",
    targetDecisionLocal: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    track("bid_room_opened", { jobId });

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
        setResult(resErr ? null : (resultRow as any) ?? null);

        const { data: metaRow, error: metaErr } = await supabase.from("job_metadata").select("*").eq("job_id", jobId).maybeSingle();
        if (cancelled) return;

        if (metaErr) {
          console.warn(metaErr);
          setJobMeta(null);
        } else {
          setJobMeta((metaRow as any) ?? null);

          const toLocalInput = (iso: string | null | undefined) => {
            if (!iso) return "";
            const d = new Date(String(iso));
            if (!Number.isFinite(d.getTime())) return "";
            const pad = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          };

          setMetaDraft({
            deadlineLocal: toLocalInput((metaRow as any)?.deadline_override),
            portal_url: String((metaRow as any)?.portal_url ?? ""),
            internal_bid_id: String((metaRow as any)?.internal_bid_id ?? ""),
            owner_label: String((metaRow as any)?.owner_label ?? ""),
            targetDecisionLocal: toLocalInput((metaRow as any)?.target_decision_at),
          });
        }
      } catch (e) {
        console.error(e);
        setError(t("app.bidroom.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jobId, t]);

  async function saveJobMetadata() {
    if (!jobId) return;

    const supabase = supabaseBrowser();

    const toIsoOrNull = (localInput: string) => {
      const s = String(localInput ?? "").trim();
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    setSavingMeta(true);
    try {
      const payload: Partial<DbJobMetadata> = {
        job_id: jobId,
        deadline_override: toIsoOrNull(metaDraft.deadlineLocal),
        portal_url: metaDraft.portal_url?.trim() ? metaDraft.portal_url.trim() : null,
        internal_bid_id: metaDraft.internal_bid_id?.trim() ? metaDraft.internal_bid_id.trim() : null,
        owner_label: metaDraft.owner_label?.trim() ? metaDraft.owner_label.trim() : null,
        target_decision_at: toIsoOrNull(metaDraft.targetDecisionLocal),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from("job_metadata").upsert(payload as any).select("*").maybeSingle();
      if (error) {
        console.warn(error);
        setError(t("app.metadata.errors.saveFailed"));
        return;
      }
      setJobMeta((data as any) ?? null);
      setMetaOpen(false);
    } finally {
      setSavingMeta(false);
    }
  }

  const status: JobStatus = useMemo(() => String(job?.status ?? "queued") as JobStatus, [job]);
  const canDownload = useMemo(() => Boolean(job && status === "done"), [job, status]);

  const evidenceCandidates = useMemo(() => {
    const c = (job as any)?.pipeline?.evidence?.candidates;
    return Array.isArray(c) ? c : [];
  }, [job]);

  const checklist = useMemo(() => normalizeChecklist(result?.checklist), [result]);
  const risks = useMemo(() => normalizeRisks(result?.risks), [result]);
  const questions = useMemo(() => normalizeQuestions(result?.clarifications), [result]);
  const outlineSections = useMemo(() => normalizeOutlineSections((result as any)?.proposal_draft), [result]);

  const preExtractedFacts = useMemo(() => {
    const raw = (job as any)?.pipeline?.ai?.pre_extracted_facts ?? null;
    return {
      submissionDeadline: normalizeDeadlineFact(raw?.submission_deadline),
      clarificationDeadline: normalizeDeadlineFact(raw?.clarification_deadline),
      submissionChannel: normalizeDeterministicFact(raw?.submission_channel),
      procurementProcedure: normalizeDeterministicFact(raw?.procurement_procedure ?? raw?.procedure_type),
      validityPeriod: normalizeDeterministicFact(raw?.validity_period),
      contractTerm: normalizeDeterministicFact(raw?.contract_term),
      lotStructure: normalizeDeterministicFact(raw?.lot_structure),
      portalLink: normalizeDeterministicFact(raw?.portal_link),
    };
  }, [job]);

  const tenderFacts = useMemo<BidRoomTenderFacts>(() => {
    const portalUrl = metaDraft.portal_url?.trim() || jobMeta?.portal_url?.trim() || preExtractedFacts.portalLink?.value?.trim() || null;
    const reviewState = getEffectiveReviewState({
      executive: job?.executive,
      pipeline: job?.pipeline,
      decisionOverride: jobMeta?.decision_override,
      deadlineOverride: metaDraft.deadlineLocal || jobMeta?.deadline_override,
    });
    return {
      reviewState,
      clarificationDeadline: preExtractedFacts.clarificationDeadline,
      submissionChannel: preExtractedFacts.submissionChannel,
      procurementProcedure: preExtractedFacts.procurementProcedure,
      validityPeriod: preExtractedFacts.validityPeriod,
      contractTerm: preExtractedFacts.contractTerm,
      lotStructure: preExtractedFacts.lotStructure,
      portalUrl,
    };
  }, [job, jobMeta, metaDraft.portal_url, metaDraft.deadlineLocal, preExtractedFacts]);

  const metaSummaryDeadline = jobMeta?.deadline_override
    ? new Date(jobMeta.deadline_override).toLocaleString()
    : metaDraft.deadlineLocal
      ? t("app.metadata.labels.unsaved")
      : t("app.metadata.labels.addDeadline");

  const metaSummaryOwner = metaDraft.owner_label?.trim()
    ? metaDraft.owner_label.trim()
    : jobMeta?.owner_label?.trim()
      ? jobMeta.owner_label.trim()
      : t("app.metadata.labels.addOwner");

  const metaSummaryPortal = (metaDraft.portal_url?.trim() || jobMeta?.portal_url?.trim())
    ? t("app.metadata.labels.portalSet")
    : t("app.metadata.labels.addPortal");

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{t("app.bidroom.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.bidroom.workSubtitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {job?.file_name ? (
              <>
                {t("app.tender.label")}: <span className="font-medium text-foreground">{String(job.file_name)}</span>
              </>
            ) : (
              <>
                {t("app.tender.label")}: {jobId}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/app/jobs/${jobId}/compliance`}>{t("app.compliance.title")}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/app/jobs/${jobId}`}>{t("app.bidroom.backToJob")}</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button type="button" className="text-left" onClick={() => setMetaOpen((v) => !v)} aria-expanded={metaOpen}>
              <p className="flex items-center gap-2 text-sm font-medium">
                {t("app.metadata.title")}
                <span className="text-xs text-muted-foreground">{metaOpen ? "▲" : "▼"}</span>
              </p>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t("app.metadata.labels.deadline")}: {metaSummaryDeadline}
                </span>
                <span>
                  {t("app.metadata.labels.owner")}: {metaSummaryOwner}
                </span>
                <span>
                  {t("app.metadata.labels.portal")}: {metaSummaryPortal}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">{t("app.metadata.labels.contextHint")}</p>
            </button>

            {metaOpen ? (
              <Button variant="outline" className="rounded-full" onClick={saveJobMetadata} disabled={savingMeta}>
                {savingMeta ? t("app.metadata.actions.saving") : t("app.metadata.actions.save")}
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full" onClick={() => setMetaOpen(true)}>
                {t("app.common.edit")}
              </Button>
            )}
          </div>

          {metaOpen ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("app.metadata.fields.deadlineOverride")}</p>
                <Input
                  type="datetime-local"
                  value={metaDraft.deadlineLocal}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, deadlineLocal: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("app.metadata.fields.portalUrl")}</p>
                <Input
                  value={metaDraft.portal_url}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, portal_url: e.target.value }))}
                  placeholder={t("app.metadata.placeholders.portalUrl")}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("app.metadata.fields.internalBidId")}</p>
                <Input
                  value={metaDraft.internal_bid_id}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, internal_bid_id: e.target.value }))}
                  placeholder={t("app.metadata.placeholders.internalBidId")}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("app.metadata.fields.owner")}</p>
                <Input
                  value={metaDraft.owner_label}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, owner_label: e.target.value }))}
                  placeholder={t("app.metadata.placeholders.owner")}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("app.metadata.fields.targetDecision")}</p>
                <Input
                  type="datetime-local"
                  value={metaDraft.targetDecisionLocal}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, targetDecisionLocal: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">
                  {t("app.metadata.labels.lastSaved")}: {jobMeta?.updated_at ? new Date(jobMeta.updated_at).toLocaleString() : t("app.common.unknown")}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t("app.bidroom.loading")}</p>
          </CardContent>
        </Card>
      ) : status !== "done" ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-medium">{t("app.bidroom.notReadyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("app.bidroom.notReadyBody", { status })}</p>
          </CardContent>
        </Card>
      ) : (
        <BidRoomPanel
          jobId={jobId}
          jobFilePath={(job as any)?.file_path ?? null}
          evidenceCandidates={evidenceCandidates}
          checklist={checklist}
          risks={risks}
          questions={questions}
          outlineSections={outlineSections}
          canDownload={canDownload}
          tenderFacts={tenderFacts}
        />
      )}
    </div>
  );
}
