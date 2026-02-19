"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/browser";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type WorkItem = {
  id?: string;
  job_id: string;
  type: string;
  ref_key: string;
  title: string;
  status: string;
  owner_label?: string | null;
  due_at?: string | null;
  notes?: string | null;
};

function toDateOnly(x: string | null | undefined) {
  if (!x) return null;
  return String(x).slice(0, 10);
}

export default function GlobalBidRoomPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [jobsById, setJobsById] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: jobs, error: jobsErr } = await supabase
          .from("jobs")
          .select("id,file_name,status,created_at")
          .order("created_at", { ascending: false })
          .limit(250);
        if (cancelled) return;
        if (jobsErr) throw jobsErr;

        const jobIds = (jobs ?? []).map((j: any) => String(j.id));
        const map = new Map<string, any>();
        for (const j of jobs ?? []) map.set(String((j as any).id), j);
        setJobsById(map);

        if (jobIds.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        const { data: wi, error: wiErr } = await supabase
          .from("job_work_items")
          .select("*")
          .in("job_id", jobIds)
          .neq("status", "done")
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("updated_at", { ascending: false });
        if (cancelled) return;
        if (wiErr) throw wiErr;

        setItems((wi as any[]) ?? []);
      } catch (e) {
        console.error(e);
        setError("Could not load the global bid room.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const ownerQ = ownerFilter.trim().toLowerCase();
    const statusQ = statusFilter.trim().toLowerCase();
    return items.filter((x) => {
      if (ownerQ && !String(x.owner_label ?? "").toLowerCase().includes(ownerQ)) return false;
      if (statusQ && String(x.status ?? "").toLowerCase() !== statusQ) return false;
      return true;
    });
  }, [items, ownerFilter, statusFilter]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const groups = useMemo(() => {
    const g: Record<string, WorkItem[]> = { blocked: [], overdue: [], dueSoon: [], todo: [] };
    for (const it of filtered) {
      const st = String(it.status ?? "todo");
      const due = it.due_at ? new Date(String(it.due_at)) : null;
      if (st === "blocked") g.blocked.push(it);
      else if (due && due < today) g.overdue.push(it);
      else if (due && due <= in7) g.dueSoon.push(it);
      else g.todo.push(it);
    }
    return g;
  }, [filtered, today, in7]);

  function Section(props: { title: string; items: WorkItem[] }) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{props.title}</p>
            <Badge variant="outline" className="rounded-full">
              {props.items.length}
            </Badge>
          </div>
          <Separator />
          {props.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items.</p>
          ) : (
            <div className="space-y-2">
              {props.items.map((it) => {
                const job = jobsById.get(String(it.job_id));
                return (
                  <div key={`${it.job_id}:${it.type}:${it.ref_key}`} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">{it.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">{it.type}</span> • {it.status}
                          {it.owner_label ? <span> • {it.owner_label}</span> : null}
                          {it.due_at ? <span> • due {toDateOnly(it.due_at)}</span> : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline" className="rounded-full">
                          <Link href={`/app/jobs/${it.job_id}`}>Job</Link>
                        </Button>
                        <Button asChild size="sm" className="rounded-full">
                          <Link href={`/app/jobs/${it.job_id}/bid-room`}>Bid room</Link>
                        </Button>
                      </div>
                    </div>
                    {job?.file_name ? (
                      <p className="mt-2 text-xs text-muted-foreground">{String(job.file_name)}</p>
                    ) : null}
                    {it.notes ? <p className="mt-2 text-xs text-muted-foreground break-words">{String(it.notes)}</p> : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Global bid room</p>
          <p className="mt-1 text-sm text-muted-foreground">One place to manage all open work items across jobs you can access.</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/app/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} placeholder="Filter by owner" className="max-w-[220px]" />
            <Input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Filter by status (todo/doing/blocked)" className="max-w-[260px]" />
            <Badge variant="outline" className="rounded-full">
              Open items: {filtered.length}
            </Badge>
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Blocked" items={groups.blocked} />
        <Section title="Overdue" items={groups.overdue} />
        <Section title="Due soon (7 days)" items={groups.dueSoon} />
        <Section title="To do" items={groups.todo} />
      </div>
    </div>
  );
}
