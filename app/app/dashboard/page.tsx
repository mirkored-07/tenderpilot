"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, RefreshCw } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { isBlockedWorkStatus, isDoneWorkStatus as isCanonicalDoneWorkStatus } from "@/lib/bid-workflow/work-status";
import { getJobDisplayName } from "@/lib/pilot-job-names";
import { useAppI18n } from "../_components/app-i18n-provider";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { AttentionBidsCard } from "./_components/attention-bids-card";
import { HoldUnblockCard } from "./_components/hold-unblock-card";
import { DashboardFilters } from "./_components/dashboard-filters";

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
  target_decision_at: string | null;
  updated_at: string;
};

const FILTER_ALL = "__all__";
const FILTER_UNASSIGNED = "__unassigned__";

function DecisionBadge({ raw }: { raw: string }) {
  const { t } = useAppI18n();
  const b = decisionBucket(raw);
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

  // Treat sentinel UI values as "no override"
  if (!t) return true;
  if (t === "extracted") return true;
  if (t.includes("use extracted")) return true;
  if (t.includes("extracted decision")) return true;
  if (t.startsWith("(") && t.includes("extracted")) return true;

  return false;
}

function decisionBucket(raw: string): "go" | "hold" | "no-go" | "unknown" {
  const t = normalizeDecisionText(raw);

  // Order matters: check no-go first so "go/no-go" doesn't classify as "go"
  const isNoGo =
    /\b(no[-\s]?go|nogo|do\s+not\s+(bid|proceed|submit)|not\s+(bid|proceed|submit)|reject|decline|withdraw)\b/.test(t);
  if (isNoGo) return "no-go";

  // Treat "Proceed with caution" as Hold (caution state)
  const isHold =
  /\b(hold|caution|clarif(y|ication)|verify|pending|tbd|conditional|depends|review)\b/.test(t) ||
  t.includes("proceed with caution");
if (isHold) return "hold";



  const isGo = /\b(go|proceed|bid|submit)\b/.test(t);
  if (isGo) return "go";

  return "unknown";
}

function isDoneStatus(s?: string | null) {
  return isCanonicalDoneWorkStatus(s);
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

  const classes = [
    // Semantic, premium palette: positive (teal/cyan), caution (amber), risk (rose), neutral (slate)
    "text-teal-600/85 dark:text-teal-400/85",
    "text-amber-500/85 dark:text-amber-400/85",
    "text-rose-600/85 dark:text-rose-400/85",
    "text-slate-600/45 dark:text-slate-400/45",
    "text-cyan-500/70 dark:text-cyan-400/70",
  ];
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
  const { t } = useAppI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [jobResults, setJobResults] = useState<Record<string, DbJobResult>>({});
  const [jobMeta, setJobMeta] = useState<Record<string, DbJobMetadata>>({});
  const [workItems, setWorkItems] = useState<DbWorkItem[]>([]);

  const [ownerFilter, setOwnerFilter] = useState<string>(FILTER_ALL);
  const [decisionFilter, setDecisionFilter] = useState<string>(FILTER_ALL);
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
    holdUnblock: false,
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
        .select("job_id,deadline_override,target_decision_at,portal_url,internal_bid_id,owner_label,decision_override,updated_at")
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
      setError(e?.message || t("app.dashboard.errors.failedToLoad"));
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

     const extractedDecisionTextRaw = String(
		  exec?.decisionBadge ?? exec?.decision ?? exec?.verdict ?? ""
		).trim();

		// Keep dashboard consistent with Job page: if AI did not provide a decision badge,
		// the UI defaults to "Proceed with caution" (caution state), not "missing".
		const extractedDecisionText = extractedDecisionTextRaw || "Hold";



	const overrideRaw = meta?.decision_override;
	const decisionText = isUseExtractedDecisionOverride(overrideRaw)
	  ? extractedDecisionText
	  : String(overrideRaw ?? "").trim();

	const bucket = decisionBucket(decisionText);


      const deadlineText = meta?.deadline_override ? String(meta.deadline_override) : extractedDeadlineText;
      const decisionLabel =
        bucket === "go"
          ? t("app.decision.go")
          : bucket === "hold"
            ? t("app.decision.hold")
            : bucket === "no-go"
              ? t("app.decision.noGo")
              : "";

      const dueSoon = hasValidDeadline ? daysUntil(deadline as Date, now) : null;
      const missingDeadline = !hasValidDeadline;

      const missingDecision = bucket === "unknown";

      const items = byJob[job.id] ?? [];
      const blocked = items.filter((w) => isBlockedWorkStatus(w?.status)).length;
      const done = items.filter((w) => isDoneStatus(w?.status)).length;
      const total = items.length;

      const displayName = job.file_name ? job.file_name : getJobDisplayName(job.id);

      return {
        job,
        displayName,
        decisionText,
        decisionLabel,
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
  const workloadByOwner = useMemo(() => {
    const m = new Map<string, { total: number; blocked: number; overdue: number }>();
    const now = new Date();

    for (const wi of workItems ?? []) {
      const owner = String(wi.owner_label ?? "").trim() || FILTER_UNASSIGNED;
      const row = m.get(owner) || { total: 0, blocked: 0, overdue: 0 };
      row.total += 1;
      if (isBlockedWorkStatus(wi.status)) row.blocked += 1;
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
    return [FILTER_ALL, ...Array.from(set).filter(Boolean)];
  }, [workloadByOwner, jobs, jobMeta]);

  const filteredRows = useMemo(() => {
    return dashboardRows.filter((r) => {
      if (decisionFilter !== FILTER_ALL && r.decisionBucket !== decisionFilter) return false;
      if (ownerFilter === FILTER_ALL) return true;

      const items = workItems.filter((w) => String(w.job_id) === r.job.id);
      const hasOwner = items.some((w) => (String(w.owner_label ?? "").trim() || FILTER_UNASSIGNED) === ownerFilter);

      const metaOwner = String(jobMeta[r.job.id]?.owner_label ?? "").trim();
      const hasMetaOwner = metaOwner && metaOwner === ownerFilter;

      return hasOwner || hasMetaOwner;
    });
  }, [dashboardRows, workItems, decisionFilter, ownerFilter, jobMeta]);


  const kpiTotals = useMemo(() => {
    const missingDeadline = filteredRows.filter((r) => r.missingDeadline).length;
    const missingDecision = filteredRows.filter((r) => r.missingDecision).length;
    const blockedItems = filteredRows.reduce((s, r) => s + r.blocked, 0);
    const totalWork = filteredRows.reduce((s, r) => s + r.total, 0);
    const doneWork = filteredRows.reduce((s, r) => s + r.done, 0);
    return { missingDeadline, missingDecision, blockedItems, totalWork, doneWork };
  }, [filteredRows]);

  const kpiDecisionBuckets = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) m.set(r.decisionBucket, (m.get(r.decisionBucket) || 0) + 1);
    return m;
  }, [filteredRows]);

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
      .filter((wi) => isBlockedWorkStatus(wi.status))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    const unassignedItems = visibleWorkItems
      .filter((wi) => !isDoneStatus(wi.status))
      .filter((wi) => !String(wi.owner_label ?? "").trim())
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    const clarificationsPending = visibleWorkItems
      .filter((wi) => String(wi.type ?? "").toLowerCase() === "clarification")
      .filter((wi) => !isDoneStatus(wi.status))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    
    const holdUnblock = (filteredRows ?? [])
      .filter((r) => String(r?.decisionBucket ?? "").toLowerCase() === "hold")
      .map((r) => {
        const jid = String(r.job.id);
        const openUnblock = (itemsByJob[jid] ?? [])
          .filter((wi) => {
            const t = String(wi.type ?? "").toLowerCase();
            return t === "requirement" || t === "clarification";
          })
          .filter((wi) => !isDoneStatus(wi.status));
        return { row: r, jobId: jid, openCount: openUnblock.length };
      })
      .filter((x) => x.openCount > 0)
      .sort((a, b) => b.openCount - a.openCount)
      .map((x) => x.row);
return {
      needsTriage,
      deadlineUnknown,
      dueNext7,
      overdueWorkItems,
      blockedItems,
      unassignedItems,
      clarificationsPending,
      holdUnblock,
      jobOwnerLabel,
    };
  }, [filteredRows, workItems, jobMeta]);

  const deadlineHistogram = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: t("app.dashboard.kpi.chart.overdue"), value: 0 },
      { label: t("app.dashboard.kpi.chart.next7"), value: 0 },
      { label: t("app.dashboard.kpi.chart.next30"), value: 0 },
      { label: t("app.dashboard.kpi.chart.next90"), value: 0 },
      { label: t("app.common.unknown"), value: 0 },
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
      .filter((w) => isBlockedWorkStatus(w?.status))
      .map((w) => ({
        ...w,
        displayOwner: String(w.owner_label ?? "").trim() || "",
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("app.dashboard.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.common.loading")}…</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={loadAll}>
            {t("app.common.refresh")}
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.dashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.dashboard.subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="rounded-full">
            <Link href="/app/upload">{t("app.nav.newReview")}</Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-full sm:inline-flex"
            onClick={loadAll}
            aria-label={t("app.common.refresh")}
            title={t("app.common.refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label={t("app.dashboard.menu.ariaLabel")}
                title={t("app.nav.menu")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/app/jobs">{t("app.dashboard.menu.openTenders")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/bid-room">{t("app.dashboard.menu.openBidRoom")}</Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuRadioGroup
                value={standupMode ? "focused" : "full"}
                onValueChange={(v) => setStandupMode(v === "focused")}
              >
                <DropdownMenuRadioItem value="focused">{t("app.dashboard.menu.focusedView")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="full">{t("app.dashboard.menu.fullView")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  loadAll();
                }}
              >{t("app.common.refresh")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error ? (

        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-red-700">{t("app.dashboard.errors.title")}</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">{t("app.dashboard.kpi.portfolioTitle")}</p>

            {(() => {
              const total = filteredRows.length;
              const missDecision = kpiTotals.missingDecision;
              const missDeadline = kpiTotals.missingDeadline;

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
                        { label: t("app.dashboard.kpi.chart.ready"), value: ready },
                        { label: t("app.dashboard.kpi.chart.missingDecision"), value: decisionOnly },
                        { label: t("app.dashboard.kpi.chart.missingDeadline"), value: deadlineOnly },
                        { label: t("app.dashboard.kpi.chart.missingBoth"), value: bothMissing },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("app.dashboard.kpi.basicsPresent")}</p>
                      <p className="text-2xl font-semibold leading-none">{basicsPct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("app.dashboard.kpi.readyMissing", { ready, missing: total - ready })}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{t("app.dashboard.kpi.aiExtractionHint")}</p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("app.dashboard.kpi.portfolioBreakdown", { ready, missingDecision: missDecision, missingDeadline: missDeadline })}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">{t("app.dashboard.kpi.deadlinesTitle")}</p>

            {(() => {
              const overdue = deadlineHistogram[0]?.value || 0;
              const next7 = deadlineHistogram[1]?.value || 0;
              const next30 = deadlineHistogram[2]?.value || 0;
              const next90 = deadlineHistogram[3]?.value || 0;
              const unknown = deadlineHistogram[4]?.value || 0;

              const total = overdue + next7 + next30 + next90 + unknown;
              const urgent = overdue + next7;
              const urgentPct = total > 0 ? Math.round((urgent / total) * 100) : 0;

              return (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <DonutChart
                      parts={[
                        { label: t("app.dashboard.kpi.chart.overdue"), value: overdue },
                        { label: t("app.dashboard.kpi.chart.next7"), value: next7 },
                        { label: t("app.dashboard.kpi.chart.next30"), value: next30 },
                        { label: t("app.dashboard.kpi.chart.next90"), value: next90 },
                        { label: t("app.common.unknown"), value: unknown },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("app.dashboard.kpi.percentUrgent")}</p>
                      <p className="text-2xl font-semibold leading-none">{urgentPct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("app.dashboard.kpi.urgentUnknown", { urgent, unknown })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <SegmentedBar parts={deadlineHistogram} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("app.dashboard.kpi.deadlineBreakdownBase", { overdue, next7, next30, next90 })}
                      {unknown ? ` • ${t("app.common.unknown")} ${unknown}` : ""}
                    </p>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">{t("app.dashboard.kpi.executionTitle")}</p>

            {(() => {
              const total = kpiTotals.totalWork;
              const done = kpiTotals.doneWork;
              const blocked = kpiTotals.blockedItems;
              const open = Math.max(0, total - done);
              const openNonBlocked = Math.max(0, open - blocked);

              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <DonutChart
                      parts={[
                        { label: t("app.dashboard.kpi.chart.done"), value: done },
                        { label: t("app.dashboard.kpi.chart.blocked"), value: blocked },
                        { label: t("app.dashboard.kpi.chart.open"), value: openNonBlocked },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("app.dashboard.kpi.percentDone")}</p>
                      <p className="text-2xl font-semibold leading-none">{pct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("app.dashboard.kpi.doneOpen", { done, open })}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{t("app.dashboard.kpi.basedOnWorkItems")}</p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("app.dashboard.kpi.executionBreakdown", { done, open, blocked })}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">{t("app.dashboard.kpi.decisionsTitle")}</p>

            {(() => {
              const go = kpiDecisionBuckets.get("go") || 0;
              const hold = kpiDecisionBuckets.get("hold") || 0;
              const nogo = kpiDecisionBuckets.get("no-go") || 0;
              const unknown = kpiDecisionBuckets.get("unknown") || 0;

              const decided = go + hold + nogo;
              const total = decided + unknown;
              const pct = total > 0 ? Math.round((decided / total) * 100) : 0;

              return (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <DonutChart
                      parts={[
                        { label: t("app.decision.go"), value: go },
                        { label: t("app.decision.hold"), value: hold },
                        { label: t("app.decision.noGo"), value: nogo },
                        { label: t("app.common.unknown"), value: unknown },
                      ]}
                      size={72}
                      strokeWidth={10}
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("app.dashboard.kpi.percentDecided")}</p>
                      <p className="text-2xl font-semibold leading-none">{pct}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("app.dashboard.kpi.decidedUnknown", { decided, unknown })}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{t("app.dashboard.kpi.aiSuggestionHint")}</p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("app.dashboard.kpi.decisionsBreakdown", { go, hold, noGo: nogo, missing: kpiTotals.missingDecision })}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <DashboardFilters
        t={t}
        owners={owners}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        decisionFilter={decisionFilter}
        onDecisionFilterChange={setDecisionFilter}
        windowDays={windowDays}
        onWindowDaysChange={setWindowDays}
        filterAllValue={FILTER_ALL}
        filterUnassignedValue={FILTER_UNASSIGNED}
      />

      {/* Operational queues */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("app.dashboard.queues.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("app.dashboard.queues.subtitle")}
              </p>
            </div>

            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setOpenSections((s) => ({ ...s, standup: !s.standup }))}
            >
              {openSections.standup ? t("app.common.collapse") : t("app.common.expand")}
            </button>
          </div>

          {openSections.standup ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {/* Needs triage */}
            <div className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{t("app.dashboard.sections.needsTriage")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.needsTriage.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.needsTriage.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noNeedsTriage")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.needsTriage;
                    const rows = expanded ? standupQueues.needsTriage : standupQueues.needsTriage.slice(0, 6);
                    return (
                      <>
                        {rows.map((r) => (
                          <div key={r.job.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${r.job.id}`}>
                              {r.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">{t("app.dashboard.filters.owner")}: {t("app.common.unknown")}</span>
                          </div>
                        ))}
                        {standupQueues.needsTriage.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, needsTriage: !s.needsTriage }))}
                          >
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.needsTriage.length })}
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{t("app.dashboard.sections.deadlineUnknown")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.deadlineUnknown.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.deadlineUnknown.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.allHaveDeadline")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.deadlineUnknown;
                    const rows = expanded ? standupQueues.deadlineUnknown : standupQueues.deadlineUnknown.slice(0, 6);
                    return (
                      <>
                        {rows.map((r) => (
                          <div key={r.job.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${r.job.id}`}>
                              {r.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">{t("app.dashboard.actions.addOverride")}</span>
                          </div>
                        ))}
                        {standupQueues.deadlineUnknown.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, deadlineUnknown: !s.deadlineUnknown }))}
                          >
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.deadlineUnknown.length })}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* {t("app.dashboard.sections.dueNext7Title")} */}
            <div className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{t("app.dashboard.sections.dueNext7Title")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.dueNext7.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.dueNext7.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noDueNext7")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.dueNext7;
                    const rows = expanded ? standupQueues.dueNext7 : standupQueues.dueNext7.slice(0, 6);
                    return (
                      <>
                        {rows.map((r) => (
                          <div key={r.job.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
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
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.dueNext7.length })}
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{t("app.dashboard.sections.overdueWorkItems")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.overdueWorkItems.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.overdueWorkItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noOverdueWorkItems")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.overdueWorkItems;
                    const rows = expanded
                      ? standupQueues.overdueWorkItems
                      : standupQueues.overdueWorkItems.slice(0, 6);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || t("app.dashboard.labels.workItem"))}
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
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.overdueWorkItems.length })}
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{t("app.dashboard.sections.blockedItems")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.blockedItems.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.blockedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noBlockedItems")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.blockedItems;
                    const rows = expanded ? standupQueues.blockedItems : standupQueues.blockedItems.slice(0, 6);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || t("app.dashboard.labels.workItem"))}
                            </Link>
                            <span className="text-xs text-muted-foreground">{wi.owner_label ? String(wi.owner_label) : t("app.dashboard.labels.unassigned")}</span>
                          </div>
                        ))}
                        {standupQueues.blockedItems.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, blockedItems: !s.blockedItems }))}
                          >
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.blockedItems.length })}
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{t("app.dashboard.sections.unassignedItems")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.unassignedItems.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.unassignedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noUnassignedItems")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.unassignedItems;
                    const rows = expanded ? standupQueues.unassignedItems : standupQueues.unassignedItems.slice(0, 6);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || t("app.dashboard.labels.workItem"))}
                            </Link>
                            <span className="text-xs text-muted-foreground">{t("app.dashboard.filters.owner")}: {t("app.common.unknown")}</span>
                          </div>
                        ))}
                        {standupQueues.unassignedItems.length > 6 ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setQueueExpand((s) => ({ ...s, unassignedItems: !s.unassignedItems }))}
                          >
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.unassignedItems.length })}
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
                <p className="text-sm font-medium">{t("app.dashboard.sections.clarificationsPending")}</p>
                <span className="text-xs text-muted-foreground">{standupQueues.clarificationsPending.length}</span>
              </div>
              <div className="mt-2 space-y-1">
                {standupQueues.clarificationsPending.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noOpenClarifications")}</p>
                ) : (
                  (() => {
                    const expanded = !!queueExpand.clarificationsPending;
                    const rows = expanded
                      ? standupQueues.clarificationsPending
                      : standupQueues.clarificationsPending.slice(0, 8);
                    return (
                      <>
                        {rows.map((wi) => (
                          <div key={`${wi.job_id}:${wi.type}:${wi.ref_key}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <Link className="text-sm underline-offset-2 hover:underline" href={`/app/jobs/${wi.job_id}`}>
                              {String(wi.title || wi.ref_key || t("app.dashboard.labels.clarification"))}
                            </Link>
                            <span className="text-xs text-muted-foreground">{wi.owner_label ? String(wi.owner_label) : t("app.dashboard.labels.unassigned")}</span>
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
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: standupQueues.clarificationsPending.length })}
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">{t("app.dashboard.badges.needsTriage")} {standupQueues.needsTriage.length}</Badge>
              <Badge variant="outline" className="rounded-full">{t("app.dashboard.badges.deadlineUnknown")} {standupQueues.deadlineUnknown.length}</Badge>
              <Badge variant="outline" className="rounded-full">{t("app.dashboard.badges.dueNext7")} {standupQueues.dueNext7.length}</Badge>
              <Badge variant="outline" className="rounded-full">{t("app.dashboard.badges.overdueItems")} {standupQueues.overdueWorkItems.length}</Badge>
              <Badge variant="outline" className="rounded-full">{t("app.dashboard.badges.blocked")} {standupQueues.blockedItems.length}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

              <HoldUnblockCard
                t={t}
                rows={standupQueues.holdUnblock}
                expanded={!!queueExpand.holdUnblock}
                onToggleExpanded={() => setQueueExpand((s) => ({ ...s, holdUnblock: !s.holdUnblock }))}
                workItems={workItems}
                jobMeta={jobMeta as Record<string, any>}
                isDoneStatus={isDoneStatus}
              />


      {/* {t("app.dashboard.attention.title")} (Top 8 when collapsed) */}
      <AttentionBidsCard
        t={t}
        bids={attentionBids}
        expanded={openSections.attention}
        onToggleExpanded={() => setOpenSections((s) => ({ ...s, attention: !s.attention }))}
        renderDecisionBadge={(raw) => <DecisionBadge raw={raw} />}
      />

      {/* {t("app.dashboard.analytics.title")} (collapsed by default; hidden in standup mode) */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("app.dashboard.analytics.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("app.dashboard.analytics.subtitle")}</p>
            </div>

            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setOpenSections((s) => ({ ...s, analytics: !s.analytics }))}
              disabled={standupMode}
              title={standupMode ? t("app.dashboard.analytics.hiddenInStandup") : t("app.dashboard.analytics.toggleTitle")}
            >
              {standupMode ? t("app.dashboard.analytics.hiddenLabel") : openSections.analytics ? t("app.common.collapse") : t("app.common.expand")}
            </button>
          </div>

          {standupMode ? (
            <p className="mt-3 text-xs text-muted-foreground">{t("app.dashboard.analytics.hiddenInStandup")}</p>
          ) : openSections.analytics ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{t("app.dashboard.kpi.deadlinesTitle")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("app.dashboard.analytics.deadlinesSubtitle")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("app.dashboard.analytics.bidsCount", { count: filteredRows.length })}</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <SegmentedBar parts={deadlineHistogram} />
                    <p className="text-xs text-muted-foreground">
                      {t("app.dashboard.analytics.deadlineBreakdown", { overdue: deadlineHistogram[0].value, next7: deadlineHistogram[1].value, next30: deadlineHistogram[2].value, next90: deadlineHistogram[3].value, unknown: deadlineHistogram[4].value })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{t("app.dashboard.analytics.workloadByOwner")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("app.dashboard.analytics.workloadSubtitle")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("app.dashboard.analytics.ownersCount", { count: workloadByOwner.length })}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {workloadByOwner.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("app.dashboard.analytics.noWorkItemsYet")}</p>
                    ) : (
                      workloadByOwner.slice(0, 7).map(([owner, stats]) => (
                        <div key={owner} className="flex items-center justify-between">
                          <p className="text-sm">{owner}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("app.dashboard.analytics.ownerRow", { total: stats.total, blocked: stats.blocked, overdue: stats.overdue })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{t("app.dashboard.analytics.expandHint")}</p>
          )}
        </CardContent>
      </Card>

      {/* {t("app.dashboard.blockers.title")} (collapsible; hidden in standup mode) */}
      {!standupMode ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("app.dashboard.blockers.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("app.dashboard.blockers.subtitle")}</p>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setOpenSections((s) => ({ ...s, blockers: !s.blockers }))}
                disabled={topBlockedItems.length === 0}
                title={topBlockedItems.length === 0 ? t("app.dashboard.blockers.noneTitle") : t("app.dashboard.analytics.toggleTitle")}
              >
                {topBlockedItems.length === 0 ? t("app.dashboard.blockers.noneLabel") : openSections.blockers ? t("app.common.collapse") : t("app.common.expand")}
              </button>
            </div>

            <Separator className="my-3" />

            {openSections.blockers ? (
              <div className="space-y-2">
                {topBlockedItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noBlockedItems")}</p>
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
                          {String(w.displayOwner || t("app.dashboard.labels.unassigned"))}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {t("app.bidroom.status.blocked")}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("app.common.collapsed")}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* {t("app.dashboard.bids.title")} (collapsible; hidden in standup mode; Top 10 by default) */}
      {!standupMode ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("app.dashboard.bids.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("app.dashboard.bids.subtitle")}</p>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setOpenSections((s) => ({ ...s, bids: !s.bids }))}
              >
                {openSections.bids ? t("app.common.collapse") : t("app.common.expand")}
              </button>
            </div>

            <Separator className="my-3" />

            {openSections.bids ? (
              <div className="space-y-2">
                {visibleRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("app.dashboard.empty.noMatchingBids")}</p>
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
                                {r.missingDecision ? t("app.dashboard.labels.decisionMissing") : r.decisionLabel || t("app.dashboard.labels.decisionUnknown")}
                                {" • "}
                                {r.missingDeadline ? t("app.dashboard.labels.deadlineMissing") : r.deadlineText || t("app.dashboard.labels.deadlineUnknown")}
                                {" • "}
                                {r.total > 0 ? t("app.dashboard.labels.itemsDone", { done: r.done, total: r.total }) : t("app.dashboard.labels.noWorkItems")}
                                {r.blocked > 0 ? ` • ${t("app.dashboard.labels.blockedCount", { count: r.blocked })}` : ""}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <DecisionBadge raw={r.decisionText} />
                              {r.dueSoon !== null ? (
                                <Badge variant={r.dueSoon < 0 ? "destructive" : "outline"} className="rounded-full">
                                  {r.dueSoon < 0 ? t("app.dashboard.labels.daysOverdue", { count: Math.abs(r.dueSoon) }) : t("app.dashboard.labels.daysRemaining", { count: r.dueSoon })}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">
                                  {t("app.dashboard.labels.noDeadline")}
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
                            {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: visibleRows.length })}
                          </button>
                        ) : null}
                      </>
                    );
                  })()
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("app.common.collapsed")}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("app.dashboard.attention.quickTip")}
      </p>
    </div>
  );
}
