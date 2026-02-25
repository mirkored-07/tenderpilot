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

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      file_name: input.fileName,
      file_path: input.filePath,
      source_type: input.sourceType,
      status: "queued",
      credits_used: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Failed to create job", error);
    throw new Error(error?.message ?? "Failed to create job");
  }

  return { jobId: data.id };
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
