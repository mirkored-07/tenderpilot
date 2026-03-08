import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseRoute } from "@/lib/supabase/route";

export const runtime = "nodejs";

const JOB_LEASE_MS = Number(process.env.TP_JOB_LEASE_MS ?? 5 * 60 * 1000);
const HEARTBEAT_MS = Number(process.env.TP_JOB_HEARTBEAT_MS ?? 15 * 1000);
const STALE_PROCESSING_MS = Math.max(JOB_LEASE_MS, 60_000) + Math.max(HEARTBEAT_MS, 15_000);

type RetryRouteState = "queued_triggered" | "failed_requeued" | "stale_processing_requeued";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function secondsSinceUpdate(updatedAt: string | null | undefined): number | null {
  if (!updatedAt) return null;
  const ms = Date.parse(updatedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

async function triggerProcessJob(args: {
  supabaseUrl: string;
  serviceKey: string;
  cronSecret: string;
  jobId: string;
}) {
  try {
    const res = await fetch(`${args.supabaseUrl}/functions/v1/process-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.serviceKey}`,
        "x-tenderpilot-secret": args.cronSecret,
      },
      body: JSON.stringify({ job_id: args.jobId }),
    });

    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, response: text };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      response: String((error as Error)?.message ?? "trigger_failed"),
    };
  }
}

async function countRetryRequests(admin: ReturnType<typeof supabaseAdmin>, jobId: string, userId: string) {
  try {
    const { count } = await admin
      .from("job_events")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .eq("message", "Retry requested");

    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}

async function logRetryEvent(
  admin: ReturnType<typeof supabaseAdmin>,
  args: {
    jobId: string;
    userId: string;
    level: "info" | "warn" | "error";
    message: string;
    meta?: Record<string, unknown>;
  }
) {
  try {
    await admin.from("job_events").insert({
      job_id: args.jobId,
      user_id: args.userId,
      level: args.level,
      message: args.message,
      meta: args.meta ?? {},
    });
  } catch {
    // ignore
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;

  const supabase = supabaseRoute(req);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.TP_CRON_SECRET || process.env.TP_SECRET;
  if (!supabaseUrl || !serviceKey || !cronSecret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const admin = supabaseAdmin();

  const { data: jobRow, error: jobErr } = await admin
    .from("jobs")
    .select("id,user_id,status,file_name,updated_at")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) {
    return NextResponse.json({ error: "job_lookup_failed" }, { status: 500 });
  }
  if (!jobRow || (jobRow as any)?.user_id !== userRes.user.id) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const status = String((jobRow as any)?.status ?? "").toLowerCase();
  const updatedAt = String((jobRow as any)?.updated_at ?? "") || null;
  const ageSeconds = secondsSinceUpdate(updatedAt);
  const isStaleProcessing =
    status === "processing" && typeof ageSeconds === "number" && ageSeconds * 1000 >= STALE_PROCESSING_MS;

  if (status === "done") {
    return NextResponse.json({ error: "job_already_complete", status }, { status: 409 });
  }

  if (status === "processing" && !isStaleProcessing) {
    return NextResponse.json(
      { error: "job_still_processing", status, seconds_since_update: ageSeconds },
      { status: 409 }
    );
  }

  let routeState: RetryRouteState;
  let triggerMeta: Record<string, unknown> = { source: "ui" };

  if (status === "queued") {
    routeState = "queued_triggered";
    await logRetryEvent(admin, {
      jobId,
      userId: userRes.user.id,
      level: "info",
      message: "Manual processing trigger requested",
      meta: { source: "ui" },
    });
  } else {
    const retryCount = await countRetryRequests(admin, jobId, userRes.user.id);
    if (retryCount >= 2) {
      return NextResponse.json({ error: "retry_limit_reached" }, { status: 429 });
    }

    routeState = status === "failed" ? "failed_requeued" : "stale_processing_requeued";

    const { error: updErr } = await admin
      .from("jobs")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", userRes.user.id);

    if (updErr) {
      return NextResponse.json({ error: "retry_update_failed" }, { status: 500 });
    }

    triggerMeta =
      routeState === "stale_processing_requeued"
        ? { source: "ui", previous_status: status, seconds_since_update: ageSeconds }
        : { source: "ui", previous_status: status };

    await logRetryEvent(admin, {
      jobId,
      userId: userRes.user.id,
      level: routeState === "stale_processing_requeued" ? "warn" : "info",
      message: "Retry requested",
      meta: triggerMeta,
    });
  }

  const triggerResult = await triggerProcessJob({
    supabaseUrl,
    serviceKey,
    cronSecret,
    jobId,
  });

  if (!triggerResult.ok) {
    await logRetryEvent(admin, {
      jobId,
      userId: userRes.user.id,
      level: "warn",
      message: "Manual processing trigger failed",
      meta: { ...triggerMeta, trigger_status: triggerResult.status, trigger_response: triggerResult.response.slice(0, 400) },
    });
  }

  return NextResponse.json({
    ok: true,
    state: routeState,
    trigger_ok: triggerResult.ok,
    trigger_status: triggerResult.status,
  });
}
