/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function logEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  job: JobRow,
  level: "info" | "warn" | "error",
  message: string,
  meta: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("job_events").insert({
    job_id: job.id,
    user_id: job.user_id,
    level,
    message,
    meta,
  });
}

async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("https://esm.sh/mammoth@1.6.0?target=deno");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result?.value ?? "").trim();
}

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  // pdfjs-dist works well for extraction in JS environments.
  const pdfjsLib = await import(
    "https://esm.sh/pdfjs-dist@4.6.82/legacy/build/pdf.mjs?target=deno"
  );

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const maxPages = pdf.numPages;
  const parts: string[] = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const strings = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .filter(Boolean);

    parts.push(strings.join(" "));
  }

  return parts.join("\n\n").replace(/\s+\n/g, "\n").trim();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { job_id } = await req.json().catch(() => ({}));
    if (!job_id || typeof job_id !== "string") {
      return new Response("Missing job_id", { status: 400 });
    }

    const SUPABASE_URL = requiredEnv("TP_SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("TP_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status")
      .eq("id", job_id)
      .single<JobRow>();

    if (jobErr || !job) {
      return new Response("Job not found", { status: 404 });
    }

    // Idempotency and safe claiming
    if (job.status === "done") {
      return new Response(JSON.stringify({ ok: true, status: "already_done" }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (job.status === "failed") {
      return new Response(JSON.stringify({ ok: true, status: "already_failed" }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Claim: queued or failed retry path could be allowed later.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", job.id)
      .in("status", ["queued"])
      .select("id")
      .maybeSingle();

    if (claimErr) {
      return new Response("Failed to claim job", { status: 500 });
    }
    if (!claimed) {
      // Someone else claimed it
      return new Response(JSON.stringify({ ok: true, status: "already_claimed" }), {
        headers: { "content-type": "application/json" },
      });
    }

    await logEvent(supabaseAdmin, job, "info", "Job claimed and processing started");

    // Download from Storage
    const { data: fileData, error: dlErr } = await supabaseAdmin
      .storage
      .from("uploads")
      .download(job.file_path);

    if (dlErr || !fileData) {
      await logEvent(supabaseAdmin, job, "error", "Storage download failed", { error: dlErr?.message });
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      return new Response("Download failed", { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();

    // Extract text
    let extractedText = "";
    if (job.source_type === "docx") {
      extractedText = await extractDocxText(arrayBuffer);
    } else {
      extractedText = await extractPdfText(arrayBuffer);
    }

    if (!extractedText) {
      await logEvent(supabaseAdmin, job, "warn", "Extraction returned empty text");
    } else {
      await logEvent(supabaseAdmin, job, "info", "Text extracted", { chars: extractedText.length });
    }

    // Persist results (for now: only extracted_text; later steps will fill checklist/risks/proposal)
    const { error: upsertErr } = await supabaseAdmin.from("job_results").upsert({
      job_id: job.id,
      user_id: job.user_id,
      extracted_text: extractedText,
      checklist: null,
      risks: null,
      proposal_draft: null,
    });

    if (upsertErr) {
      await logEvent(supabaseAdmin, job, "error", "Saving results failed", { error: upsertErr.message });
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      return new Response("Result save failed", { status: 500 });
    }

    // Mark done
    await supabaseAdmin.from("jobs").update({ status: "done" }).eq("id", job.id);
    await logEvent(supabaseAdmin, job, "info", "Job completed");

    return new Response(JSON.stringify({ ok: true, status: "done" }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
});
