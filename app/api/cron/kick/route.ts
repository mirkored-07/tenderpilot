import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function expectedSecret(): string {
  return String(process.env.TP_CRON_SECRET || process.env.TP_SECRET || "").trim();
}

function projectUrl(): string {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!base) throw new Error("missing_SUPABASE_URL");
  return base.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  try {
    const secret = expectedSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "missing_TP_CRON_SECRET", hint: "Set TP_CRON_SECRET (or TP_SECRET) in your deployment env." },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const headerSecret = String(req.headers.get("x-tenderpilot-secret") ?? "").trim();
    const querySecret = String(url.searchParams.get("tp_secret") ?? "").trim();
    const provided = headerSecret || querySecret;
    if (!provided || provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const batch = Math.max(1, Math.min(10, Number(process.env.TP_CRON_BATCH ?? 3) || 3));

    const { data: jobs, error } = await admin
      .from("jobs")
      .select("id")
      .eq("status", "queued")
      .not("file_path", "is", null)
      .order("created_at", { ascending: true })
      .limit(batch);

    if (error) {
      return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
    }

    const supabaseUrl = projectUrl();
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!serviceKey) {
      return NextResponse.json({ error: "missing_SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const endpoint = `${supabaseUrl}/functions/v1/process-job`;

    const jobIds: string[] = (jobs ?? []).map((j: any) => String(j?.id ?? "").trim()).filter(Boolean);
    let ok = 0;
    let failed = 0;
    const results: Array<{ job_id: string; ok: boolean; status: number }> = [];

    for (const jobId of jobIds) {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          "x-tenderpilot-secret": secret,
        },
        body: JSON.stringify({ job_id: jobId }),
      });

      const isOk = resp.ok;
      results.push({ job_id: jobId, ok: isOk, status: resp.status });
      if (isOk) ok++;
      else failed++;
    }

    return NextResponse.json({ ok, failed, count: jobIds.length, jobs: results });
  } catch (e: any) {
    return NextResponse.json({ error: "cron_failed", message: String(e?.message ?? e) }, { status: 500 });
  }
}
