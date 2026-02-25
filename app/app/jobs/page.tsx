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
  const b = decisionBucket(text);
  if (b === "no-go") {
    return (
      <Badge variant="destructive" className="rounded-full">
        No-Go
      </Badge>
    );
  }
  if (b === "hold") {
    return (
      <Badge variant="secondary" className="rounded-full">
        Hold
      </Badge>
    );
  }
  if (b === "go") {
    return (
      <Badge variant="default" className="rounded-full">
        Go
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full">
      Unknown
    </Badge>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
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
      <Badge variant="secondary" className="rounded-full">
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
      setLoadError("Your jobs could not be loaded. Please refresh the page.");
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
    const ok = window.confirm(
      `Delete "${getJobDisplayName(job.id) || job.file_name}"?\n\nThis will remove the tender review and its results. This cannot be undone.`
    );
    if (!ok) return;

    setActionError(null);
    setDeletingJobId(job.id);

    try {
      const supabase = supabaseBrowser();

      const r1 = await supabase
        .from("job_results")
        .delete()
        .eq("job_id", job.id);
      if (r1.error) throw r1.error;

      const r2 = await supabase
        .from("job_events")
        .delete()
        .eq("job_id", job.id);
      if (r2.error) throw r2.error;

      const r3 = await supabase.from("jobs").delete().eq("id", job.id);
      if (r3.error) throw r3.error;

      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      track("job_deleted", { job_id: job.id, source: "jobs_list" });
    } catch (e) {
      console.error("Delete failed", e);
      setActionError("Could not delete this tender review. Please try again.");
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

        const title = String(getJobDisplayName(job.id) || job.file_name || "Tender").trim();

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
        const extractedDecisionText = extractedDecisionTextRaw || "Proceed with caution";
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

  const statusLabel = statusFilter === "all" ? "All" : statusFilter === "ready" ? "Ready" : statusFilter === "failed" ? "Failed" : "Processing";
  const decisionLabel =
    decisionFilter === "all" ? "Any" : decisionFilter === "no-go" ? "No-Go" : decisionFilter === "unset" ? "Unset" : decisionFilter === "hold" ? "Hold" : "Go";
  const deadlineLabel =
    deadlineFilter === "all" ? "Any" : deadlineFilter === "due-soon" ? "Due soon" : deadlineFilter === "this-week" ? "This week" : "No deadline";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Triage tenders fast. Open analysis for the decision cockpit, then move to bid room or proposal coverage.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={loadJobs}
          >
            Refresh
          </Button>

          <Button asChild className="rounded-full">
            <Link href="/app/upload">New tender review</Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Tenders</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading tenders from your workspace."
              : loadError
              ? "We could not load your tenders."
              : "Search, filter, then open analysis for the decision cockpit."}
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
                  placeholder="Search tenders"
                  className="rounded-full"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-full">
                      Status: {statusLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { v: "all", label: "All" },
                      { v: "ready", label: "Ready" },
                      { v: "processing", label: "Processing" },
                      { v: "failed", label: "Failed" },
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
                      Decision: {decisionLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { v: "all", label: "Any" },
                      { v: "go", label: "Go" },
                      { v: "hold", label: "Hold" },
                      { v: "no-go", label: "No-Go" },
                      { v: "unset", label: "Unset" },
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
                      Deadline: {deadlineLabel}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      { v: "all", label: "Any" },
                      { v: "due-soon", label: "Due soon" },
                      { v: "this-week", label: "This week" },
                      { v: "no-deadline", label: "No deadline" },
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

            {!loading ? <p className="text-xs text-muted-foreground">{rows.length} shown</p> : null}
          </div>

          {loading ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">Loading</p>
              <p className="mt-1 text-sm text-muted-foreground">Fetching your tenders.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">No tenders found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try clearing filters, or upload a new tender to start.</p>
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
                  Clear filters
                </Button>
                <Button asChild className="rounded-full">
                  <Link href="/app/upload">New tender review</Link>
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
                  ? "No deadline"
                  : r.dueDays !== null && r.dueDays < 0
                    ? `Overdue (${Math.abs(r.dueDays)}d)`
                    : r.dueDays === 0
                      ? "Due today"
                      : r.dueDays === 1
                        ? "Due tomorrow"
                        : r.dueDays !== null
                          ? `Due in ${r.dueDays}d`
                          : "Deadline";

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

                        <span className="text-muted-foreground">Created {formatDate(job.created_at)}</span>

                        {r.totalItems > 0 ? (
                          <span className="text-muted-foreground">
                            Bid Room {r.openItems} open of {r.totalItems}
                            {r.overdueItems > 0 ? ` · ${r.overdueItems} overdue` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Bid Room not started</span>
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
                          Bid Room
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
                          Proposal coverage
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
                              Open analysis
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/jobs/${job.id}/bid-room`);
                              }}
                            >
                              Open bid room
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/jobs/${job.id}/compliance`);
                              }}
                            >
                              Open proposal coverage
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(job);
                              }}
                            >
                              {deletingJobId === job.id ? "Deleting…" : "Delete"}
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
