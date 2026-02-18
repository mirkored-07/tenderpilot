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

function parseDeadlineToDateLocal(input: string): Date | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  // Common format: "15:00 28/05/2014" or "28/05/2014"
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

  const d2 = new Date(s);
  return Number.isFinite(d2.getTime()) ? d2 : null;
}

function verdictBadge(label: string) {
  const t = String(label ?? "").toLowerCase();
  if (t.includes("no") || t.includes("do not") || t.includes("reject")) return <Badge variant="destructive" className="rounded-full">No-Go</Badge>;
  if (t.includes("hold") || t.includes("caution") || t.includes("verify")) return <Badge variant="secondary" className="rounded-full">Hold</Badge>;
  if (t.includes("go") || t.includes("proceed")) return <Badge className="rounded-full">Go</Badge>;
  return <Badge variant="outline" className="rounded-full">—</Badge>;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [jobResults, setJobResults] = useState<Record<string, any>>({});
  const [workItems, setWorkItems] = useState<any[]>([]);

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
      .select("job_id,type,status,owner_label")
      .in("job_id", ids);
    setWorkItems((workData as any[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const dashboardRows = useMemo(() => {
    const now = new Date();
    const byJob: Record<string, any[]> = {};
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
      const decision = String(exec?.decisionBadge ?? "").trim();

      const w = byJob[j.id] ?? [];
      const total = w.length;
      const done = w.filter((x) => String(x?.status ?? "") === "done").length;
      const blocked = w.filter((x) => String(x?.status ?? "") === "blocked").length;
      const openClar = w.filter((x) => String(x?.type ?? "") === "clarification" && String(x?.status ?? "") !== "done").length;
      const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

      const dueSoon = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (24 * 3600 * 1000)) : null;

      return {
        job: j,
        decision,
        deadlineText,
        deadline,
        dueSoon,
        progressPct,
        total,
        done,
        blocked,
        openClar,
      };
    });
  }, [jobs, jobResults, workItems]);

  const dueSoonRows = useMemo(() => {
    return dashboardRows
      .filter((r) => r.deadline)
      .sort((a, b) => (a.deadline!.getTime() - b.deadline!.getTime()));
  }, [dashboardRows]);

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

  if (loading) {
    return <div className="mx-auto max-w-6xl py-10 text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bid manager dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pipeline, deadlines, and workload.</p>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active bids</p>
            <p className="mt-1 text-2xl font-semibold">{jobs.filter((j) => j.status !== "failed").length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Due soon (≤ 7 days)</p>
            <p className="mt-1 text-2xl font-semibold">
              {dueSoonRows.filter((r) => typeof r.dueSoon === "number" && r.dueSoon <= 7 && r.dueSoon >= 0).length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Blocked items</p>
            <p className="mt-1 text-2xl font-semibold">{workItems.filter((w) => String(w?.status ?? "") === "blocked").length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Bids</p>
            <p className="mt-1 text-xs text-muted-foreground">Deadline, decision, and progress.</p>
            <Separator className="my-3" />

            <div className="space-y-2">
              {dashboardRows.map((r) => (
                <div key={r.job.id} className="flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-3">
                  <div className="min-w-0">
                    <Link
                      className="text-sm font-medium hover:underline"
                      href={`/app/jobs/${r.job.id}`}
                    >
                      {getJobDisplayName(r.job.id) || r.job.file_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.deadlineText ? `Deadline: ${r.deadlineText}` : "Deadline: —"} • Updated {formatDate(r.job.updated_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {verdictBadge(r.decision)}
                      <Badge variant="outline" className="rounded-full">Progress {r.progressPct}%</Badge>
                      {r.blocked > 0 ? <Badge variant="secondary" className="rounded-full">Blocked {r.blocked}</Badge> : null}
                      {r.openClar > 0 ? <Badge variant="outline" className="rounded-full">Clarifications {r.openClar}</Badge> : null}
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
                    ) : (
                      <Badge variant="outline" className="rounded-full">—</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Workload by owner</p>
            <p className="mt-1 text-xs text-muted-foreground">Counts by status across all bids.</p>
            <Separator className="my-3" />

            <div className="space-y-2">
              {workloadByOwner.length ? (
                workloadByOwner.map(([owner, c]) => (
                  <div key={owner} className="flex items-center justify-between rounded-xl border bg-background/60 p-3">
                    <p className="text-sm font-medium">{owner}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
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
    </div>
  );
}
