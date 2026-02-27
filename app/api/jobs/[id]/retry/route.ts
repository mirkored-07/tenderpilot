import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseRoute } from "@/lib/supabase/route";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;

  const supabase = supabaseRoute(req);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Verify ownership (RLS + explicit check)
  const { data: jobRow, error: jobErr } = await supabase
    .from("jobs")
    .select("id,user_id,status,file_name")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) {
    return NextResponse.json({ error: "job_lookup_failed" }, { status: 500 });
  }
  if (!jobRow || (jobRow as any)?.user_id !== userRes.user.id) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const status = String((jobRow as any)?.status ?? "").toLowerCase();
  if (status !== "failed") {
    return NextResponse.json({ error: "job_not_failed", status }, { status: 409 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const admin = supabaseAdmin();

  // Reset to queued so process-job can claim again.
  {
    const { error: updErr } = await admin
      .from("jobs")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", userRes.user.id);

    if (updErr) {
      return NextResponse.json({ error: "retry_update_failed" }, { status: 500 });
    }
  }

  // Best-effort: add a lightweight event.
  try {
    await admin.from("job_events").insert({
      job_id: jobId,
      user_id: userRes.user.id,
      level: "info",
      message: "Retry requested",
      meta: { source: "ui" },
    });
  } catch {
    // ignore
  }

  // Best-effort: trigger now.
  try {
    await fetch(`${supabaseUrl}/functions/v1/process-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch {
    // job remains queued; next tick can pick it up
  }

  return NextResponse.json({ ok: true });
}
