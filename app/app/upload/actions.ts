"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type SourceType = "pdf" | "docx";

async function supabaseServer() {
  // In your Next version, cookies() is async
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // IMPORTANT: keep cookies readable by the browser Supabase client
            // so client-side RLS writes (job_work_items overlays) keep working.
            cookieStore.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function createJobAction(input: {
  fileName: string;
  filePath: string;
  sourceType: SourceType;
}): Promise<{ jobId: string }> {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // Enforce credits + create job transactionally.
  // We do this server-side (service role) so the client cannot bypass billing.
  const admin = supabaseAdmin();

  // Ensure the profiles row exists (required for credits_balance).
  // This is best-effort and intentionally NOT the transactional part.
  // The transactional part happens inside the RPC.
  try {
    const uid = user.id;
    const mail = user.email ?? "";

    const existing = await admin
      .from("profiles")
      .select("id")
      .eq("id", uid)
      .maybeSingle();

    if (!existing.error && !existing.data) {
      const ins = await admin
        .from("profiles")
        .insert({ id: uid, email: mail })
        .select("id")
        .maybeSingle();

      if (ins.error) {
        // Don't block job creation if the profile already exists (race) or
        // if RLS differs across environments.
        console.warn("profiles insert best-effort failed", ins.error);
      }
    }
  } catch (e) {
    console.warn("profiles ensure best-effort failed", e);
  }

  const { data, error } = await admin.rpc("create_job_with_credit_v1", {
    p_user_id: user.id,
    p_file_name: input.fileName,
    p_file_path: input.filePath,
    p_source_type: input.sourceType,
  });

  if (error) {
    const msg = String(error.message ?? "");

    if (msg.toUpperCase().includes("NO_CREDITS")) {
      throw new Error(
        "No credits remaining. Please contact support to upgrade or top up."
      );
    }

    if (msg.toUpperCase().includes("MISSING_PROFILE")) {
      throw new Error("Account setup incomplete. Please refresh and try again.");
    }

    console.error("Failed to create job (credits RPC)", error);
    throw new Error("Failed to create job");
  }

  const jobId = String(data ?? "").trim();
  if (!jobId) throw new Error("Failed to create job");

  return { jobId };
}

/**
 * Saves fast-path extracted text into job_results so the Edge function can skip slow extraction.
 * This is intentionally minimal (no schema changes required).
 */
export async function saveExtractedTextAction(input: {
  jobId: string;
  extractedText: string;
}) {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const jobId = String(input.jobId || "").trim();
  const extractedText = String(input.extractedText || "").trim();

  if (!jobId) throw new Error("Missing jobId");
  if (!extractedText) return { ok: false, reason: "empty" as const };

  // Use admin client to bypass RLS, but enforce ownership safely
  const admin = supabaseAdmin();

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, user_id")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) throw new Error("Job not found");
  if (job.user_id !== user.id) throw new Error("Forbidden");

  const { error } = await admin.from("job_results").upsert({
    job_id: jobId,
    user_id: user.id,
    extracted_text: extractedText,
  });

  if (error) {
    console.error("Failed to save extracted_text", error);
    throw new Error(error.message);
  }

  return { ok: true as const };
}