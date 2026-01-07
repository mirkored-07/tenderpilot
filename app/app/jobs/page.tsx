"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// IMPORTANT: this must exist in your project
// lib/supabase/browser.ts  -> exports supabaseBrowser() that returns createClient(...)
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
  created_at: string; // ISO
  updated_at: string; // ISO
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

function statusBadge(status: JobStatus) {
  if (status === "done") return <Badge className="rounded-full">Ready</Badge>;
  if (status === "failed")
    return (
      <Badge variant="destructive" className="rounded-full">
        Failed
      </Badge>
    );
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

export default function JobsPage() {
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nameVersion, setNameVersion] = useState(0);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "tenderpilot_job_display_names_v1") {
        setNameVersion((v) => v + 1);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      setLoadError(null);

      const supabase = supabaseBrowser();

      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id,user_id,file_name,file_path,source_type,status,credits_used,created_at,updated_at"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        setJobs([]);
      } else {
        setJobs((data ?? []) as DbJob[]);
      }

      track("jobs_list_loaded", { count: (data ?? []).length });

      setLoading(false);
    }

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const filterLabel =
    filter === "all"
      ? "All"
      : filter === "done"
      ? "Ready"
      : filter === "queued"
      ? "Queued"
      : filter === "processing"
      ? "Processing"
      : "Failed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All Bid Kits you generated. Open a job to view Checklist, Draft, and
            Risks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full">
                Filter: {filterLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setFilter("all");
                  track("jobs_filter_changed", { filter: "all" });
                }}
              >
                All
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilter("queued");
                  track("jobs_filter_changed", { filter: "queued" });
                }}
              >
                Queued
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilter("processing");
                  track("jobs_filter_changed", { filter: "processing" });
                }}
              >
                Processing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilter("done");
                  track("jobs_filter_changed", { filter: "done" });
                }}
              >
                Ready
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setFilter("failed");
                  track("jobs_filter_changed", { filter: "failed" });
                }}
              >
                Failed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild className="rounded-full">
            <Link href="/app/upload">New bid review</Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Recent jobs</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading jobs from your workspace…"
              : loadError
              ? "Could not load jobs. Check your auth/session and RLS."
              : "Jobs loaded from Supabase."}
          </p>
          {loadError ? (
            <p className="mt-2 text-xs text-destructive">{loadError}</p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">Loading…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fetching your Bid Kits.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">No jobs found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate your first Bid Kit to see it here.
              </p>
              <Button asChild className="mt-4 rounded-full">
                <Link href="/app/upload">Create a bid review</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((job) => (
                <Link
                  key={job.id}
                  href={`/app/jobs/${job.id}`}
                  className={cn(
                    "group block rounded-2xl border bg-card/40 p-4 transition-colors",
                    "hover:bg-muted/40"
                  )}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium">
                          {getJobDisplayName(job.id) ?? job.file_name}
                        </div>
                        {statusBadge(job.status)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Created: {formatDate(job.created_at)}</span>
                        <span>Credits: {job.credits_used}</span>
                        <span className="hidden md:inline">
                          ID: <span className="font-mono">{job.id}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={(e) => e.preventDefault()}
                      >
                        Open
                      </Button>
                      <div className="text-xs text-muted-foreground group-hover:text-foreground">
                        View results →
                      </div>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">
                        Checklist
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        Requirements extracted
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">
                        Draft proposal
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        Sections generated
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Risks</div>
                      <div className="mt-1 text-sm font-medium">
                        Gaps and assumptions
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
