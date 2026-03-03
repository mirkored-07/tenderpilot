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

async function bestEffortDeleteEq(admin: ReturnType<typeof supabaseAdmin>, table: string, field: string, value: string) {
  const r = await admin.from(table).delete().eq(field, value);
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

    // 1) Purge tender artifacts (reuse internal logic by calling the purge route directly)
    // We do it inline (not via fetch) to keep this route self-contained.
    const { data: jobs } = await admin
      .from("jobs")
      .select("id,file_path")
      .eq("user_id", user.id)
      .limit(5000);

    const jobIds = (jobs ?? []).map((j: any) => String(j?.id ?? "").trim()).filter(Boolean);
    const filePaths = (jobs ?? []).map((j: any) => String(j?.file_path ?? "").trim()).filter(Boolean);

    // Dependent rows
    if (jobIds.length) {
      const batches: string[][] = [];
      for (let i = 0; i < jobIds.length; i += 200) batches.push(jobIds.slice(i, i + 200));

      for (const b of batches) {
        const del1 = await admin.from("job_work_items").delete().in("job_id", b);
        if (del1.error && !isMissingTableOrColumn(del1.error)) throw del1.error;

        const del2 = await admin.from("job_metadata").delete().in("job_id", b);
        if (del2.error && !isMissingTableOrColumn(del2.error)) throw del2.error;

        const del3 = await admin.from("job_results").delete().in("job_id", b);
        if (del3.error && !isMissingTableOrColumn(del3.error)) throw del3.error;

        const del4 = await admin.from("job_events").delete().in("job_id", b);
        if (del4.error && !isMissingTableOrColumn(del4.error)) throw del4.error;

        const del5 = await admin.from("jobs").delete().in("id", b);
        if (del5.error && !isMissingTableOrColumn(del5.error)) throw del5.error;
      }
    }

    // Files (best effort)
    if (filePaths.length) {
      for (let i = 0; i < filePaths.length; i += 100) {
        const batch = filePaths.slice(i, i + 100);
        try {
          const rm = await admin.storage.from("uploads").remove(batch);
          if ((rm as any)?.error) console.warn("account delete: storage remove failed", (rm as any).error);
        } catch (e) {
          console.warn("account delete: storage remove threw", e);
        }
      }
    }

    // 2) Delete user-owned configuration
    await bestEffortDeleteEq(admin, "workspace_playbooks", "workspace_id", user.id);
    await bestEffortDeleteEq(admin, "user_settings", "user_id", user.id);

    // 3) Delete profile row
    await bestEffortDeleteEq(admin, "profiles", "id", user.id);

    // 4) Delete auth user
    try {
      const del = await (admin as any).auth.admin.deleteUser(user.id);
      if (del?.error) {
        console.warn("account delete: auth admin deleteUser failed", del.error);
      }
    } catch (e) {
      console.warn("account delete: auth admin deleteUser threw", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("account delete failed", e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
