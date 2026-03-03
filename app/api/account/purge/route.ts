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

function isMissingTableOrColumn(err: any): boolean {
  const msg = String(err?.message ?? "").toLowerCase();
  const code = String(err?.code ?? "");
  return code === "42P01" || code === "42703" || msg.includes("does not exist") || msg.includes("column");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function bestEffortDeleteIn(admin: ReturnType<typeof supabaseAdmin>, table: string, field: string, values: string[]) {
  if (!values.length) return;
  const r = await admin.from(table).delete().in(field, values);
  if (r.error && !isMissingTableOrColumn(r.error)) throw r.error;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseRoute(req);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    const { data: jobs, error: jobsErr } = await admin
      .from("jobs")
      .select("id,file_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (jobsErr) {
      return NextResponse.json({ error: "jobs_read_failed" }, { status: 500 });
    }

    const jobIds = (jobs ?? []).map((j: any) => String(j?.id ?? "").trim()).filter(Boolean);
    const filePaths = (jobs ?? []).map((j: any) => String(j?.file_path ?? "").trim()).filter(Boolean);

    // 1) Delete dependent rows
    for (const batch of chunk(jobIds, 200)) {
      await bestEffortDeleteIn(admin, "job_work_items", "job_id", batch);
      await bestEffortDeleteIn(admin, "job_metadata", "job_id", batch);
      await bestEffortDeleteIn(admin, "job_results", "job_id", batch);
      await bestEffortDeleteIn(admin, "job_events", "job_id", batch);
    }

    // 2) Delete jobs
    for (const batch of chunk(jobIds, 200)) {
      await bestEffortDeleteIn(admin, "jobs", "id", batch);
    }

    // 3) Delete files (best effort)
    for (const batch of chunk(filePaths, 100)) {
      try {
        const rm = await admin.storage.from("uploads").remove(batch);
        if ((rm as any)?.error) {
          console.warn("purge: storage remove failed", (rm as any).error);
        }
      } catch (e) {
        console.warn("purge: storage remove threw", e);
      }
    }

    return NextResponse.json({ ok: true, deleted_jobs: jobIds.length, deleted_files: filePaths.length });
  } catch (e: any) {
    console.error("account purge failed", e);
    return NextResponse.json({ error: "purge_failed" }, { status: 500 });
  }
}
