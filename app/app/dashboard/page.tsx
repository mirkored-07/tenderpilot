"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { getJobDisplayName } from "@/lib/pilot-job-names";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type JobStatus = "queued" | "processing" | "done" | "failed";

type DbJob = {
  id: string;
  user_id: string;
  status: JobStatus;
  file_name: string | null;
  created_at: string;
  updated_at: string;
};

type DbJobResult = {
  job_id: string;
  executive_summary: any;
  pipeline: any;
  created_at: string;
  updated_at: string;
};

type DbWorkItem = {
  job_id: string;
  type: string;
  ref_key: string;
  title: string;
  status: string;
  owner_label: string | null;
  due_at: string | null;
  notes: string | null;
  updated_at: string;
};

type DbJobMetadata = {
  job_id: string;
  deadline_override: string | null;
  portal_url: string | null;
  internal_bid_id: string | null;
  owner_label: string | null;
  decision_override: string | null;
  updated_at: string;
};

function DecisionBadge({ raw }: { raw: string }) {
  const t = String(raw ?? "").toLowerCase();
  if (t.includes("no") || t.includes("do not") || t.includes("reject")) {
    return (
      <Badge variant="destructive" className="rounded-full">
        No-Go
      </Badge>
    );
  }
  if (t.includes("hold") || t.includes("caution") || t.includes("verify")) {
    return (
      <Badge variant="secondary" className="rounded-full">
        Hold
      </Badge>
    );
  }
  if (t.includes("go") || t.includes("proceed")) {
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

function decisionBucket(raw: string): "go" | "hold" | "no-go" | "unknown" {
  const t = String(raw ?? "").toLowerCase();
  if (t.includes("no") || t.includes("do not") || t.includes("reject")) return "no-go";
  if (t.includes("hold") || t.includes("caution") || t.includes("verify")) return "hold";
  if (t.includes("go") || t.includes("proceed")) return "go";
  return "unknown";
}

function isDoneStatus(s?: string | null) {
  const v = String(s ?? "").toLowerCase().trim();
  return v === "done" || v === "completed" || v === "closed";
}

function SegmentedBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="flex h-full">
        {parts.map((p) => {
          const w = total > 0 ? (p.value / total) * 100 : 0;
          return <div key={p.label} className="h-full bg-foreground/70" style={{ width: `${w}%` }} />;
        })}
      </div>
    </div>
  );
}

function DonutChart({
  parts,
  size = 72,
  strokeWidth = 10,
}: {
  parts: { label: string; value: number }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = parts.reduce((s, p) => s + (p.value || 0), 0);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  const classes = ["text-foreground/90", "text-foreground/65", "text-foreground/45", "text-foreground/25"];
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-muted"
        strokeWidth={strokeWidth}
      />
      {parts.map((p, i) => {
        const v = p.value || 0;
        if (total <= 0 || v <= 0) return null;

        const dash = (v / total) * c;
        const gap = c - dash;

        const offset = c * 0.25 - acc;
        acc += dash;

        return (
          <circle
            key={p.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            className={classes[i % classes.length]}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
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
  return Math.ceil(ms / 86400000);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [jobResults, setJobResults] = useState<Record<string, DbJobResult>>({});
  const [jobMeta, setJobMeta] = useState<Record<string, DbJobMetadata>>({});
  const [workItems, setWorkItems] = useState<DbWorkItem[]>([]);

  const [ownerFilter, setOwnerFilter] = useState<string>("All");
  const [decisionFilter, setDecisionFilter] = useState<string>("All");
  const [windowDays, setWindowDays] = useState<number>(30);

  // Layout controls (progressive disclosure)
  const [standupMode, setStandupMode] = useState<boolean>(true);

  const [openSections, setOpenSections] = useState<{
    standup: boolean;
    analytics: boolean;
    blockers: boolean;
    bids: boolean;
    attention: boolean;
  }>({
    standup: false,
    analytics: false,
    blockers: false,
    bids: false,
    attention: false,
  });

  const [queueExpand, setQueueExpand] = useState<Record<string, boolean>>({
    needsTriage: false,
    deadlineUnknown: false,
    dueNext7: false,
    overdueWorkItems: false,
    blockedItems: false,
    unassignedItems: false,
    clarificationsPending: false,
  });

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();

      const { data: jobsData, error: jobsErr } = await supabase
        .from("jobs")
        .select("id,user_id,status,file_name,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (jobsErr) throw jobsErr;
      setJobs((jobsData as DbJob[]) ?? []);

      const ids = (jobsData ?? []).map((j: any) => String(j.id));

      const { data: resultsData } = await supabase
        .from("job_results")
        .select("job_id,executive_summary,pipeline,created_at,updated_at")
        .in("job_id", ids);

      const resMap: Record<string, any> = {};
      for (const r of resultsData ?? []) resMap[String((r as any).job_id)] = r;
      setJobResults(resMap);

      const { data: metaRows } = await supabase
        .from("job_metadata")
        .select("job_id,deadline_override,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
        .in("job_id", ids);

      const metaMap: Record<string, DbJobMetadata> = {};
      for (const row of metaRows ?? []) metaMap[String((row as any).job_id)] = row as any;
      setJobMeta(metaMap);

      const { data: workData } = await supabase
        .from("job_work_items")
        .select("job_id,type,ref_key,title,status,owner_label,due_at,notes,updated_at")
        .in("job_id", ids);

      setWorkItems((workData as DbWorkItem[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboardRows = useMemo(() => {
    const now = new Date();
    const byJob: Record<string, DbWorkItem[]> = {};
    for (const wi of workItems ?? []) {
      const jid = String(wi.job_id);
      (byJob[jid] ||= []).push(wi);
    }

    return (jobs ?? []).map((job) => {
      const r = jobResults[job.id];
      const exec = r?.executive_summary ?? {};
      const meta = jobMeta[job.id];

      const extractedDeadlineText = String(exec?.submissionDeadline ?? "").trim();
      const extractedDeadline = parseDeadlineToDateLocal(extractedDeadlineText);

      const deadline = meta?.deadline_override ? new Date(String(meta.deadline_override)) : extractedDeadline;
      const hasValidDeadline = !!deadline && Number.isFinite((deadline as Date).getTime());

      const extractedDecisionText = String(exec?.verdict ?? exec?.decisionBadge ?? "").trim();
      const decisionText = String(meta?.decision_override ?? extractedDecisionText).trim();
      const bucket = decisionBucket(decisionText);

      const deadlineText = meta?.deadline_override ? String(meta.deadline_override) : extractedDeadlineText;

      const dueSoon = hasValidDeadline ? daysUntil(deadline as Date, now) : null;
      const missingDeadline = !hasValidDeadline;

      const missingDecision = bucket === "unknown";

      const items = byJob[job.id] ?? [];
      const blocked = items.filter((w) => String(w?.status ?? "") === "blocked").length;
      const done = items.filter((w) => String(w?.status ?? "") === "done").length;
      const total = items.length;

      const displayName = job.file_name ? job.file_name : getJobDisplayName(job.id);

      return {
        job,
        displayName,
        decisionText,
        decisionBucket: bucket,
        deadlineText,
        deadline: deadline ? (deadline as Date).toISOString() : null,
        dueSoon,
        missingDeadline,
        missingDecision,
        blocked,
        done,
        total,
        updatedAt: job.updated_at,
      };
    });
  }, [jobs, jobResults, jobMeta, workItems]);

  const totals = useMemo(() => {
    const missingDeadline = dashboardRows.filter((r) => r.missingDeadline).length;
    const missingDecision = dashboardRows.filter((r) => r.missingDecision).length;
    const blockedItems = dashboardRows.reduce((s, r) => s + r.blocked, 0);
    const totalWork = dashboardRows.reduce((s, r) => s + r.total, 0);
    const doneWork = dashboardRows.reduce((s, r) => s + r.done, 0);
    return { missingDeadline, missingDecision, blockedItems, totalWork, doneWork };
  }, [dashboardRows]);

  const decisionBuckets = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of dashboardRows) m.set(r.decisionBucket, (m.get(r.decisionBucket) || 0) + 1);
    return m;
  }, [dashboardRows]);

  const workloadByOwner = useMemo(() => {
    const m = new Map<string, { total: number; blocked: number; overdue: number }>();
    const now = new Date();

    for (const wi of workItems ?? []) {
      const owner = String(wi.owner_label ?? "").trim() || "Unassigned";
      const row = m.get(owner) || { total: 0, blocked: 0, overdue: 0 };
      row.total += 1;
      if (String(wi.status ?? "") === "blocked") row.blocked += 1;
      if (wi.due_at) {
        const due = new Date(wi.due_at);
        if (Number.isFinite(due.getTime()) && due.getTime() < now.getTime() && !isDoneStatus(wi.status)) {
          row.overdue += 1;
        }
      }
      m.set(owner, row);
    }

    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [workItems]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const [k] of workloadByOwner) set.add(k);
    for (const j of jobs ?? []) {
      const o = String(jobMeta[j.id]?.owner_label ?? "").trim();
      if (o) set.add(o);
    }
    return ["All", ...Array.from(set).filter(Boolean)];
  }, [workloadByOwner, jobs, jobMeta]);

  const filteredRows = useMemo(() => {
    return dashboardRows.filter((r) => {
      if (decisionFilter !== "All" && r.decisionBucket !== decisionFilter) return false;
      if (ownerFilter === "All") return true;

      const items = workItems.filter((w) => String(w.job_id) === r.job.id);
      const hasOwner = items.some((w) => (String(w.owner_label ?? "").trim() || "Unassigned") === ownerFilter);

      const metaOwner = String(jobMeta[r.job.id]?.owner_label ?? "").trim();
      const hasMetaOwner = metaOwner && metaOwner === ownerFilter;

      return hasOwner || hasMetaOwner;
    });
  }, [dashboardRows, workItems, decisionFilter, ownerFilter, jobMeta]);

  const standupQueues = useMemo(() => {
    const now = new Date();

    const itemsByJob: Record<string, DbWorkItem[]> = {};
    for (const wi of workItems ?? []) {
      const jid = String(wi.job_id);
      (itemsByJob[jid] ||= []).push(wi);
    }

    const jobOwnerLabel = (jobId: string) => {
      const o = String(jobMeta[jobId]?.owner_label ?? "").trim();
      if (o) return o;
      const list = itemsByJob[jobId] ?? [];
      for (const wi of list) {
        const ow = String(wi.owner_label ?? "").trim();
        if (ow) return ow;
      }
      return "";
    };

    const needsTriage = (filteredRows ?? []).filter((r) => {
      const decisionUnknown = String(r?.decisionBucket ?? "").toLowerCase() === "unknown";
      const hasOwner = !!jobOwnerLabel(String(r.job.id));
      return decisionUnknown && !hasOwner;
    });

    const deadlineUnknown = (filteredRows ?? []).filter((r) => !!r?.missingDeadline);

    const dueNext7 = (filteredRows ?? []).filter((r) => {
      if (r?.missingDeadline) return false;
      const d = r?.deadline ? new Date(r.deadline) : null;
      if (!d || !Number.isFinite(d.getTime())) return false;
      const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      return days >= 0 && days <= 7;
    });

    const allVisibleJobIds = new Set((filteredRows ?? []).map((r) => String(r.job.id)));
    const visibleWorkItems = (workItems ?? []).filter((wi) => allVisibleJobIds.has(String(wi.job_id)));

    const overdueWorkItems = visibleWorkItems
      .filter((wi) => wi.due_at && !isDoneStatus(wi.status))
      .filter((wi) => new Date(String(wi.due_at)).getTime() < now.getTime())
      .sort((a, b) => new Date(String(a.due_at)).getTime() - new Date(String(b.due_at)).getTime());

    const blockedItems = visibleWorkItems
      .filter((wi) => String(wi.status ?? "").toLowerCase() === "blocked")
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    const unassignedItems = visibleWorkItems
      .filter((wi) => !isDoneStatus(wi.status))
      .filter((wi) => !String(wi.owner_label ?? "").trim())
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    const clarificationsPending = visibleWorkItems
      .filter((wi) => String(wi.type ?? "").toLowerCase() === "clarification")
      .filter((wi) => !isDoneStatus(wi.status))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    return {
      needsTriage,
      deadlineUnknown,
      dueNext7,
      overdueWorkItems,
      blockedItems,
      unassignedItems,
      clarificationsPending,
      jobOwnerLabel,
    };
  }, [filteredRows, workItems, jobMeta]);

  const deadlineHistogram = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: "Overdue", value: 0 },
      { label: "0-7d", value: 0 },
      { label: "8-30d", value: 0 },
      { label: "31-90d", value: 0 },
      { label: "Unknown", value: 0 },
    ];

    for (const r of filteredRows) {
      if (r.missingDeadline || !r.deadline) {
        buckets[4].value += 1;
        continue;
      }
      const d = new Date(r.deadline);
      const days = daysUntil(d, now);
      if (days < 0) buckets[0].value += 1;
      else if (days <= 7) buckets[1].value += 1;
      else if (days <= 30) buckets[2].value += 1;
      else buckets[3].value += 1;
    }
    return buckets;
  }, [filteredRows]);

  const attentionBids = useMemo(() => {
    function scoreRow(r: any) {
      let score = 0;
      if (r.missingDecision) score += 5;
      if (r.missingDeadline) score += 4;
      if (r.decisionBucket === "hold") score += 3;
      if (r.decisionBucket === "no-go") score += 2;
      if (r.blocked > 0) score += 4;
      if (typeof r.dueSoon === "number" && r.dueSoon <= 7) score += 4;
      if (typeof r.dueSoon === "number" && r.dueSoon < 0) score += 6;
      return score;
    }

    return [...filteredRows]
      .map((r) => ({ r, score: scoreRow(r) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.r);
  }, [filteredRows]);

  const topBlockedItems = useMemo(() => {
    return (workItems ?? [])
      .filter((w) => String(w?.status ?? "").toLowerCase() === "blocked")
      .map((w) => ({
        ...w,
        displayOwner: String(w.owner_label ?? "").trim() || "Unassigned",
      }))
      .slice(0, 10);
  }, [workItems]);

  useEffect(() => {
    if (topBlockedItems.length === 0) {
      setOpenSections((s) => ({ ...s, blockers: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topBlockedItems.length]);

  const visibleRows = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + windowDays * 86400000);

    return filteredRows
      .filter((r) => {
        if (!r.deadline) return true;
        const d = new Date(r.deadline);
        if (!Number.isFinite(d.getTime())) return true;
        return d.getTime() <= horizon.getTime();
      })
      .sort((a, b) => {
        const aUrg =
          (a.dueSoon !== null && a.dueSoon < 0 ? 1000 : 0) +
          (a.blocked > 0 ? 200 : 0) +
          (a.missingDecision ? 100 : 0) +
          (a.missingDeadline ? 80 : 0) +
          (a.dueSoon !== null ? Math.max(0, 30 - a.dueSoon) : 0);

        const bUrg =
          (b.dueSoon !== null && b.dueSoon < 0 ? 1000 : 0) +
          (b.blocked > 0 ? 200 : 0) +
          (b.missingDecision ? 100 : 0) +
          (b.missingDeadline ? 80 : 0) +
          (b.dueSoon !== null ? Math.max(0, 30 - b.dueSoon) : 0);

        if (bUrg !== aUrg) return bUrg - aUrg;
        return String(b.updatedAt).localeCompare(String(a.updatedAt));
      })
      .slice(0, 50);
  }, [filteredRows, windowDays]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bid manager dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={loadAll}>
            Refresh
          </Button>
        </div>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="mt-4 h-24 rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bid manager dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Decision readiness, deadlines, and team execution.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Jobs</Link>
          </Button>

          <button
            type="button"
            className="h-9 rounded-full border bg-background px-3 text-sm"
            onClick={() => setStandupMode((v) => !v)}
            aria-pressed={standupMode}
            title="Show only KPI + Daily standup + Needs attention"
          >
            {standupMode ? "Standup mode: On" : "Standup mode: Off"}
          </button>

          <Button variant="outline" className="rounded-full" onClick={loadAll}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-red-700">Dashboard error</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Portfolio</p>

            {(() => {
              const total = filteredRows.length;
              const missDecision = totals.missingDecision;
              const missDeadline = totals.missingDeadline;

              const bothMissing = filteredRows.filter((r) => r.missingDecision && r.missingDeadline).length;
              const decisionOnly = Math.max(0, missDecision - bothMissing);
              const deadlineOnly = Math.max(0, missDeadline - bothMissing);
              const ready = Math.max(0, total - (decisionOnly + deadlineOnly + bothMissing));

              const basicsPct = total > 0 ? Math.round((ready / total) * 100) : 0;

              return (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <DonutChart
                      parts={[
                        { label: "Ready", value: ready },
                        { label: "Missing decision", value: decisionOnly },
                        { label: "Missing deadline", value: deadlineOnly },
                        { label: "Missing both", value: bothMissing },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">basics present</p>
                      <p className="text-2xl font-semibold leading-none">{basicsPct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ready} ready • {total - ready} missing
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Ready {ready} • Missing decision {missDecision} • Missing deadline {missDeadline}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Execution</p>

            {(() => {
              const total = totals.totalWork;
              const done = totals.doneWork;
              const blocked = totals.blockedItems;
              const open = Math.max(0, total - done);
              const openNonBlocked = Math.max(0, open - blocked);

              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <DonutChart
                      parts={[
                        { label: "Done", value: done },
                        { label: "Blocked", value: blocked },
                        { label: "Open", value: openNonBlocked },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">% done</p>
                      <p className="text-2xl font-semibold leading-none">{pct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {done} done • {open} open
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {done} done • {open} open • {blocked} blocked
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Decisions</p>

            {(() => {
              const go = decisionBuckets.get("go") || 0;
              const hold = decisionBuckets.get("hold") || 0;
              const nogo = decisionBuckets.get("no-go") || 0;
              const unknown = decisionBuckets.get("unknown") || 0;

              const decided = go + hold + nogo;
              const total = decided + unknown;
              const pct = total > 0 ? Math.round((decided / total) * 100) : 0;

              return (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <DonutChart
                      parts={[
                        { label: "Go", value: go },
                        { label: "Hold", value: hold },
                        { label: "No-Go", value: nogo },
                        { label: "Unknown", value: unknown },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">% decided</p>
                      <p className="text-2xl font-semibold leading-none">{pct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {decided} decided • {unknown} unknown
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Go {go} • Hold {hold} • No-Go {nogo} • Missing {totals.missingDecision}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Owner</label>
          <select
            className="h-9 rounded-full border bg-background px-3 text-sm"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <label className="ml-2 text-xs text-muted-foreground">Decision</label>
          <select
            className="h-9 rounded-full border bg-background px-3 text-sm"
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
          >
            <option value="All">All</option>
            <option value="go">Go</option>
            <option value="hold">Hold</option>
            <option value="no-go">No-Go</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Window</label>
          <select
            className="h-9 rounded-full border bg-background px-3 text-sm"
            value={windowDays}
            onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
          >
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        </div>
      </div>

      {/* Daily standup (hero) */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Daily standup</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Actionable queues. Works even when the tender PDF has no deadline or decision.
              </p>
            </div>

            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setOpenSections((s) => ({ ...s, standup: !s.standup }))}
            >
              {openSections.standup ? "Collapse" : "Expand"}
            </button>
          </div>

          {openSections.standup ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {/* Needs triage */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Needs triage</p>
                <span className="text-xs text-muted-foreground">{standupQueues.needsTriage.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.needsTriage.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No jobs need triage.</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.needsTriage;
                    const rows = expanded ? standupQueues.needsTriage : standupQueues.needsTriage.slice(0, 6);
                    return (
                      <>
                        {rows.map((r) => (
                          <div key={r.job.id} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${r.job.id}`}>
                              {r.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">Owner: —</span>
                          </div>
                        ))}
                        {standupQueues.needsTriage.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, needsTriage: !s.needsTriage }))}
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.needsTriage.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Deadline unknown */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Deadline unknown</p>
                <span className="text-xs text-muted-foreground">{standupQueues.deadlineUnknown.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.deadlineUnknown.length === 0 ? (
                  <p className="text-xs text-muted-foreground">All visible jobs have a deadline (or override).</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.deadlineUnknown;
                    const rows = expanded ? standupQueues.deadlineUnknown : standupQueues.deadlineUnknown.slice(0, 6);
                    return (
                      <>
                        {rows.map((r) => (
                          <div key={r.job.id} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${r.job.id}`}>
                              {r.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">Add override</span>
                          </div>
                        ))}
                        {standupQueues.deadlineUnknown.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, deadlineUnknown: !s.deadlineUnknown }))}
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.deadlineUnknown.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Due next 7 days */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Due next 7 days</p>
                <span className="text-xs text-muted-foreground">{standupQueues.dueNext7.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.dueNext7.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No jobs due within 7 days.</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.dueNext7;
                    const rows = expanded ? standupQueues.dueNext7 : standupQueues.dueNext7.slice(0, 6);
                    return (
                      <>
                        {rows.map((r) => (
                          <div key={r.job.id} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${r.job.id}`}>
                              {r.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {r.deadline ? new Date(r.deadline).toLocaleDateString() : "—"}
                            </span>
                          </div>
                        ))}
                        {standupQueues.dueNext7.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, dueNext7: !s.dueNext7 }))}
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.dueNext7.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Overdue work items */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Overdue work items</p>
                <span className="text-xs text-muted-foreground">{standupQueues.overdueWorkItems.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.overdueWorkItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No overdue work items.</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.overdueWorkItems;
                    const rows = expanded
                      ? standupQueues.overdueWorkItems
                      : standupQueues.overdueWorkItems.slice(0, 6);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || "Work item")}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {wi.due_at ? new Date(wi.due_at).toLocaleDateString() : "—"}
                            </span>
                          </div>
                        ))}
                        {standupQueues.overdueWorkItems.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, overdueWorkItems: !s.overdueWorkItems }))}
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.overdueWorkItems.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Blocked items */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Blocked items</p>
                <span className="text-xs text-muted-foreground">{standupQueues.blockedItems.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.blockedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No blocked items.</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.blockedItems;
                    const rows = expanded ? standupQueues.blockedItems : standupQueues.blockedItems.slice(0, 6);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || "Work item")}
                            </Link>
                            <span className="text-xs text-muted-foreground">{String(wi.owner_label ?? "Unassigned")}</span>
                          </div>
                        ))}
                        {standupQueues.blockedItems.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, blockedItems: !s.blockedItems }))}
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.blockedItems.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Unassigned items */}
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Unassigned items</p>
                <span className="text-xs text-muted-foreground">{standupQueues.unassignedItems.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.unassignedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No unassigned items.</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.unassignedItems;
                    const rows = expanded ? standupQueues.unassignedItems : standupQueues.unassignedItems.slice(0, 6);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || "Work item")}
                            </Link>
                            <span className="text-xs text-muted-foreground">Owner: —</span>
                          </div>
                        ))}
                        {standupQueues.unassignedItems.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, unassignedItems: !s.unassignedItems }))}
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.unassignedItems.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Clarifications pending */}
            <div className="rounded-xl border p-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Clarifications pending</p>
                <span className="text-xs text-muted-foreground">{standupQueues.clarificationsPending.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.clarificationsPending.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No open clarification items.</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.clarificationsPending;
                    const rows = expanded
                      ? standupQueues.clarificationsPending
                      : standupQueues.clarificationsPending.slice(0, 8);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex items-center justify-between gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || "Clarification")}
                            </Link>
                            <span className="text-xs text-muted-foreground">{String(wi.owner_label ?? "Unassigned")}</span>
                          </div>
                        ))}
                        {standupQueues.clarificationsPending.length > 8 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() =>
                              setQueueExpand((s) => ({ ...s, clarificationsPending: !s.clarificationsPending }))
                            }
                          >
                            {expanded ? "Show less" : `Show all (${standupQueues.clarificationsPending.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Collapsed.</p>
          )}
        </CardContent>
      </Card>

      {/* Needs attention (expanded by default; Top 5 when collapsed) */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Needs attention</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Highest priority bids based on missing fields, deadlines, and blockers.
              </p>
            </div>

            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setOpenSections((s) => ({ ...s, attention: !s.attention }))}
            >
              {openSections.attention ? "Collapse" : "Expand"}
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {attentionBids.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing urgent right now.</p>
            ) : (
              (() => {
                const expanded = openSections.attention;
                const rows = expanded ? attentionBids : attentionBids.slice(0, 5);

                return (
                  <>
                    {rows.map((r: any) => (
                      <div key={r.job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                        <div className="min-w-0">
                          <Link href={`/app/jobs/${r.job.id}`} className="text-sm font-semibold hover:underline">
                            {r.displayName}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.missingDecision ? "Decision missing" : r.decisionText || "Decision unknown"}
                            {" • "}
                            {r.missingDeadline ? "Deadline missing" : r.deadlineText || "Deadline unknown"}
                            {" • "}
                            {r.blocked > 0 ? `${r.blocked} blocked` : "No blockers"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DecisionBadge raw={r.decisionText} />
                          {r.dueSoon !== null ? (
                            <Badge variant={r.dueSoon < 0 ? "destructive" : "outline"} className="rounded-full">
                              {r.dueSoon < 0 ? `${Math.abs(r.dueSoon)}d overdue` : `${r.dueSoon}d`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full">
                              No deadline
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    {attentionBids.length > 5 ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setOpenSections((s) => ({ ...s, attention: !s.attention }))}
                      >
                        {expanded ? "Show less" : `Show all (${attentionBids.length})`}
                      </button>
                    ) : null}
                  </>
                );
              })()
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analytics (collapsed by default; hidden in standup mode) */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Analytics</p>
              <p className="mt-1 text-xs text-muted-foreground">Deadline distribution and workload overview.</p>
            </div>

            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setOpenSections((s) => ({ ...s, analytics: !s.analytics }))}
              disabled={standupMode}
              title={standupMode ? "Hidden in standup mode" : "Expand/collapse analytics"}
            >
              {standupMode ? "Hidden" : openSections.analytics ? "Collapse" : "Expand"}
            </button>
          </div>

          {standupMode ? (
            <p className="mt-3 text-xs text-muted-foreground">Hidden in standup mode.</p>
          ) : openSections.analytics ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Deadlines</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Distribution of deadlines across the visible portfolio.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{filteredRows.length} bids</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <SegmentedBar parts={deadlineHistogram} />
                    <p className="text-xs text-muted-foreground">
                      Overdue {deadlineHistogram[0].value} • 0-7d {deadlineHistogram[1].value} • 8-30d{" "}
                      {deadlineHistogram[2].value} • 31-90d {deadlineHistogram[3].value} • Unknown{" "}
                      {deadlineHistogram[4].value}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Workload by owner</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Who is carrying open work and where the blockers are.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{workloadByOwner.length} owners</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {workloadByOwner.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No work items yet.</p>
                    ) : (
                      workloadByOwner.slice(0, 7).map(([owner, stats]) => (
                        <div key={owner} className="flex items-center justify-between">
                          <p className="text-sm">{owner}</p>
                          <p className="text-xs text-muted-foreground">
                            {stats.total} items • {stats.blocked} blocked • {stats.overdue} overdue
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Expand to view analytics.</p>
          )}
        </CardContent>
      </Card>

      {/* Top blockers (collapsible; hidden in standup mode) */}
      {!standupMode ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Top blockers</p>
                <p className="mt-1 text-xs text-muted-foreground">Blocked work items across bids.</p>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setOpenSections((s) => ({ ...s, blockers: !s.blockers }))}
                disabled={topBlockedItems.length === 0}
                title={topBlockedItems.length === 0 ? "No blockers" : "Expand/collapse"}
              >
                {topBlockedItems.length === 0 ? "None" : openSections.blockers ? "Collapse" : "Expand"}
              </button>
            </div>

            <Separator className="my-3" />

            {openSections.blockers ? (
              <div className="space-y-2">
                {topBlockedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No blocked items.</p>
                ) : (
                  topBlockedItems.map((w: any, idx: number) => (
                    <div
                      key={`${w.job_id}:${w.ref_key}:${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                    >
                      <div className="min-w-0">
                        <Link href={`/app/jobs/${w.job_id}`} className="text-sm font-semibold hover:underline">
                          {getJobDisplayName(String(w.job_id))}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">{w.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          {String(w.displayOwner)}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          Blocked
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Collapsed.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Bids (collapsible; hidden in standup mode; Top 10 by default) */}
      {!standupMode ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Bids</p>
                <p className="mt-1 text-xs text-muted-foreground">Sorted by urgency within the selected window.</p>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setOpenSections((s) => ({ ...s, bids: !s.bids }))}
              >
                {openSections.bids ? "Collapse" : "Expand"}
              </button>
            </div>

            <Separator className="my-3" />

            {openSections.bids ? (
              <div className="space-y-2">
                {visibleRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No bids match the current filters.</p>
                ) : (
                  (() => {
                    const topN = 10;
                    const expanded = queueExpand.__bidsAll === true;
                    const rows = expanded ? visibleRows : visibleRows.slice(0, topN);

                    return (
                      <>
                        {rows.map((r) => (
                          <div
                            key={r.job.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                          >
                            <div className="min-w-0">
                              <Link href={`/app/jobs/${r.job.id}`} className="text-sm font-semibold hover:underline">
                                {r.displayName}
                              </Link>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {r.missingDecision ? "Decision missing" : r.decisionText || "Decision unknown"}
                                {" • "}
                                {r.missingDeadline ? "Deadline missing" : r.deadlineText || "Deadline unknown"}
                                {" • "}
                                {r.total > 0 ? `${r.done}/${r.total} items done` : "No work items"}
                                {r.blocked > 0 ? ` • ${r.blocked} blocked` : ""}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <DecisionBadge raw={r.decisionText} />
                              {r.dueSoon !== null ? (
                                <Badge variant={r.dueSoon < 0 ? "destructive" : "outline"} className="rounded-full">
                                  {r.dueSoon < 0 ? `${Math.abs(r.dueSoon)}d overdue` : `${r.dueSoon}d`}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">
                                  No deadline
                                </Badge>
                              )}
                              <Badge variant="outline" className="rounded-full">
                                {r.job.status}
                              </Badge>
                            </div>
                          </div>
                        ))}

                        {visibleRows.length > topN ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, __bidsAll: !s.__bidsAll }))}
                          >
                            {expanded ? "Show less" : `Show all (${visibleRows.length})`}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Collapsed.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Tip: Missing deadlines and decisions are common when the tender PDF does not contain them. Use job metadata overrides to keep your workflow usable.
      </p>
    </div>
  );
}
