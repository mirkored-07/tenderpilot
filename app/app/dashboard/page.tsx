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
  file_name: string;
  status: JobStatus;
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

/**
 * Robust-ish parsing for the formats we have seen in job_results.executive_summary.submissionDeadline:
 * - "15:00 28/05/2014"
 * - "28/05/2014"
 * - ISO dates
 * - "30 April 2025 at 12:00 CET" (best-effort via Date())
 *
 * Returns null when the string is a narrative (e.g. "Not found in extracted text" / "Refer to tender documents").
 */
function parseDeadlineToDateLocal(input: string): Date | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  // Narrative / non-date hints we saw in UI
  const lowered = s.toLowerCase();
  if (
    lowered.includes("not found") ||
    lowered.includes("refer to") ||
    lowered.includes("see tender") ||
    lowered.includes("verify") ||
    lowered.includes("exact deadline") ||
    lowered.includes("unknown")
  ) {
    return null;
  }

  // Common EU format: "15:00 28/05/2014" or "28/05/2014"
  const m = s.match(/(?:(\d{1,2}):(\d{2})\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const hh = m[1] ? parseInt(m[1], 10) : 0;
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const dd = parseInt(m[3], 10);
    const mo = parseInt(m[4], 10) - 1;
    const yyyy = parseInt(m[5], 10);
    const d = new Date(yyyy, mo, dd, hh, mm, 0, 0);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // Fallback: rely on JS Date parsing (ISO, long-form English, etc.)
  const d2 = new Date(s);
  return Number.isFinite(d2.getTime()) ? d2 : null;
}

function daysUntil(d: Date, now = new Date()) {
  return Math.ceil((d.getTime() - now.getTime()) / (24 * 3600 * 1000));
}

function daysAgo(iso: string, now = new Date()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / (24 * 3600 * 1000));
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function verdictBadge(label: string) {
  const t = String(label ?? "").toLowerCase();
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
  if (t.includes("go") || t.includes("proceed")) return <Badge className="rounded-full">Go</Badge>;
  return (
    <Badge variant="outline" className="rounded-full">
      —
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

function SegmentedBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="flex h-full w-full">
        {parts.map((p) => {
          const w = total > 0 ? (p.value / total) * 100 : 0;
          return <div key={p.label} style={{ width: `${w}%` }} className="h-full bg-foreground/70" />;
        })}
      </div>
    </div>
  );
}

function MiniBars({ values, max }: { values: number[]; max: number }) {
  return (
    <div className="flex h-10 items-end gap-1">
      {values.map((v, idx) => {
        const h = max > 0 ? (v / max) * 100 : 0;
        return <div key={idx} className="w-2 rounded-sm bg-foreground/20" style={{ height: `${clamp(h, 4, 100)}%` }} />;
      })}
    </div>
  );
}

function StackedBar({
  todo,
  inProgress,
  blocked,
  done,
}: {
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
}) {
  const total = todo + inProgress + blocked + done;
  const w = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="flex h-full w-full">
        <div style={{ width: w(todo) }} className="h-full bg-foreground/20" />
        <div style={{ width: w(inProgress) }} className="h-full bg-foreground/35" />
        <div style={{ width: w(blocked) }} className="h-full bg-foreground/55" />
        <div style={{ width: w(done) }} className="h-full bg-foreground/75" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [jobResults, setJobResults] = useState<Record<string, any>>({});
  const [workItems, setWorkItems] = useState<DbWorkItem[]>([]);

  const [ownerFilter, setOwnerFilter] = useState<string>("All");
  const [decisionFilter, setDecisionFilter] = useState<string>("All");
  const [windowDays, setWindowDays] = useState<number>(30);

  async function loadAll() {
    setError(null);
    setLoading(true);

    const supabase = supabaseBrowser();
    const { data: jobsData, error: jobsErr } = await supabase
      .from("jobs")
      .select("id,file_name,status,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (jobsErr) {
      console.error(jobsErr);
      setError("Could not load dashboard.");
      setJobs([]);
      setLoading(false);
      return;
    }

    const ids = (jobsData ?? []).map((j) => j.id);
    setJobs((jobsData ?? []) as DbJob[]);

    // job_results (deadline + decision)
    const { data: resultsData } = await supabase
      .from("job_results")
      .select("job_id,executive_summary,clarifications")
      .in("job_id", ids);

    const resMap: Record<string, any> = {};
    for (const r of resultsData ?? []) resMap[String((r as any).job_id)] = r;
    setJobResults(resMap);

    // work items (progress + blockers)
    const { data: workData } = await supabase
      .from("job_work_items")
      .select("job_id,type,ref_key,title,status,owner_label,due_at,notes,updated_at")
      .in("job_id", ids);
    setWorkItems((workData as DbWorkItem[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboardRows = useMemo(() => {
    const now = new Date();
    const byJob: Record<string, DbWorkItem[]> = {};
    for (const w of workItems ?? []) {
      const id = String(w?.job_id ?? "");
      byJob[id] = byJob[id] || [];
      byJob[id].push(w);
    }

    return jobs.map((j) => {
      const r = jobResults[j.id];
      const exec = r?.executive_summary ?? {};

      const deadlineText = String(exec?.submissionDeadline ?? "").trim();
      const deadline = parseDeadlineToDateLocal(deadlineText);

      const decisionText = String(exec?.verdict ?? exec?.decisionBadge ?? "").trim();
      const bucket = decisionBucket(decisionText);

      const w = byJob[j.id] ?? [];
      const total = w.length;
      const done = w.filter((x) => String(x?.status ?? "") === "done").length;
      const blocked = w.filter((x) => String(x?.status ?? "") === "blocked").length;
      const openClar = w.filter((x) => String(x?.type ?? "") === "clarification" && String(x?.status ?? "") !== "done").length;
      const unassigned = w.filter((x) => !String(x?.owner_label ?? "").trim()).length;
      const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

      const dueSoon = deadline ? daysUntil(deadline, now) : null;
      const missingDeadline = !deadline;
      const missingDecision = bucket === "unknown";

      // Work-item due dates (fallback signal, does NOT replace tender deadline)
      const wiDue = w
        .map((x) => (x?.due_at ? new Date(String(x.due_at)) : null))
        .filter((d): d is Date => !!d && Number.isFinite(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const wiDueSoon = wiDue ? daysUntil(wiDue, now) : null;

      return {
        job: j,
        decision: decisionText,
        decisionBucket: bucket,
        deadlineText,
        deadline,
        dueSoon,
        progressPct,
        total,
        done,
        blocked,
        openClar,
        unassigned,
        missingDeadline,
        missingDecision,
        wiDue,
        wiDueSoon,
      };
    });
  }, [jobs, jobResults, workItems]);

  const workloadByOwner = useMemo(() => {
    const map = new Map<string, { todo: number; in_progress: number; blocked: number; done: number }>();
    for (const w of workItems ?? []) {
      const owner = String(w?.owner_label ?? "").trim() || "Unassigned";
      const s = String(w?.status ?? "todo");
      if (!map.has(owner)) map.set(owner, { todo: 0, in_progress: 0, blocked: 0, done: 0 });
      const row = map.get(owner)!;
      if (s === "done") row.done += 1;
      else if (s === "in_progress") row.in_progress += 1;
      else if (s === "blocked") row.blocked += 1;
      else row.todo += 1;
    }

    return Array.from(map.entries()).sort((a, b) => {
      const aa = a[1].todo + a[1].in_progress + a[1].blocked;
      const bb = b[1].todo + b[1].in_progress + b[1].blocked;
      return bb - aa;
    });
  }, [workItems]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const [k] of workloadByOwner) set.add(k);
    return ["All", ...Array.from(set).filter(Boolean)];
  }, [workloadByOwner]);

  const decisionBuckets = useMemo(() => {
    const map = new Map<string, number>([
      ["go", 0],
      ["hold", 0],
      ["no-go", 0],
      ["unknown", 0],
    ]);
    for (const r of dashboardRows) map.set(r.decisionBucket, (map.get(r.decisionBucket) || 0) + 1);
    return map;
  }, [dashboardRows]);

  const totals = useMemo(() => {
    const activeBids = jobs.filter((j) => j.status !== "failed").length;

    const withDeadline = dashboardRows.filter((r) => !!r.deadline);
    const dueSoon = withDeadline.filter((r) => typeof r.dueSoon === "number" && r.dueSoon <= 7 && r.dueSoon >= 0).length;
    const overdue = withDeadline.filter((r) => typeof r.dueSoon === "number" && r.dueSoon < 0).length;

    const missingDeadline = dashboardRows.filter((r) => r.missingDeadline).length;
    const missingDecision = dashboardRows.filter((r) => r.missingDecision).length;

    const blockedItems = workItems.filter((w) => String(w?.status ?? "") === "blocked").length;
    const unassignedItems = workItems.filter((w) => !String(w?.owner_label ?? "").trim()).length;
    const openClarifications = workItems.filter((w) => String(w?.type ?? "") === "clarification" && String(w?.status ?? "") !== "done").length;

    // Work-item due fallback: due soon if any work item has due_at within 7 days
    const wiDueSoon = dashboardRows.filter((r) => typeof r.wiDueSoon === "number" && r.wiDueSoon <= 7 && r.wiDueSoon >= 0).length;

    return { activeBids, dueSoon, overdue, blockedItems, unassignedItems, openClarifications, missingDeadline, missingDecision, wiDueSoon };
  }, [jobs, dashboardRows, workItems]);

  const filteredRows = useMemo(() => {
    return dashboardRows.filter((r) => {
      if (decisionFilter !== "All" && r.decisionBucket !== decisionFilter) return false;
      if (ownerFilter === "All") return true;
      const items = workItems.filter((w) => String(w.job_id) === r.job.id);
      return items.some((w) => (String(w.owner_label ?? "").trim() || "Unassigned") === ownerFilter);
    });
  }, [dashboardRows, decisionFilter, ownerFilter, workItems]);

  const deadlineHistogram = useMemo(() => {
    const now = new Date();
    const buckets = new Array(windowDays).fill(0);
    let missing = 0;
    let overdue = 0;

    for (const r of dashboardRows) {
      if (!r.deadline) {
        missing += 1;
        continue;
      }
      const d = daysUntil(r.deadline, now);
      if (d < 0) {
        overdue += 1;
        continue;
      }
      if (d >= 0 && d < windowDays) buckets[d] += 1;
    }

    const max = buckets.reduce((m, v) => Math.max(m, v), 0);
    const totalUpcoming = buckets.reduce((s, v) => s + v, 0);
    return { buckets, max, missing, overdue, totalUpcoming };
  }, [dashboardRows, windowDays]);

  const attentionBids = useMemo(() => {
    function score(r: any) {
      let s = 0;

      // Deadline-based urgency
      if (typeof r.dueSoon === "number") {
        if (r.dueSoon < 0) s += 1000;
        else if (r.dueSoon <= 3) s += 550;
        else if (r.dueSoon <= 7) s += 350;
        else if (r.dueSoon <= 14) s += 120;
      } else {
        // No deadline found: still urgent for a bid manager
        if (r.missingDeadline) s += 180;
      }

      // Work-item due date fallback (secondary signal)
      if (typeof r.wiDueSoon === "number") {
        if (r.wiDueSoon < 0) s += 200;
        else if (r.wiDueSoon <= 3) s += 140;
        else if (r.wiDueSoon <= 7) s += 90;
      }

      // Execution signals
      s += (r.blocked || 0) * 80;
      s += (r.unassigned || 0) * 25;
      s += (r.openClar || 0) * 20;

      if ((typeof r.dueSoon === "number" && r.dueSoon <= 7) || (typeof r.wiDueSoon === "number" && r.wiDueSoon <= 7)) {
        if (r.progressPct < 30) s += 120;
      }

      // Decision readiness
      if (r.missingDecision) s += 120;
      if (r.decisionBucket === "hold") s += 60;
      if (r.decisionBucket === "no-go") s += 30;

      return s;
    }

    const rows = filteredRows
      .map((r) => ({ ...r, score: score(r) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    return rows.map((r: any) => {
      const reasons: string[] = [];

      if (typeof r.dueSoon === "number") {
        if (r.dueSoon < 0) reasons.push(`Overdue ${Math.abs(r.dueSoon)}d`);
        else if (r.dueSoon <= 7) reasons.push(`Due in ${r.dueSoon}d`);
      } else if (r.missingDeadline) {
        reasons.push("Missing deadline");
      }

      if (typeof r.wiDueSoon === "number") {
        if (r.wiDueSoon < 0) reasons.push(`Work items overdue`);
        else if (r.wiDueSoon <= 7) reasons.push(`Work due in ${r.wiDueSoon}d`);
      }

      if (r.missingDecision) reasons.push("Missing decision");
      if (r.blocked > 0) reasons.push(`${r.blocked} blocked`);
      if (r.unassigned > 0) reasons.push(`${r.unassigned} unassigned`);
      if (r.openClar > 0) reasons.push(`${r.openClar} clarifications`);

      if (!reasons.length) reasons.push("Needs review");

      return { ...r, reason: reasons.slice(0, 3).join(" • ") };
    });
  }, [filteredRows]);

  const topBlockedItems = useMemo(() => {
    const now = new Date();
    return (workItems ?? [])
      .filter((w) => String(w?.status ?? "") === "blocked")
      .map((w) => ({
        ...w,
        owner: String(w.owner_label ?? "").trim() || "Unassigned",
        ageDays: daysAgo(w.updated_at, now),
      }))
      .sort((a, b) => {
        const aa = a.ageDays ?? 0;
        const bb = b.ageDays ?? 0;
        if (bb !== aa) return bb - aa;
        return String(b.updated_at).localeCompare(String(a.updated_at));
      })
      .slice(0, 10);
  }, [workItems]);

  if (loading) {
    return <div className="mx-auto max-w-6xl py-10 text-sm text-muted-foreground">Loading dashboard…</div>;
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
          <Button variant="outline" className="rounded-full" onClick={loadAll}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active bids</p>
            <p className="mt-1 text-2xl font-semibold">{totals.activeBids}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Due soon (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{totals.dueSoon}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Overdue: <span className="text-foreground">{totals.overdue}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Missing deadline</p>
            <p className="mt-1 text-2xl font-semibold">{totals.missingDeadline}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Work due soon: <span className="text-foreground">{totals.wiDueSoon}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Blocked items</p>
            <p className="mt-1 text-2xl font-semibold">{totals.blockedItems}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unassigned</p>
            <p className="mt-1 text-2xl font-semibold">{totals.unassignedItems}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open clarifications</p>
            <p className="mt-1 text-2xl font-semibold">{totals.openClarifications}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Decision mix</p>
            <div className="mt-2">
              <SegmentedBar
                parts={[
                  { label: "go", value: decisionBuckets.get("go") || 0 },
                  { label: "hold", value: decisionBuckets.get("hold") || 0 },
                  { label: "no-go", value: decisionBuckets.get("no-go") || 0 },
                  { label: "unknown", value: decisionBuckets.get("unknown") || 0 },
                ]}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Go {decisionBuckets.get("go") || 0} • Hold {decisionBuckets.get("hold") || 0} • No-Go {decisionBuckets.get("no-go") || 0} • Missing {totals.missingDecision}
            </p>
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

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Deadlines</p>
                <p className="mt-1 text-xs text-muted-foreground">Bids due in the next {windowDays} days.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Upcoming</p>
                <p className="text-sm font-semibold">{deadlineHistogram.totalUpcoming}</p>
              </div>
            </div>
            <Separator className="my-3" />
            <MiniBars values={deadlineHistogram.buckets} max={deadlineHistogram.max} />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Overdue: <span className="text-foreground">{deadlineHistogram.overdue}</span></span>
              <span>•</span>
              <span>Missing: <span className="text-foreground">{deadlineHistogram.missing}</span></span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Each bar represents a day from today (left) to +{windowDays}d (right). Overdue/missing are counted separately.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Workload by owner</p>
            <p className="mt-1 text-xs text-muted-foreground">Capacity view across all bids.</p>
            <Separator className="my-3" />

            <div className="space-y-3">
              {workloadByOwner.length ? (
                workloadByOwner.map(([owner, c]) => (
                  <div key={owner} className="rounded-xl border bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => setOwnerFilter(owner === ownerFilter ? "All" : owner)}
                      >
                        {owner}
                      </button>
                      <p className="text-xs text-muted-foreground">{c.todo + c.in_progress + c.blocked} open</p>
                    </div>
                    <div className="mt-2">
                      <StackedBar todo={c.todo} inProgress={c.in_progress} blocked={c.blocked} done={c.done} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="rounded-full">Todo {c.todo}</Badge>
                      <Badge variant="outline" className="rounded-full">In progress {c.in_progress}</Badge>
                      <Badge variant="secondary" className="rounded-full">Blocked {c.blocked}</Badge>
                      <Badge className="rounded-full">Done {c.done}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No work items yet. Open a bid and use “Bid room” to assign tasks.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Needs attention today</p>
            <p className="mt-1 text-xs text-muted-foreground">Ranked by deadline risk, blockers, missing deadline/decision, and missing ownership.</p>
            <Separator className="my-3" />

            <div className="space-y-2">
              {attentionBids.length ? (
                attentionBids.map((r: any) => (
                  <div key={r.job.id} className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3">
                    <div className="min-w-0">
                      <Link className="text-sm font-medium hover:underline" href={`/app/jobs/${r.job.id}`}>
                        {getJobDisplayName(r.job.id) || r.job.file_name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.deadlineText ? `Deadline: ${r.deadlineText}` : "Deadline: —"} • {r.reason}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {verdictBadge(r.decision)}
                        <Badge variant="outline" className="rounded-full">Progress {r.progressPct}%</Badge>
                        {r.blocked > 0 ? <Badge variant="secondary" className="rounded-full">Blocked {r.blocked}</Badge> : null}
                        {r.unassigned > 0 ? <Badge variant="outline" className="rounded-full">Unassigned {r.unassigned}</Badge> : null}
                        {r.openClar > 0 ? <Badge variant="outline" className="rounded-full">Clarifications {r.openClar}</Badge> : null}
                        {r.missingDeadline ? <Badge variant="outline" className="rounded-full">Missing deadline</Badge> : null}
                        {r.missingDecision ? <Badge variant="outline" className="rounded-full">Missing decision</Badge> : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {typeof r.dueSoon === "number" ? (
                        r.dueSoon < 0 ? (
                          <Badge variant="destructive" className="rounded-full">Past due</Badge>
                        ) : r.dueSoon <= 7 ? (
                          <Badge variant="secondary" className="rounded-full">Due in {r.dueSoon}d</Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full">{r.dueSoon}d</Badge>
                        )
                      ) : typeof r.wiDueSoon === "number" ? (
                        r.wiDueSoon < 0 ? (
                          <Badge variant="secondary" className="rounded-full">Work overdue</Badge>
                        ) : r.wiDueSoon <= 7 ? (
                          <Badge variant="secondary" className="rounded-full">Work due {r.wiDueSoon}d</Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full">Work {r.wiDueSoon}d</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="rounded-full">—</Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No items need attention based on the current filters.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Top blockers</p>
            <p className="mt-1 text-xs text-muted-foreground">Blocked work items across bids.</p>
            <Separator className="my-3" />

            <div className="space-y-2">
              {topBlockedItems.length ? (
                topBlockedItems.map((w: any) => (
                  <div key={`${w.job_id}:${w.type}:${w.ref_key}`} className="rounded-xl border bg-background/60 p-3">
                    <Link className="text-sm font-medium hover:underline" href={`/app/jobs/${w.job_id}`}>
                      {w.title || `${w.type} item`}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{w.owner} • {w.ageDays !== null ? `${w.ageDays}d blocked` : "blocked"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full">Blocked</Badge>
                      <Badge variant="outline" className="rounded-full">{String(w.type)}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No blocked items 🎉</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA instead of duplicate job list */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Navigate bids</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The full bid list lives in Jobs. Use the filters above to focus the dashboard.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/app/jobs">Go to Jobs</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
