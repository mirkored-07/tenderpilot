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
import { supabaseBrowser } from "@/lib/supabase/browser";

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
      <Badge variant="outline" className="rounded-full">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your bid kits. Open one to review requirements, risks, clarifications, and the draft.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full">
                Filter: {filter === "all" ? "All" : filter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter("all")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("queued")}>Queued</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("processing")}>Processing</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("done")}>Ready</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("failed")}>Failed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild className="rounded-full">
            <Link href="/app/new">New bid kit</Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Recent jobs</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading jobs…"
              : loadError
              ? "Could not load jobs. Check your session."
              : "Jobs loaded."}
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
                Fetching your bid kits.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm font-medium">No jobs found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first bid kit to see it here.
              </p>
              <Button asChild className="mt-4 rounded-full">
                <Link href="/app/new">Create a bid kit</Link>
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
                          {job.file_name}
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
                      <div className="text-xs text-muted-foreground">Requirements</div>
                      <div className="mt-1 text-sm font-medium">Checklist extracted</div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Draft</div>
                      <div className="mt-1 text-sm font-medium">Outline generated</div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Risks</div>
                      <div className="mt-1 text-sm font-medium">Gaps and ambiguities</div>
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
