/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MOCK_EXTRACTED_TEXT } from "./fixtures/mock_extracted_text.ts";
import { MOCK_AI_OUTPUT } from "./fixtures/mock_ai_output.ts";

type JobRow = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  source_type: "pdf" | "docx";
  status: string;
};

function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isTruthyFlag(v: string | undefined | null): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

async function logEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  job: JobRow,
  level: "info" | "warn" | "error",
  event_type: string,
  message: string,
  meta: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("job_events").insert({
    job_id: job.id,
    user_id: job.user_id,
    level,
    event_type,
    message,
    meta,
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    // Auth: tp_secret / x-tenderpilot-secret (LOCKED behavior)
    const url = new URL(req.url);
    const secret =
      req.headers.get("x-tenderpilot-secret") ??
      url.searchParams.get("tp_secret") ??
      url.searchParams.get("secret");

    if (secret !== requiredEnv("TP_CRON_SECRET")) {
      return new Response("unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const job_id = body?.job_id;
    if (!job_id || typeof job_id !== "string") {
      return new Response("Missing job_id", { status: 400 });
    }

    const supabaseAdmin = createClient(
      requiredEnv("TP_SUPABASE_URL"),
      requiredEnv("TP_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status")
      .eq("id", job_id)
      .single<JobRow>();

    if (jobErr || !job) return new Response("Job not found", { status: 404 });

    if (job.status === "done") {
      return new Response(JSON.stringify({ ok: true, status: "already_done" }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Claim queued → processing (LOCKED lifecycle)
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", job.id)
      .in("status", ["queued"])
      .select("id")
      .maybeSingle();

    if (claimErr) return new Response("Failed to claim job", { status: 500 });
    if (!claimed) {
      return new Response(JSON.stringify({ ok: true, status: "already_claimed" }), {
        headers: { "content-type": "application/json" },
      });
    }

    await logEvent(supabaseAdmin, job, "info", "processing_started", "Job processing started");

    // ✅ READ FLAGS EARLY and log actual raw values
    const rawMockExtract = Deno.env.get("TP_MOCK_EXTRACT");
    const rawMockAI = Deno.env.get("TP_MOCK_AI");
    const useMockExtract = isTruthyFlag(rawMockExtract);
    const useMockAI = isTruthyFlag(rawMockAI);

    await logEvent(
      supabaseAdmin,
      job,
      "info",
      "debug_flags",
      `Mock flags read by function: extract=${useMockExtract} ai=${useMockAI}`,
      {
        TP_MOCK_EXTRACT: rawMockExtract ?? null,
        TP_MOCK_AI: rawMockAI ?? null,
      },
    );

    // Keep the storage download (validates file exists + access)
    const { data: fileData, error: dlErr } = await supabaseAdmin
      .storage
      .from("uploads")
      .download(job.file_path);

    if (dlErr || !fileData) {
      await logEvent(supabaseAdmin, job, "error", "processing_failed", "Storage download failed", {
        error: dlErr?.message ?? "unknown",
      });
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      return new Response("Download failed", { status: 500 });
    }

    // ✅ IMPORTANT FIX:
    // Mocks must run BEFORE any extractor compatibility logic.
    let extractedText = "";
    if (useMockExtract) {
      extractedText = MOCK_EXTRACTED_TEXT;
      await logEvent(
        supabaseAdmin,
        job,
        "info",
        "mock_extract_used",
        "Mock extraction enabled. Using fixture extracted text.",
      );
    } else {
      // Real extractors are intentionally disabled in this Edge-safe build.
      extractedText =
        "Text extraction is currently disabled in this environment. Enable TP_MOCK_EXTRACT=1 for UX testing.";
      await logEvent(
        supabaseAdmin,
        job,
        "warn",
        "extract_disabled",
        "Extraction skipped (no compatible extractor enabled in Edge runtime).",
      );
    }

    const aiOut = useMockAI
      ? MOCK_AI_OUTPUT
      : { checklist: [], risks: [], proposal_draft: { sections: [] } };

    if (useMockAI) {
      await logEvent(
        supabaseAdmin,
        job,
        "info",
        "mock_ai_used",
        "Mock AI enabled. Using fixture AI output.",
      );
    }

    const { error: upsertErr } = await supabaseAdmin.from("job_results").upsert({
      job_id: job.id,
      user_id: job.user_id,
      extracted_text: extractedText,
      checklist: aiOut.checklist,
      risks: aiOut.risks,
      proposal_draft: aiOut.proposal_draft,
    });

    if (upsertErr) {
      await logEvent(supabaseAdmin, job, "error", "processing_failed", "Saving results failed", {
        error: upsertErr.message,
      });
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      return new Response("Result save failed", { status: 500 });
    }

    await supabaseAdmin.from("jobs").update({ status: "done" }).eq("id", job.id);
    await logEvent(supabaseAdmin, job, "info", "processing_completed", "Job processing completed");

    return new Response(JSON.stringify({ ok: true, status: "done" }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
});
