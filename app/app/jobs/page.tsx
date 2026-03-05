"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { getJobDisplayName } from "@/lib/pilot-job-names";
import { track } from "@/lib/telemetry";
import { useAppI18n } from "../_components/app-i18n-provider";

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

type DbJobResultLite = {
  job_id: string;
  executive_summary: any;
  pipeline: any;
  created_at: string;
  updated_at: string;
};

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

type DbWorkItemLite = {
  job_id: string;
  status: string;
  due_at: string | null;
};

function formatDate(iso: string) {
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

function formatDeadline(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function normalizeDecisionText(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isUseExtractedDecisionOverride(v: unknown): boolean {
  const t = String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!t) return true;
  if (t === "extracted") return true;
  if (t.includes("use extracted")) return true;
  if (t.includes("extracted decision")) return true;
  if (t.startsWith("(") && t.includes("extracted")) return true;

  return false;
}

function decisionBucket(raw: string): "go" | "hold" | "no-go" | "unknown" {
  const t = normalizeDecisionText(raw);

  const isNoGo =
    /\b(no[-\s]?go|nogo|do\s+not\s+(bid|proceed|submit)|not\s+(bid|proceed|submit)|reject|decline|withdraw)\b/.test(t);
  if (isNoGo) return "no-go";

  const isHold =
    /\b(hold|caution|clarif(y|ication)|verify|pending|tbd|conditional|depends|review)\b/.test(t) ||
    t.includes("proceed with caution");
  if (isHold) return "hold";

  const isGo = /\b(go|proceed|bid|submit)\b/.test(t);
  if (isGo) return "go";

  return "unknown";
}

function DecisionBadge({ text }: { text: string }) {
  const { t } = useAppI18n();
  const b = decisionBucket(text);

  if (b === "no-go") {
    return (
      <Badge variant="destructive" className="rounded-full">
        {t("app.decision.noGo")}
      </Badge>
    );
  }
  if (b === "hold") {
    return (
      <Badge variant="secondary" className="rounded-full">
        {t("app.decision.hold")}
      </Badge>
    );
  }
  if (b === "go") {
    return (
      <Badge variant="default" className="rounded-full">
        {t("app.decision.go")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full">
      {t("app.common.unknown")}
    </Badge>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const { t } = useAppI18n();

  if (status === "done") return <Badge className="rounded-full">{t("app.common.ready")}</Badge>;
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="rounded-full">
        {t("app.common.failed")}
      </Badge>
    );
  }
  if (status === "queued") {
    return (
      <Badge variant="secondary" className="rounded-full">
        {t("app.common.queued")}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="rounded-full">
      {t("app.common.processing")}
    </Badge>
  );
}

function parseDeadlineToDateLocal(deadlineText: string) {
  const t = String(deadlineText ?? "").trim();
  if (!t) return null;

  const isoTry = new Date(t);
  if (Number.isFinite(isoTry.getTime())) return isoTry;

  const m1 = t.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m1) {
    const dd = parseInt(m1[1], 10);
    const mm = parseInt(m1[2], 10) - 1;
    let yyyy = parseInt(m1[3], 10);
    if (yyyy < 100) yyyy += 2000;
    const hh = m1[4] ? parseInt(m1[4], 10) : 23;
    const mi = m1[5] ? parseInt(m1[5], 10) : 59;
    const d = new Date(yyyy, mm, dd, hh, mi, 0, 0);
    if (Number.isFinite(d.getTime())) return d;
  }

  const m2 = t.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m2) {
    const yyyy = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10) - 1;
    const dd = parseInt(m2[3], 10);
    const hh = m2[4] ? parseInt(m2[4], 10) : 23;
    const mi = m2[5] ? parseInt(m2[5], 10) : 59;
    const d = new Date(yyyy, mm, dd, hh, mi, 0, 0);
    if (Number.isFinite(d.getTime())) return d;
  }

  return null;
}

function daysUntil(deadline: Date, now: Date) {
  const ms = deadline.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function isDoneStatus(s?: string | null) {
  const v = String(s ?? "").toLowerCase().trim();
  return v === "done" || v === "completed" || v === "closed";
}

export default function JobsPage() {
  const { t } = useAppI18n();
  const ONBOARDING_DISMISS_KEY = "tp_onboarding_jobs_empty_dismissed_v1";

  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "processing" | "failed">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "go" | "hold" | "no-go" | "unset">("all");
  const [deadlineFilter, setDeadlineFilter] = useState<"all" | "due-soon" | "this-week" | "no-deadline">("all");
  const [query, setQuery] = useState<string>("");

  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [listTick, setListTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [jobResults, setJobResults] = useState<Record<string, DbJobResultLite>>({});
  const [jobMeta, setJobMeta] = useState<Record<string, DbJobMetadata>>({});
  const [workItems, setWorkItems] = useState<DbWorkItemLite[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const hasActiveJobs = useMemo(
    () => jobs.some((j) => j.status === "queued" || j.status === "processing"),
    [jobs]
  );

  async function loadJobs() {
    setLoadError(null);
    setActionError(null);

    const supabase = supabaseBrowser();

    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id,user_id,file_name,file_path,source_type,status,credits_used,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load jobs", error);
      setLoadError(t("app.tenders.loadFailed"));
      setJobs([]);
      setJobResults({});
      setJobMeta({});
      setWorkItems([]);
    } else {
      const rows = (data ?? []) as DbJob[];
      setJobs(rows);

      const ids = rows.map((j) => String(j.id));
      if (ids.length) {
        const [{ data: resultsData }, { data: metaData }, { data: workData }] = await Promise.all([
          supabase.from("job_results").select("job_id,executive_summary,pipeline,created_at,updated_at").in("job_id", ids),
          supabase
            .from("job_metadata")
            .select("job_id,deadline_override,target_decision_at,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
            .in("job_id", ids),
          supabase.from("job_work_items").select("job_id,status,due_at").in("job_id", ids),
        ]);

        const resMap: Record<string, DbJobResultLite> = {};
        for (const r of resultsData ?? []) resMap[String((r as any).job_id)] = r as any;
        setJobResults(resMap);

        const metaMap: Record<string, DbJobMetadata> = {};
        for (const m of metaData ?? []) metaMap[String((m as any).job_id)] = m as any;
        setJobMeta(metaMap);

        setWorkItems((workData as any) ?? []);
      } else {
        setJobResults({});
        setJobMeta({});
        setWorkItems([]);
      }
    }

    track("jobs_list_loaded", { count: (data ?? []).length });
    setLoading(false);
  }

  // initial load
  useEffect(() => {
    loadJobs();
  }, []);

  // best-effort first run onboarding (local)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(ONBOARDING_DISMISS_KEY);
      setOnboardingDismissed(v === "1");
    } catch {
      setOnboardingDismissed(false);
    }
  }, []);

  // polling (only while active jobs exist + tab visible)
  useEffect(() => {
    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    function startPolling() {
      if (pollRef.current) return;

      pollRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          loadJobs();
        }
      }, 15000);
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") stopPolling();
      if (document.visibilityState === "visible" && hasActiveJobs)
        startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    if (hasActiveJobs && document.visibilityState === "visible") {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasActiveJobs]);


  useEffect(() => {
    const bump = () => setListTick((v) => v + 1);

    const onRename = () => bump();
    const onStorage = (e: StorageEvent) => {
      if (typeof e.key === "string" && e.key.startsWith("tp_job_display_name:")) bump();
    };
    const onFocus = () => bump();

    window.addEventListener("tp_job_rename", onRename as EventListener);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("tp_job_rename", onRename as EventListener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function handleDelete(job: DbJob) {
    const name = String(getJobDisplayName(job.id) || job.file_name || "").trim();
    const ok = window.confirm(t("app.tenders.deleteConfirm", { name: name || t("app.tender.single") }));

    if (!ok) return;

    setActionError(null);
    setDeletingJobId(job.id);

    try {
      const r = await fetch(`/api/jobs/${job.id}/delete`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(String((j as any)?.error ?? "delete_failed"));
      }

      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      track("job_deleted", { job_id: job.id, source: "jobs_list" });
    } catch (e) {
      console.error("Delete failed", e);
      setActionError(t("app.tenders.deleteFailed"));
    } finally {
      setDeletingJobId(null);
    }
  }

  const workByJob = useMemo(() => {
    const map: Record<string, DbWorkItemLite[]> = {};
    for (const wi of workItems ?? []) {
      const jid = String((wi as any)?.job_id ?? "").trim();
      if (!jid) continue;
      (map[jid] ||= []).push(wi);
    }
    return map;
  }, [workItems]);

  const rows = useMemo(() => {
    void listTick;
    const now = new Date();
    const q = String(query ?? "").trim().toLowerCase();

    function statusPass(s: JobStatus) {
      if (statusFilter === "all") return true;
      if (statusFilter === "ready") return s === "done";
      if (statusFilter === "failed") return s === "failed";
      return s === "queued" || s === "processing";
    }

    return (jobs ?? [])
      .map((job) => {
        const r = jobResults[job.id];
        const exec = r?.executive_summary ?? {};
        const meta = jobMeta[job.id];

        const title = String(getJobDisplayName(job.id) || job.file_name || t("app.tender.single")).trim();

        const customerCandidate =
          String(
            exec?.contractingAuthority ??
              exec?.authority ??
              exec?.buyer ??
              exec?.customer ??
              exec?.customerName ??
              exec?.organization ??
              exec?.issuer ??
              ""
          ).trim();

        const secondary =
          customerCandidate ||
          String(meta?.internal_bid_id ?? "").trim() ||
          String(job.source_type ?? "").trim() ||
          "";

        const extractedDeadlineText = String(exec?.submissionDeadline ?? "").trim();
        const extractedDeadline = parseDeadlineToDateLocal(extractedDeadlineText);
        const deadline = meta?.deadline_override
          ? new Date(String(meta.deadline_override))
          : extractedDeadline;
        const hasDeadline = !!deadline && Number.isFinite((deadline as Date).getTime());
        const dueDays = hasDeadline ? daysUntil(deadline as Date, now) : null;

        const extractedDecisionTextRaw = String(exec?.decisionBadge ?? exec?.decision ?? exec?.verdict ?? "").trim();
        const extractedDecisionText = extractedDecisionTextRaw || "Hold";
        const overrideRaw = meta?.decision_override;
        const decisionText = isUseExtractedDecisionOverride(overrideRaw) ? extractedDecisionText : String(overrideRaw ?? "").trim();
        const bucket = decisionBucket(decisionText);

        const items = workByJob[job.id] ?? [];
        const openItems = items.filter((x) => !isDoneStatus((x as any)?.status)).length;
        const totalItems = items.length;
        const overdueItems = items.filter((x) => {
          if (isDoneStatus((x as any)?.status)) return false;
          const dueAt = (x as any)?.due_at ? new Date(String((x as any).due_at)) : null;
          if (!dueAt || !Number.isFinite(dueAt.getTime())) return false;
          return dueAt.getTime() < now.getTime();
        }).length;

        const deadlineCategory =
          !hasDeadline
            ? "no"
            : dueDays !== null && dueDays <= 2
              ? "soon"
              : dueDays !== null && dueDays <= 7
                ? "week"
                : "later";

        const hay = `${title} ${secondary} ${String(meta?.internal_bid_id ?? "").trim()}`.toLowerCase();
        const matchesQuery = !q || hay.includes(q);

        return {
          job,
          title,
          secondary,
          hasDeadline,
          deadline: hasDeadline ? (deadline as Date) : null,
          dueDays,
          deadlineCategory,
          decisionText,
          decisionBucket: bucket,
          openItems,
          totalItems,
          overdueItems,
          matchesQuery,
        };
      })
      .filter((r) => {
        if (!r.matchesQuery) return false;
        if (!statusPass(r.job.status)) return false;

        if (decisionFilter !== "all") {
          if (decisionFilter === "unset") {
            if (r.decisionBucket !== "unknown") return false;
          } else {
            if (r.decisionBucket !== decisionFilter) return false;
          }
        }

        if (deadlineFilter !== "all") {
          if (deadlineFilter === "no-deadline") return !r.hasDeadline;
          if (!r.hasDeadline) return false;
          if (deadlineFilter === "due-soon") return r.dueDays !== null && r.dueDays <= 2;
          if (deadlineFilter === "this-week") return r.dueDays !== null && r.dueDays <= 7;
        }

        return true;
      });
  }, [jobs, jobResults, jobMeta, workByJob, statusFilter, decisionFilter, deadlineFilter, query, listTick]);

  const statusLabel =
    statusFilter === "all"
      ? t("app.common.all")
      : statusFilter === "ready"
        ? t("app.common.ready")
        : statusFilter === "failed"
          ? t("app.common.failed")
          : t("app.common.processing");

  const decisionLabel =
    decisionFilter === "all"
      ? t("app.common.any")
      : decisionFilter === "no-go"
        ? t("app.decision.noGo")
        : decisionFilter === "unset"
          ? t("app.decision.unset")
          : decisionFilter === "hold"
            ? t("app.decision.hold")
            : t("app.decision.go");

  const deadlineLabel =
    deadlineFilter === "all"
      ? t("app.common.any")
      : deadlineFilter === "due-soon"
        ? t("app.tenders.deadline.dueSoon")
        : deadlineFilter === "this-week"
          ? t("app.tenders.deadline.thisWeek")
          : t("app.tenders.deadline.noDeadline");

  const shouldShowOnboarding = !loading && jobs.length === 0 && !onboardingDismissed;

  function dismissOnboarding() {
    try {
      window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setOnboardingDismissed(true);
    track("first_run_onboarding_dismissed", { location: "jobs_list" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.tenders.h1")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.tenders.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={loadJobs}
          >
            {t("app.common.refresh")}
          </Button>

          <Button asChild className="rounded-full">
            <Link href="/app/upload">{t("app.nav.newReview")}</Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{t("app.nav.tenders")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? t("app.tenders.cardSubLoading")
              : loadError
              ? t("app.tenders.cardSubError")
              : t("app.tenders.cardSubDefault")}
          </p>
          {loadError && (
            <p className="mt-2 text-xs text-destructive">{loadError}</p>
          )}
          {actionError && (
            <p className="mt-2 text-xs text-destructive">{actionError}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="w-full md:max-w-sm">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("app.tenders.searchPlaceholder")}
                  className="rounded-full"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full">
                      {t("app.tenders.filters.status")}: {statusLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { v: "all", label: t("app.common.all") },
                      { v: "ready", label: t("app.common.ready") },
                      { v: "processing", label: t("app.common.processing") },
                      { v: "failed", label: t("app.common.failed") },
                    ].map((o) => (
                      <DropdownMenuItem
                        key={o.v}
                        onClick={() => {
                          setStatusFilter(o.v as any);
                          track("jobs_filter_changed", { filter: `status:${o.v}` });
                        }}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full">
                      {t("app.tenders.filters.decision")}: {decisionLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { v: "all", label: t("app.common.any") },
                      { v: "go", label: t("app.decision.go") },
                      { v: "hold", label: t("app.decision.hold") },
                      { v: "no-go", label: t("app.decision.noGo") },
                      { v: "unset", label: t("app.decision.unset") },
                    ].map((o) => (
                      <DropdownMenuItem
                        key={o.v}
                        onClick={() => {
                          setDecisionFilter(o.v as any);
                          track("jobs_filter_changed", { filter: `decision:${o.v}` });
                        }}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full">
                      {t("app.tenders.filters.deadline")}: {deadlineLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { v: "all", label: t("app.common.any") },
                      { v: "due-soon", label: t("app.tenders.deadline.dueSoon") },
                      { v: "this-week", label: t("app.tenders.deadline.thisWeek") },
                      { v: "no-deadline", label: t("app.tenders.deadline.noDeadline") },
                    ].map((o) => (
                      <DropdownMenuItem
                        key={o.v}
                        onClick={() => {
                          setDeadlineFilter(o.v as any);
                          track("jobs_filter_changed", { filter: `deadline:${o.v}` });
                        }}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {!loading ? <p className="text-xs text-muted-foreground">{t("app.tenders.countShown", { n: rows.length })}</p> : null}
          </div>

          {loading ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">{t("app.common.loading")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("app.tenders.loadingBody")}</p>
            </div>
          ) : shouldShowOnboarding ? (
            <div className="rounded-2xl border bg-gradient-to-b from-muted/40 to-background p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("app.tenders.onboarding.title")}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("app.tenders.onboarding.body")}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border bg-background/60 p-4">
                      <p className="text-sm font-medium">{t("app.tenders.onboarding.cardEvidenceTitle")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("app.tenders.onboarding.cardEvidenceBody")}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-background/60 p-4">
                      <p className="text-sm font-medium">{t("app.tenders.onboarding.cardTimeTitle")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("app.tenders.onboarding.cardTimeBody")}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-xs text-muted-foreground">{t("app.tenders.onboarding.workflow")}</p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <Button
                    asChild
                    className="rounded-full"
                    onClick={() => track("first_run_onboarding_upload_cta", { location: "jobs_list" })}
                  >
                    <Link href="/app/upload">{t("app.tenders.onboarding.cta")}</Link>
                  </Button>
                  <Button variant="ghost" className="rounded-full" onClick={dismissOnboarding}>
                    {t("app.common.notNow")}
                  </Button>
                </div>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">{t("app.tenders.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("app.tenders.emptyBody")}</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                    setDecisionFilter("all");
                    setDeadlineFilter("all");
                  }}
                >
                  {t("app.common.clearFilters")}
                </Button>
                <Button asChild className="rounded-full">
                  <Link href="/app/upload">{t("app.nav.newReview")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const job = r.job;
                const showDeadlineTone = r.deadlineCategory === "soon";
                const showWeekTone = r.deadlineCategory === "week";
                const deadlineLabelText = !r.hasDeadline
                  ? t("app.tenders.deadline.noDeadline")
                  : r.dueDays !== null && r.dueDays < 0
                    ? t("app.tenders.deadline.overdueDays", { days: Math.abs(r.dueDays) })
                    : r.dueDays === 0
                      ? t("app.tenders.deadline.dueToday")
                      : r.dueDays === 1
                        ? t("app.tenders.deadline.dueTomorrow")
                        : r.dueDays !== null
                          ? t("app.tenders.deadline.dueInDays", { days: r.dueDays })
                          : t("app.tenders.deadline.deadline");

                return (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/app/jobs/${job.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") router.push(`/app/jobs/${job.id}`);
                    }}
                    className="group rounded-2xl border bg-card/40 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{r.title}</p>
                        {r.secondary ? <p className="mt-1 truncate text-sm text-muted-foreground">{r.secondary}</p> : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 md:justify-end">
                        <StatusBadge status={job.status} />
                        <DecisionBadge text={r.decisionText} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span
                          className={
                            showDeadlineTone
                              ? "font-medium text-red-700 dark:text-red-300"
                              : showWeekTone
                                ? "font-medium text-amber-900 dark:text-amber-200"
                                : "text-muted-foreground"
                          }
                        >
                          {r.hasDeadline && r.deadline ? `${formatDeadline(r.deadline)} · ${deadlineLabelText}` : deadlineLabelText}
                        </span>

                        <span className="text-muted-foreground">{t("app.tenders.createdAt", { date: formatDate(job.created_at) })}</span>

                        {r.totalItems > 0 ? (
                          <span className="text-muted-foreground">
                            {t("app.tenders.bidRoomSummary", { open: r.openItems, total: r.totalItems })}
                            {r.overdueItems > 0 ? ` · ${t("app.tenders.overdueCount", { count: r.overdueItems })}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t("app.bidroom.notStarted")}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="hidden rounded-full sm:inline-flex"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/jobs/${job.id}/bid-room`);
                          }}
                        >
                          {t("app.bidroom.title")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hidden rounded-full sm:inline-flex"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/jobs/${job.id}/compliance`);
                          }}
                        >
                          {t("app.compliance.title")}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full px-3"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              disabled={deletingJobId === job.id}
                            >
                              ···
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/jobs/${job.id}`);
                              }}
                            >
                              {t("app.tenders.openTender")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/jobs/${job.id}/bid-room`);
                              }}
                            >
                              {t("app.bidroom.openBidRoom")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/jobs/${job.id}/compliance`);
                              }}
                            >
                              {t("app.compliance.openProposalCoverage")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(job);
                              }}
                            >
                              {deletingJobId === job.id ? t("app.common.deleting") : t("app.common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
