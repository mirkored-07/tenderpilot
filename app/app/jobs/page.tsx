"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

import { supabaseBrowser } from "@/lib/supabase/browser";
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

function previewText(status: JobStatus) {
  if (status === "done") return "Results ready for review";
  if (status === "failed") return "Analysis could not be completed";
  return "Analysis in progress";
}

export default function JobsPage() {
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // PATCH: delete UX
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      setLoadError(null);
      setActionError(null);

      const supabase = supabaseBrowser();

      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id,user_id,file_name,file_path,source_type,status,credits_used,created_at,updated_at"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load jobs", error);
        setLoadError("Your jobs could not be loaded. Please refresh the page.");
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

  async function handleDelete(job: DbJob) {
    const ok = window.confirm(
      `Delete "${job.file_name}"?\n\nThis will remove the job and its results. This cannot be undone.`
    );
    if (!ok) return;

    setActionError(null);
    setDeletingJobId(job.id);

    try {
      const supabase = supabaseBrowser();

      // Best-effort cascading deletes (no schema / backend changes)
      const r1 = await supabase.from("job_results").delete().eq("job_id", job.id);
      if (r1.error) throw r1.error;

      const r2 = await supabase.from("job_events").delete().eq("job_id", job.id);
      if (r2.error) throw r2.error;

      const r3 = await supabase.from("jobs").delete().eq("id", job.id);
      if (r3.error) throw r3.error;

      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      track("job_deleted", { job_id: job.id, source: "jobs_list" });
    } catch (e) {
      console.error("Delete failed", e);
      setActionError("Could not delete this job. Please try again.");
    } finally {
      setDeletingJobId(null);
    }
  }

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
            All bid kits you generated. Open a job to review requirements, risks,
            and drafts.
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
              {["all", "queued", "processing", "done", "failed"].map((f) => (
                <DropdownMenuItem
                  key={f}
                  onClick={() => {
                    setFilter(f as any);
                    track("jobs_filter_changed", { filter: f });
                  }}
                >
                  {f === "all"
                    ? "All"
                    : f === "done"
                    ? "Ready"
                    : f.charAt(0).toUpperCase() + f.slice(1)}
                </DropdownMenuItem>
              ))}
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
              ? "Loading jobs from your workspace."
              : loadError
              ? "We could not load your jobs."
              : "Your recent bid reviews appear here."}
          </p>
          {loadError ? (
            <p className="mt-2 text-xs text-destructive">{loadError}</p>
          ) : null}
          {actionError ? (
            <p className="mt-2 text-xs text-destructive">{actionError}</p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">Loading</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fetching your bid reviews.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">No bid reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload your first tender document to generate a bid kit.
              </p>
              <Button asChild className="mt-4 rounded-full">
                <Link href="/app/upload">Create your first bid review</Link>
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
                  {/* Header row */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {/* LEFT */}
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {job.file_name}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {statusBadge(job.status)}
                        </span>
                        <span>Created: {formatDate(job.created_at)}</span>
                        <span>Credits: {job.credits_used}</span>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/app/jobs/${job.id}`);
                        }}
                      >
                        Open
                      </Button>

                      {/* PATCH: actions menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="rounded-full px-3"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            aria-label="Job actions"
                            title="Actions"
                            disabled={deletingJobId === job.id}
                          >
                            ···
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDelete(job);
                            }}
                          >
                            {deletingJobId === job.id ? "Deleting…" : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="text-xs text-muted-foreground group-hover:text-foreground">
                        {previewText(job.status)} →
                      </div>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Preview cards */}
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">
                        Requirements
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        Checklist prepared
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Draft</div>
                      <div className="mt-1 text-sm font-medium">
                        Proposal sections
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Risks</div>
                      <div className="mt-1 text-sm font-medium">
                        Gaps and clarifications
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
