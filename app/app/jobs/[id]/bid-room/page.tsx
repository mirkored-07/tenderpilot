"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { track } from "@/lib/telemetry";

import { BidRoomPanel } from "@/components/bidroom/BidRoomPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const [jobMeta, setJobMeta] = useState<DbJobMetadata | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
const [metaDraft, setMetaDraft] = useState<{
  deadlineLocal: string;
  portal_url: string;
  internal_bid_id: string;
  owner_label: string;
  decision_override: string;
  targetDecisionLocal: string;
}>({
  deadlineLocal: "",
  portal_url: "",
  internal_bid_id: "",
  owner_label: "",
  decision_override: "",
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

        // Bid metadata overlay (manual)
        const { data: metaRow, error: metaErr } = await supabase
          .from("job_metadata")
          .select("*")
          .eq("job_id", jobId)
          .maybeSingle();

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
            decision_override: String((metaRow as any)?.decision_override ?? ""),
            targetDecisionLocal: toLocalInput((metaRow as any)?.target_decision_at),
          });
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
      decision_override: metaDraft.decision_override?.trim() ? metaDraft.decision_override.trim() : null,
      target_decision_at: toIsoOrNull(metaDraft.targetDecisionLocal),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("job_metadata").upsert(payload as any).select("*").maybeSingle();
    if (error) {
      console.warn(error);
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

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Bid Room</p>
          <p className="mt-1 text-sm text-muted-foreground">Work view: assign owners, track tasks, and coordinate the bid.</p>
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
            <Link href={`/app/jobs/${jobId}/compliance`}>Compliance matrix</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/app/jobs/${jobId}`}>Back to job</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button type="button" className="text-left" onClick={() => setMetaOpen((v) => !v)} aria-expanded={metaOpen}>
              <p className="text-sm font-medium flex items-center gap-2">
                Bid metadata
                <span className="text-xs text-muted-foreground">{metaOpen ? "▲" : "▼"}</span>
              </p>

              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  Deadline:{" "}
                  {jobMeta?.deadline_override
                    ? new Date(jobMeta.deadline_override).toLocaleString()
                    : metaDraft.deadlineLocal
                      ? "(unsaved)"
                      : "Add deadline"}
                </span>
                <span>
                  Owner:{" "}
                  {metaDraft.owner_label?.trim() ? metaDraft.owner_label.trim() : jobMeta?.owner_label?.trim() ? jobMeta.owner_label.trim() : "Add owner"}
                </span>
                <span>Portal: {(metaDraft.portal_url?.trim() || jobMeta?.portal_url?.trim()) ? "set" : "Add portal"}</span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">Operational context (does not affect AI decision).</p>
            </button>

            {metaOpen ? (
              <Button variant="outline" className="rounded-full" onClick={saveJobMetadata} disabled={savingMeta}>
                {savingMeta ? "Saving…" : "Save"}
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full" onClick={() => setMetaOpen(true)}>
                Edit
              </Button>
            )}
          </div>

          {metaOpen ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Submission deadline override</p>
                <Input
                  type="datetime-local"
                  value={metaDraft.deadlineLocal}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, deadlineLocal: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Decision override</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={metaDraft.decision_override}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, decision_override: e.target.value }))}
                >
                  <option value="">(use extracted decision)</option>
                  <option value="Go">Go</option>
                  <option value="Hold">Hold</option>
                  <option value="No-Go">No-Go</option>
                </select>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Portal / tender link</p>
                <Input
                  value={metaDraft.portal_url}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, portal_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Internal bid id</p>
                <Input
                  value={metaDraft.internal_bid_id}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, internal_bid_id: e.target.value }))}
                  placeholder="e.g. BID-2026-014"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Owner</p>
                <Input
                  value={metaDraft.owner_label}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, owner_label: e.target.value }))}
                  placeholder="e.g. Maria"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Target decision date</p>
                <Input
                  type="datetime-local"
                  value={metaDraft.targetDecisionLocal}
                  onChange={(e) => setMetaDraft((s) => ({ ...s, targetDecisionLocal: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Last saved: {jobMeta?.updated_at ? new Date(jobMeta.updated_at).toLocaleString() : "—"}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
          jobFilePath={(job as any)?.file_path ?? null}
          evidenceCandidates={evidenceCandidates}
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
