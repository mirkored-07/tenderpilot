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

type Severity = "high" | "medium" | "low";

type AiOutput = {
  executive_summary: {
    decisionBadge: string;
    decisionLine: string;
    keyFindings: string[];
    nextActions: string[];
    topRisks: Array<{ title: string; severity: Severity; detail: string }>;
    submissionDeadline: string;
  };
  checklist: Array<{ type: "MUST" | "SHOULD" | "INFO"; text: string; source?: string }>;
  risks: Array<{ title: string; severity: Severity; detail: string }>;
  buyer_questions: string[];
  proposal_draft: string;
};

function flagEnv(name: string): boolean {
  const v = String(Deno.env.get(name) ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function firstEnv(names: string[], labelForError: string): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`Missing env var: ${labelForError} (checked: ${names.join(", ")})`);
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = String(Deno.env.get(name) ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clampText(input: string, maxChars: number) {
  const txt = String(input ?? "");
  if (txt.length <= maxChars) return { text: txt, truncated: false };
  return { text: txt.slice(0, maxChars), truncated: true };
}

function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

function estimateUsd(args: { model: string; inputTokens: number; outputTokens: number }): number {
  // Prices per 1M tokens (USD)
  // gpt-4.1-mini: $0.40 input, $1.60 output
  // gpt-4o-mini:  $0.15 input, $0.60 output
  // gpt-4.1-nano: $0.10 input, $0.40 output
  const m = args.model;

  let inPerM = 0.40;
  let outPerM = 1.60;

  if (m === "gpt-4o-mini") {
    inPerM = 0.15;
    outPerM = 0.60;
  } else if (m === "gpt-4.1-nano") {
    inPerM = 0.10;
    outPerM = 0.40;
  } else if (m === "gpt-4.1-mini") {
    inPerM = 0.40;
    outPerM = 1.60;
  }

  const inputUsd = (args.inputTokens / 1_000_000) * inPerM;
  const outputUsd = (args.outputTokens / 1_000_000) * outPerM;
  return inputUsd + outputUsd;
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

/**
 * Unstructured Hosted API extraction (Edge-compatible)
 * Returns plain text by joining the "text" fields of returned elements.
 *
 * Docs show default endpoint: https://api.unstructuredapp.io/general/v0/general
 * Auth header: unstructured-api-key
 */
async function extractWithUnstructured(args: {
  fileBytes: Uint8Array;
  fileName: string;
  contentType: string;
  includePageBreaks?: boolean;
}): Promise<string> {
  const apiKey = firstEnv(["UNSTRUCTURED_API_KEY", "TP_UNSTRUCTURED_API_KEY"], "UNSTRUCTURED_API_KEY");
  const apiUrl = String(Deno.env.get("UNSTRUCTURED_API_URL") ?? "https://api.unstructuredapp.io/general/v0/general");

  const form = new FormData();
  form.append("files", new Blob([args.fileBytes], { type: args.contentType }), args.fileName);

  // Keep defaults simple and stable for MVP
  // include_page_breaks helps readability for long tenders
  form.append("include_page_breaks", (args.includePageBreaks ?? true) ? "true" : "false");

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "unstructured-api-key": apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Unstructured error ${res.status}: ${txt.slice(0, 600)}`);
    }

  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("Unstructured response is not an array");
  }

  const parts: string[] = [];
  for (const el of json) {
    const t = typeof el?.text === "string" ? el.text.trim() : "";
    if (t) parts.push(t);
  }

  // Join with paragraph spacing; Unstructured may already include page breaks.
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function mockExtractFixture(args: { sourceType: "pdf" | "docx"; fileName: string }) {
  const { sourceType, fileName } = args;
  return `TENDER DOCUMENT (MOCK)

Title: Provision of IT Support Services
Reference: TP-MOCK-001
Document type: ${sourceType.toUpperCase()}
Uploaded file: ${fileName}

Submission deadline: 2026-02-15 12:00 CET

Scope
The contracting authority requests proposals for Level 1 and Level 2 IT support, including incident management, end-user support, and on-site availability.

Mandatory requirements
1. The bidder MUST provide 24/7 incident intake with response time of 30 minutes for critical incidents.
2. The bidder MUST provide a dedicated service manager as single point of contact.
3. The bidder MUST demonstrate ISO 27001 certification or equivalent controls.

Preferred requirements
1. The bidder SHOULD provide monthly service reporting with SLA metrics.
2. The bidder SHOULD propose a transition plan within 30 days.

Information
The contracting authority expects a fixed price per month plus on-demand rates.

Clarification questions requested by the buyer
1. Please confirm the language for on-site support documentation.
2. Please specify the minimum team size required on-site.
`;
}

function mockAiFixture(extractedText: string): AiOutput {
  const preview = String(extractedText ?? "").replaceAll(/\s+/g, " ").trim().slice(0, 240);
  return {
    executive_summary: {
      decisionBadge: "Proceed with caution",
      decisionLine:
        "This is a drafting support preview. Verify mandatory requirements and deadlines against the source tender.",
      keyFindings: [
        "Submission deadline detected and should be confirmed",
        "Several mandatory requirements exist that may impact eligibility",
        "Security controls are mentioned and need evidence",
      ],
      nextActions: [
        "Confirm the submission deadline and time zone",
        "Collect proof for ISO 27001 or equivalent controls",
        "Draft the SLA response and transition plan",
      ],
      topRisks: [
        {
          title: "SLA response time commitment",
          severity: "high",
          detail: "Confirm you can meet 30 minute response for critical incidents.",
        },
        { title: "Security compliance evidence", severity: "medium", detail: "Prepare certificates, policies, and audit summaries." },
        { title: "Ambiguity in on site staffing", severity: "low", detail: "Clarify minimum on site presence and documentation language." },
      ],
      submissionDeadline: "2026-02-15 12:00 CET",
    },
    checklist: [
      { type: "MUST", text: "Provide 24/7 incident intake with 30 minute response time for critical incidents" },
      { type: "MUST", text: "Provide a dedicated service manager as single point of contact" },
      { type: "MUST", text: "Demonstrate ISO 27001 certification or equivalent controls" },
      { type: "SHOULD", text: "Provide monthly service reporting with SLA metrics" },
      { type: "SHOULD", text: "Propose a transition plan within 30 days" },
      { type: "INFO", text: "Commercial model is fixed monthly price plus on demand rates" },
    ],
    risks: [
      { title: "SLA response time commitment", severity: "high", detail: "Confirm you can operationally meet the response requirement." },
      { title: "Security compliance evidence", severity: "medium", detail: "Prepare a clear evidence pack for security controls." },
      { title: "Transition timeline feasibility", severity: "low", detail: "Validate transition plan within 30 days is achievable." },
    ],
    buyer_questions: [
      "Confirm the language for on site support documentation",
      "Specify the minimum team size required on site",
    ],
    proposal_draft: `Draft outline

1. Executive summary
2. Understanding of scope
3. Service model and SLAs
4. Security and compliance evidence
5. Transition plan
6. Pricing approach

Source preview
${preview}`,
  };
}

function parseOpenAiJsonFromResponse(resp: any): any {
  const direct = resp?.output_parsed ?? resp?.output_json ?? resp?.json ?? null;
  if (direct) return direct;

  const outputText = resp?.output_text;
  if (typeof outputText === "string" && outputText.trim().startsWith("{")) {
    return JSON.parse(outputText);
  }

  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of out) {
    if (item?.type === "message") {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          const t = c.text.trim();
          if (t.startsWith("{")) return JSON.parse(t);
        }
      }
    }
  }

  throw new Error("OpenAI response did not include parsable JSON output");
}

async function runOpenAi(args: {
  apiKey: string;
  model: string;
  extractedText: string;
  maxOutputTokens: number;
}): Promise<AiOutput> {
  const { apiKey, model, extractedText, maxOutputTokens } = args;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      executive_summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          decisionBadge: { type: "string" },
          decisionLine: { type: "string" },
          keyFindings: { type: "array", items: { type: "string" }, maxItems: 7 },
          nextActions: { type: "array", items: { type: "string" }, maxItems: 3 },
          topRisks: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                detail: { type: "string" },
              },
              required: ["title", "severity", "detail"],
            },
          },
          submissionDeadline: { type: "string" },
        },
        required: ["decisionBadge", "decisionLine", "keyFindings", "nextActions", "topRisks", "submissionDeadline"],
      },
      checklist: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["MUST", "SHOULD", "INFO"] },
            text: { type: "string" },
            source: { type: "string" },
          },
          required: ["type", "text"],
        },
      },
      risks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            detail: { type: "string" },
          },
          required: ["title", "severity", "detail"],
        },
      },
      buyer_questions: { type: "array", items: { type: "string" } },
      proposal_draft: { type: "string" },
    },
    required: ["executive_summary", "checklist", "risks", "buyer_questions", "proposal_draft"],
  };

  const instructions =
    "You are TenderPilot. Provide drafting support only. Not compliance automation. Not legal advice. " +
    "Always generate the output in the same language as the tender source text. " +
    "Avoid dashes in text. Use concise sentences.";

  const userPrompt =
    "From the tender source text, produce a structured bid kit.\n\n" +
    "Rules\n" +
    "1. Mandatory requirements are MUST. Preferred requirements are SHOULD. Context is INFO.\n" +
    "2. Identify key risks with severity high, medium, or low.\n" +
    "3. Produce an executive summary with decisionBadge, decisionLine, up to 7 keyFindings, up to 3 nextActions, up to 3 topRisks, and submissionDeadline if present.\n" +
    "4. Put ambiguities or missing info into buyer_questions.\n" +
    "5. Provide proposal_draft as a clean draft outline followed by a short draft section.\n\n" +
    "Tender source text follows.\n\n" +
    extractedText;

  const body = {
    model,
    instructions,
    input: [{ role: "user", content: userPrompt }],
    temperature: 0.2,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        strict: true,
        name: "tenderpilot_review",
        schema,
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  return parseOpenAiJsonFromResponse(json) as AiOutput;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const { job_id } = await req.json().catch(() => ({}));
    if (!job_id || typeof job_id !== "string") return new Response("Missing job_id", { status: 400 });

    const SUPABASE_URL = firstEnv(["TP_SUPABASE_URL", "SUPABASE_URL"], "TP_SUPABASE_URL");
    const SERVICE_ROLE = firstEnv(["TP_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"], "TP_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status")
      .eq("id", job_id)
      .single<JobRow>();

    if (jobErr || !job) return new Response("Job not found", { status: 404 });

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

    await logEvent(supabaseAdmin, job, "info", "Job claimed and processing started");

    const useMockExtract = flagEnv("TP_MOCK_EXTRACT");
    const useMockAi = flagEnv("TP_MOCK_AI");

    // Extract text (mock runs first and can bypass storage)
    let extractedText = "";

    if (useMockExtract) {
      extractedText = mockExtractFixture({ sourceType: job.source_type, fileName: job.file_name });
      await logEvent(supabaseAdmin, job, "info", "Mock extract enabled", { chars: extractedText.length });
    } else {
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(job.file_path);

      if (dlErr || !fileData) {
        await logEvent(supabaseAdmin, job, "error", "Storage download failed", { error: dlErr?.message });
        await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
        return new Response("Download failed", { status: 500 });
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const contentType =
        job.source_type === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      await logEvent(supabaseAdmin, job, "info", "Unstructured extract started", {
        fileName: job.file_name,
        sourceType: job.source_type,
        bytes: bytes.byteLength,
      });

      extractedText = await extractWithUnstructured({
        fileBytes: bytes,
        fileName: job.file_name,
        contentType,
        includePageBreaks: true,
      });

      await logEvent(supabaseAdmin, job, extractedText ? "info" : "warn", extractedText ? "Unstructured extract completed" : "Unstructured extract returned empty text", {
        chars: extractedText.length,
      });
    }

    // AI analysis
    const model = String(Deno.env.get("TP_OPENAI_MODEL") ?? "gpt-4.1-mini");
    const maxInputChars = parseNumberEnv("TP_MAX_INPUT_CHARS", 120_000);
    const maxOutputTokens = parseNumberEnv("TP_MAX_OUTPUT_TOKENS", 1800);
    const maxUsdPerJob = parseNumberEnv("TP_MAX_USD_PER_JOB", 0.05);

    let aiOut: AiOutput;

    if (useMockAi) {
      aiOut = mockAiFixture(extractedText);
      await logEvent(supabaseAdmin, job, "info", "Mock AI enabled");
    } else {
      const apiKey = firstEnv(["TP_OPENAI_API_KEY", "OPENAI_API_KEY"], "TP_OPENAI_API_KEY");

      const { text: clipped, truncated } = clampText(extractedText, maxInputChars);
      if (truncated) {
        await logEvent(supabaseAdmin, job, "warn", "Source text truncated for AI", { maxChars: maxInputChars });
      }

      const inputTokensEst = estimateTokensFromChars(clipped.length);
      const usdEst = estimateUsd({ model, inputTokens: inputTokensEst, outputTokens: maxOutputTokens });

      if (usdEst > maxUsdPerJob) {
        await logEvent(supabaseAdmin, job, "warn", "Job exceeds cost cap, reduce input or limits", {
          model,
          maxUsdPerJob,
          usdEst,
          inputChars: clipped.length,
          inputTokensEst,
          maxOutputTokens,
        });

        await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
        return new Response("Job exceeds cost cap", { status: 413 });
      }

      await logEvent(supabaseAdmin, job, "info", "OpenAI started", { model, maxOutputTokens });
      aiOut = await runOpenAi({ apiKey, model, extractedText: clipped, maxOutputTokens });
      await logEvent(supabaseAdmin, job, "info", "OpenAI completed", { model, maxOutputTokens });
    }

    // Persist results
    const { error: upsertErr } = await supabaseAdmin.from("job_results").upsert({
      job_id: job.id,
      user_id: job.user_id,
      extracted_text: extractedText,
      executive_summary: aiOut.executive_summary,
      checklist: aiOut.checklist,
      risks: aiOut.risks,
      clarifications: aiOut.buyer_questions,
      proposal_draft: aiOut.proposal_draft,
    });

    if (upsertErr) {
      await logEvent(supabaseAdmin, job, "error", "Saving results failed", { error: upsertErr.message });
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      return new Response("Result save failed", { status: 500 });
    }

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
