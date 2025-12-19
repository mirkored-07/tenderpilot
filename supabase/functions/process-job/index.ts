import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { MOCK_EXTRACTED_TEXT } from "./fixtures/mock_extracted_text.ts";
import { MOCK_AI_OUTPUT } from "./fixtures/mock_ai_output.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);

    const secret =
      req.headers.get("x-tenderpilot-secret") ??
      url.searchParams.get("tp_secret") ?? // ✅ cron uses this
      url.searchParams.get("secret");      // ✅ keep backward compat

    if (secret !== Deno.env.get("TP_CRON_SECRET")) {
      return new Response("unauthorized", { status: 401 });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response("missing job_id", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (!job) {
      return new Response("job not found", { status: 404 });
    }

    await supabase
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", job_id);

    await supabase.from("job_events").insert({
      job_id,
      user_id: job.user_id,
      event_type: "processing_started",
      level: "info",
      message: "Job processing started",
    });

    // -----------------------------
    // MOCK / REAL EXTRACTION
    // -----------------------------
    const useMockExtract = Deno.env.get("TP_MOCK_EXTRACT") === "1";
    const extracted_text = useMockExtract
      ? MOCK_EXTRACTED_TEXT
      : "REAL EXTRACTION PLACEHOLDER";

    // -----------------------------
    // MOCK / REAL AI
    // -----------------------------
    const useMockAI = Deno.env.get("TP_MOCK_AI") === "1";
    const aiOutput = useMockAI
      ? MOCK_AI_OUTPUT
      : {
          checklist: [],
          risks: [],
          proposal_draft: { sections: [] },
        };

    await supabase.from("job_results").upsert({
      job_id,
      user_id: job.user_id,
      extracted_text,
      checklist: aiOutput.checklist,
      risks: aiOutput.risks,
      proposal_draft: aiOutput.proposal_draft,
    });

    await supabase
      .from("jobs")
      .update({ status: "done", credits_used: 0 })
      .eq("id", job_id);

    await supabase.from("job_events").insert({
      job_id,
      user_id: job.user_id,
      event_type: "processing_completed",
      level: "info",
      message: "Job processing completed",
    });

    return new Response(JSON.stringify({ ok: true, job_id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("internal error", { status: 500 });
  }
});
