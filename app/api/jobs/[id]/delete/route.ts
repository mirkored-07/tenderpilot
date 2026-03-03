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
  return (
    code === "42P01" ||
    code === "42703" ||
    msg.includes("does not exist") ||
    msg.includes("column")
  );
}

async function bestEffortDeleteByJobId(
  admin: ReturnType<typeof supabaseAdmin>,
  table: string,
  jobId: string
) {
  const r = await admin.from(table).delete().eq("job_id", jobId);
  if (r.error && !isMissingTableOrColumn(r.error)) throw r.error;
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const jobId = String(id ?? "").trim();
  if (!jobId)
    return NextResponse.json({ error: "missing_job_id" }, { status: 400 });

  const supabase = supabaseRoute(req);
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id,user_id,file_path")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr)
    return NextResponse.json({ error: "job_lookup_failed" }, { status: 500 });

  if (!job || String((job as any).user_id) !== userRes.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // dependent rows
  try {
    await bestEffortDeleteByJobId(admin, "job_work_items", jobId);
    await bestEffortDeleteByJobId(admin, "job_metadata", jobId);
    await bestEffortDeleteByJobId(admin, "job_results", jobId);
    await bestEffortDeleteByJobId(admin, "job_events", jobId);
  } catch (e) {
    console.error("job_delete: dependent delete failed", e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // delete job
  const delJob = await admin.from("jobs").delete().eq("id", jobId);
  if (delJob.error) {
    console.error("job_delete: jobs delete failed", delJob.error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // delete file (best effort)
  const filePath = String((job as any)?.file_path ?? "").trim();
  if (filePath) {
    try {
      const rm = await admin.storage.from("uploads").remove([filePath]);
      if ((rm as any)?.error) {
        console.warn("job_delete: storage remove failed", (rm as any).error);
      }
    } catch (e) {
      console.warn("job_delete: storage remove threw", e);
    }
  }

  return NextResponse.json({ ok: true });
}