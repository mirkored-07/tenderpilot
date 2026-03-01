import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseRoute } from "@/lib/supabase/route";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseRoute(req);
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const jobId = String(body?.job_id ?? "").trim();
    if (!jobId) {
      return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const cronSecret = process.env.TP_CRON_SECRET || process.env.TP_SECRET;

    if (!supabaseUrl || !serviceKey || !cronSecret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Ownership + status check using admin (do not rely on RLS being perfect)
    const admin = supabaseAdmin();
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id,user_id,status,updated_at")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) {
      return NextResponse.json({ error: "job_lookup_failed" }, { status: 500 });
    }
    if (!job || String((job as any).user_id) !== userRes.user.id) {
      return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    }

    const status = String((job as any).status ?? "").toLowerCase();
    if (status !== "queued") {
      return NextResponse.json({ error: "job_not_queued", status }, { status: 409 });
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/process-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        "x-tenderpilot-secret": cronSecret,
      },
      body: JSON.stringify({ job_id: jobId }),
    });

    const text = await res.text().catch(() => "");
    return NextResponse.json({ ok: res.ok, status: res.status, response: text });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}