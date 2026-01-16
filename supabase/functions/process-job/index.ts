/// <reference lib="deno.unstable" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

type JobEventLevel = "info" | "error";
type Severity = "high" | "medium" | "low";

type ExecutiveRisk = {
  title: string;
  severity: Severity;
  detail: string;
};

type ExecutiveSummary = {
  decisionBadge: string;
  decisionLine: string;
  keyFindings: string[];
  nextActions: string[];
  topRisks: ExecutiveRisk[];
  submissionDeadline: string;
};

type ChecklistItem = {
  type: "MUST" | "SHOULD" | "INFO";
  text: string;
  source?: string;
};

type RiskItem = {
  title: string;
  severity: Severity;
  detail: string;
};

// What we ask the model to return (single strict object)
type AiOutput = {
  executive_summary: ExecutiveSummary;
  checklist: ChecklistItem[];
  risks: RiskItem[];
  buyer_questions: string[];
  proposal_draft: {
    sections: { title: string; bullets: string[] }[];
    sample_text: string;
  };
};

function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name);
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
}

function asBool(v: string | undefined, fallback = false): boolean {
  if (!v) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function asErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function clampText(s: string, max = 250_000): string {
  const v = s ?? "";
  if (v.length <= max) return v;
  return v.slice(0, max) + "\n\n[TRUNCATED]";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function getOpenAiKey(): { key: string | null; source: string } {
  const tp = Deno.env.get("TP_OPENAI_API_KEY");
  if (tp && tp.length > 0) return { key: tp, source: "TP_OPENAI_API_KEY" };
  const legacy = Deno.env.get("OPENAI_API_KEY");
  if (legacy && legacy.length > 0) return { key: legacy, source: "OPENAI_API_KEY" };
  return { key: null, source: "none" };
}

function extractJsonObjectFromText(s: string): any {
  const t = (s ?? "").trim();

  // Already JSON object
  if (t.startsWith("{") && t.endsWith("}")) return JSON.parse(t);

  // Try to find the JSON object inside any surrounding text
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(t.slice(first, last + 1));
  }
  throw new Error("No JSON object found in model output.");
}

function normalizeNonEmpty(ai: AiOutput): AiOutput {
  const ensureArray = <T>(v: T[] | undefined | null) => (Array.isArray(v) ? v : []);

  ai.executive_summary.keyFindings = ensureArray(ai.executive_summary.keyFindings).filter(Boolean);
  ai.executive_summary.nextActions = ensureArray(ai.executive_summary.nextActions).filter(Boolean);
  ai.executive_summary.topRisks = ensureArray(ai.executive_summary.topRisks).filter(
    (r: any) => r && r.title && r.severity && r.detail,
  );

  ai.checklist = ensureArray(ai.checklist).filter((x: any) => x && x.text && x.type);
  ai.risks = ensureArray(ai.risks).filter((x: any) => x && x.title && x.severity && x.detail);
  ai.buyer_questions = ensureArray(ai.buyer_questions).filter(Boolean);

  ai.proposal_draft = ai.proposal_draft ?? { sections: [], sample_text: "" };
  ai.proposal_draft.sections = ensureArray(ai.proposal_draft.sections).filter((s: any) => s && s.title);
  for (const s of ai.proposal_draft.sections) {
    s.bullets = ensureArray(s.bullets).filter(Boolean);
  }
  ai.proposal_draft.sample_text = String(ai.proposal_draft.sample_text ?? "");

  // Hard minimums for procedural tenders (prevents empty UI sections)
  if (ai.executive_summary.keyFindings.length < 4) {
    ai.executive_summary.keyFindings = [
      ...ai.executive_summary.keyFindings,
      "This tender is primarily procedural and requires careful compliance verification.",
      "Submission rules, mandatory documents, and deadlines can cause disqualification if missed.",
      "Confirm portal steps, file formats, and evidence requirements before drafting.",
      "Raise buyer questions for anything not explicitly stated.",
    ].slice(0, 7);
  }

  if (ai.executive_summary.nextActions.length < 3) {
    ai.executive_summary.nextActions = [
      ...ai.executive_summary.nextActions,
      "Create a compliance checklist from all MUST items and assign owners for each evidence document.",
      "Confirm portal access, file formats, and packaging rules for submission.",
      "Build a timeline working backwards from the deadline including internal reviews and approvals.",
    ].slice(0, 5);
  }

  if (ai.executive_summary.topRisks.length < 1) {
    ai.executive_summary.topRisks = [
      {
        title: "Disqualification risk from missing mandatory documents",
        severity: "high",
        detail:
          "Mandatory submission requirements may be scattered across the document. Build a complete MUST checklist and verify evidence before submission.",
      },
    ];
  }

  if (ai.checklist.length < 10) {
    const fillers: ChecklistItem[] = [
      { type: "MUST", text: "Verify the submission deadline and time zone." },
      { type: "MUST", text: "Confirm submission method and portal steps." },
      { type: "MUST", text: "List all mandatory documents and evidence required." },
      { type: "SHOULD", text: "Confirm file format constraints and naming conventions." },
      { type: "SHOULD", text: "Confirm bid validity period if stated." },
      { type: "INFO", text: "Document appears procedural. Focus on compliance and submission rules." },
    ];
    ai.checklist = [...ai.checklist, ...fillers].slice(0, 14);
  }

  if (ai.risks.length < 3) {
    const fromTop = ai.executive_summary.topRisks.map((r) => ({
      title: r.title,
      severity: r.severity,
      detail: r.detail,
    }));
    const fillers: RiskItem[] = [
      {
        title: "Timeline risk due to short submission window",
        severity: "medium",
        detail:
          "Procedural tenders often require multiple attachments and approvals. Build a backwards plan and internal review gates.",
      },
      {
        title: "Non compliance risk from formatting or portal rules",
        severity: "medium",
        detail:
          "If the portal requires specific formats, naming, or packaging, incorrect submission may be rejected.",
      },
      {
        title: "Eligibility or evidence ambiguity",
        severity: "low",
        detail:
          "If eligibility criteria or mandatory evidence is unclear, confirm with the buyer and document assumptions.",
      },
    ];
    ai.risks = [...ai.risks, ...fromTop, ...fillers].slice(0, 6);
  }

  if (ai.buyer_questions.length < 2) {
    ai.buyer_questions = [
      ...ai.buyer_questions,
      "Please confirm the official submission deadline, time zone, and exact portal steps required.",
      "Please confirm the complete list of mandatory documents and evidence required for compliance.",
    ].slice(0, 10);
  }

  if (!ai.executive_summary.submissionDeadline) {
    ai.executive_summary.submissionDeadline = "Not stated";
  }

  if (ai.proposal_draft.sections.length === 0) {
    ai.proposal_draft.sections = [
      { title: "Cover letter", bullets: ["Confirm intent to bid", "Confirm compliance with submission rules"] },
      { title: "Compliance approach", bullets: ["Compliance matrix for MUST items", "Evidence ownership and review"] },
      { title: "Submission plan", bullets: ["Portal validation", "Packaging and naming checks", "Submit before deadline"] },
    ];
  }

  if (!ai.proposal_draft.sample_text || ai.proposal_draft.sample_text.trim().length < 80) {
    ai.proposal_draft.sample_text =
      "We confirm our intent to submit a compliant tender response. We will provide all mandatory documents and evidence as required, track all MUST requirements in a compliance matrix, and verify submission packaging, formats, and portal steps before submission.";
  }

  return ai;
}

async function runOpenAiChat(args: {
  apiKey: string;
  model: string;
  extractedText: string;
  timeoutMs: number;
}): Promise<AiOutput> {
  const { apiKey, model, extractedText, timeoutMs } = args;

  const system =
    "You are TenderPilot. Provide drafting support only. Always verify against the original tender. " +
    "The tender may be procedural and compliance focused, not technical. " +
    "Return STRICT JSON only. No markdown. No code fences.";

  const user =
    "Return STRICT JSON with EXACTLY these top level keys:\n" +
    "1) executive_summary: { decisionBadge: string, decisionLine: string, keyFindings: string[4 to 7], nextActions: string[3 to 5], topRisks: {title:string,severity:'high'|'medium'|'low',detail:string}[1 to 3], submissionDeadline: string }\n" +
    "2) checklist: { type:'MUST'|'SHOULD'|'INFO', text:string, source?:string }[] (at least 10 items, focus on submission rules, mandatory documents, deadlines, formats, portal steps)\n" +
    "3) risks: { title:string, severity:'high'|'medium'|'low', detail:string }[] (at least 3 risks, focus on compliance and process)\n" +
    "4) buyer_questions: string[] (at least 2)\n" +
    "5) proposal_draft: { sections: { title:string, bullets:string[] }[], sample_text: string }\n\n" +
    "Rules\n" +
    "Always extract process and compliance intelligence for procedural documents. " +
    "Do not invent facts. If not stated, write Not stated and add a buyer question.\n\n" +
    "Tender source text:\n\n" +
    extractedText;

  const payload = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );

  const raw = await safeReadText(res);

  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${raw.slice(0, 900)}`);
  }

  const parsed = JSON.parse(raw);
  const content = parsed?.choices?.[0]?.message?.content ?? "";
  const obj = extractJsonObjectFromText(content) as AiOutput;

  return normalizeNonEmpty(obj);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const SUPABASE_URL = env("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const TP_DEPLOY_MARKER =
    Deno.env.get("TP_DEPLOY_MARKER_UNSTRUCTURED_V1") ??
      "TP_DEPLOY_MARKER_UNSTRUCTURED_V1_NOT_SET";

  const TP_MOCK_EXTRACT = asBool(Deno.env.get("TP_MOCK_EXTRACT"), false);
  const TP_MOCK_AI = asBool(Deno.env.get("TP_MOCK_AI"), false);

  const UNSTRUCTURED_API_URL =
    Deno.env.get("TP_UNSTRUCTURED_API_URL") ??
      "https://api.unstructuredapp.io/general/v0/general";
  const UNSTRUCTURED_API_KEY =
    Deno.env.get("TP_UNSTRUCTURED_API_KEY") ??
      Deno.env.get("UNSTRUCTURED_API_KEY") ??
      "";
  const UNSTRUCTURED_TIMEOUT_MS =
    Number(Deno.env.get("TP_UNSTRUCTURED_TIMEOUT_MS") ?? "120000") || 120000;

  const STORAGE_BUCKET = Deno.env.get("TP_STORAGE_BUCKET") ?? "uploads";

  const OPENAI_MODEL = Deno.env.get("TP_OPENAI_MODEL") ?? "gpt-4.1-mini";
  const OPENAI_TIMEOUT_MS =
    Number(Deno.env.get("TP_OPENAI_TIMEOUT_MS") ?? "90000") || 90000;

  async function logEvent(
    jobId: string,
    eventType: string,
    level: JobEventLevel,
    message: string,
    meta: Record<string, Json> | undefined,
    userId: string | null,
  ) {
    if (!userId) return;
    const { error } = await supabase.from("job_events").insert({
      job_id: jobId,
      user_id: userId,
      event_type: eventType,
      level,
      message,
      meta: meta ?? null,
    });
    if (error) {
      console.error("JOB_EVENT_INSERT_FAILED", error.message);
    }
  }

  async function failJob(
    jobId: string,
    userId: string | null,
    userMessage: string,
    errorMeta?: Record<string, Json>,
  ) {
    await logEvent(jobId, "job_failed", "error", userMessage, errorMeta, userId);
    await supabase
      .from("jobs")
      .update({ status: "failed", error_message: userMessage })
      .eq("id", jobId);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobId: string = body.job_id ?? body.jobId ?? body.id;

    if (!jobId) {
      return new Response(JSON.stringify({ error: "Missing job_id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { data: jobRow, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !jobRow) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const userId: string | null = (jobRow as any)?.user_id ?? null;

    await logEvent(
      jobId,
      "job_started",
      "info",
      "Job processing started",
      {
        TP_DEPLOY_MARKER,
        TP_MOCK_EXTRACT,
        TP_MOCK_AI,
        OPENAI_MODEL,
        UNSTRUCTURED_API_URL,
        UNSTRUCTURED_TIMEOUT_MS,
        OPENAI_TIMEOUT_MS,
      },
      userId,
    );

    await supabase.from("jobs").update({ status: "processing" }).eq("id", jobId);

    const filePath = (jobRow as any)?.file_path ?? (jobRow as any)?.filePath ?? null;
    if (!filePath) {
      await failJob(jobId, userId, "Missing file_path in jobs row.");
      return new Response(JSON.stringify({ ok: false, error: "Missing file_path" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    await logEvent(
      jobId,
      "storage_fetch_started",
      "info",
      "Downloading file from storage",
      { bucket: STORAGE_BUCKET, filePath },
      userId,
    );

    const { data: dlData, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(filePath);

    if (dlErr || !dlData) {
      await failJob(jobId, userId, "Could not download the uploaded PDF. Please re-upload.", {
        filePath,
        error: dlErr?.message ?? "unknown",
      });
      return new Response(JSON.stringify({ ok: false, error: "Storage download failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await dlData.arrayBuffer());

    // Detect filename + mime for Unstructured (supports PDF + DOCX without changing output contract)
    const fileNameFromRow = String((jobRow as any)?.file_name ?? "").trim();
    const fileNameFromPath = String(filePath ?? "").split("/").pop() ?? "";
    const fileName = (fileNameFromRow || fileNameFromPath || "upload").trim();
    const ext = (fileName.split(".").pop() ?? "").toLowerCase();

    const mime = ext === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : ext === "doc"
      ? "application/msword"
      : "application/pdf";

    await logEvent(
      jobId,
      "storage_fetch_completed",
      "info",
      "File downloaded",
      { bytes: fileBytes.length, fileName, ext, mime },
      userId,
    );

    // Extraction
    let extractedText = "";

    if (TP_MOCK_EXTRACT) {
      extractedText =
        "MOCK EXTRACTED TEXT\n\nInclude deadlines, submission rules, mandatory documents, disqualification conditions, file formats, and portal steps.";
      await logEvent(jobId, "extract_mocked", "info", "Extraction mocked (TP_MOCK_EXTRACT=1)", undefined, userId);
    } else {
      if (!UNSTRUCTURED_API_KEY) {
        await failJob(jobId, userId, "Unstructured API key missing.", {});
        return new Response(JSON.stringify({ ok: false, error: "Missing Unstructured key" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }

      await logEvent(
        jobId,
        "extract_started",
        "info",
        "Unstructured extraction started",
        { url: UNSTRUCTURED_API_URL, timeoutMs: UNSTRUCTURED_TIMEOUT_MS, fileName, ext, mime },
        userId,
      );

      const maxAttempts = 2;
      let lastStatus: number | null = null;
      let lastBody = "";

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const form = new FormData();
          const blob = new Blob([fileBytes], { type: mime });

          // IMPORTANT: set correct filename + mime so Unstructured detects DOCX correctly
          form.append("files", blob, fileName || (ext ? `upload.${ext}` : "upload.pdf"));
          form.append("strategy", "fast");
          form.append("include_page_breaks", "false");

          const res = await fetchWithTimeout(
            UNSTRUCTURED_API_URL,
            {
              method: "POST",
              headers: { "unstructured-api-key": UNSTRUCTURED_API_KEY },
              body: form,
            },
            UNSTRUCTURED_TIMEOUT_MS,
          );

          lastStatus = res.status;
          lastBody = await safeReadText(res);

          if (!res.ok) {
            await logEvent(
              jobId,
              "extract_failed",
              "error",
              "Unstructured extraction failed",
              { attempt, status: res.status, bodyPreview: lastBody.slice(0, 2500), fileName, ext, mime },
              userId,
            );

            if (res.status >= 500 && res.status <= 599 && attempt < maxAttempts) {
              await sleep(500 + attempt * 800);
              continue;
            }
            break;
          }

          const parsed = JSON.parse(lastBody);
          const elements: any[] = Array.isArray(parsed) ? parsed : parsed?.elements ?? [];

          const texts = elements
            .map((el) => String(el?.text ?? "").trim())
            .filter(Boolean);

          extractedText = clampText(texts.join("\n\n"), 250_000);

          await logEvent(
            jobId,
            "extract_completed",
            "info",
            "Unstructured extraction completed",
            { attempt, elements: elements.length, extractedChars: extractedText.length, fileName, ext, mime },
            userId,
          );

          break;
        } catch (e) {
          const abort = isAbortError(e);
          await logEvent(
            jobId,
            "unstructured_fetch_failed",
            abort ? "info" : "error",
            "UNSTRUCTURED_FETCH_FAILED",
            {
              attempt,
              abort,
              message: asErrorMessage(e),
              status: lastStatus,
              bodyPreview: lastBody.slice(0, 2500),
              fileName,
              ext,
              mime,
            },
            userId,
          );

          if (abort && attempt < maxAttempts) {
            await sleep(500 + attempt * 800);
            continue;
          }
          break;
        }
      }

      if (!extractedText) {
        await failJob(jobId, userId, "Extraction failed (Unstructured timeout or error).");
        return new Response(JSON.stringify({ ok: false, error: "Extraction failed" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    const { key: openAiKey, source: openAiKeySource } = getOpenAiKey();

    // AI
    if (TP_MOCK_AI) {
      const mock = normalizeNonEmpty({
        executive_summary: {
          decisionBadge: "Proceed with caution",
          decisionLine: "Mock output. Enable real AI for a full compliance review.",
          keyFindings: [],
          nextActions: [],
          topRisks: [],
          submissionDeadline: "Not stated",
        },
        checklist: [],
        risks: [],
        buyer_questions: [],
        proposal_draft: { sections: [], sample_text: "" },
      });

      // Write EXACT columns that exist in job_results
      await supabase.from("job_results").upsert({
        job_id: jobId,
        user_id: userId,
        extracted_text: extractedText,
        checklist: mock.checklist,
        risks: mock.risks.map((r) => ({ severity: r.severity, text: `${r.title}: ${r.detail}` })),
        proposal_draft: {
          executive_summary: mock.executive_summary,
          buyer_questions: mock.buyer_questions,
          proposal_draft: mock.proposal_draft,
          full_risks: mock.risks,
          schema_version: "tp_v1",
        },
      });

      await supabase.from("jobs").update({ status: "done" }).eq("id", jobId);
      await logEvent(jobId, "job_done", "info", "Job finished (mock AI)", { openAiKeySource }, userId);

      return new Response(JSON.stringify({ ok: true, jobId, mocked: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (!openAiKey) {
      await failJob(jobId, userId, "OpenAI API key is missing.", { openAiKeySource });
      return new Response(JSON.stringify({ ok: false, error: "Missing OpenAI key" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    await logEvent(
      jobId,
      "ai_started",
      "info",
      "OpenAI generation started",
      { model: OPENAI_MODEL, openAiKeySource, extractedChars: extractedText.length },
      userId,
    );

    let aiOut: AiOutput;
    try {
      aiOut = await runOpenAiChat({
        apiKey: openAiKey,
        model: OPENAI_MODEL,
        extractedText,
        timeoutMs: OPENAI_TIMEOUT_MS,
      });
    } catch (e) {
      await logEvent(
        jobId,
        "ai_failed",
        "error",
        "OpenAI request failed",
        { message: asErrorMessage(e), openAiKeySource },
        userId,
      );
      await failJob(jobId, userId, "AI generation failed. Please try again later.", { openAiKeySource });

      return new Response(JSON.stringify({ ok: false, error: "OpenAI failed" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    await logEvent(
      jobId,
      "ai_completed",
      "info",
      "OpenAI generation completed",
      {
        model: OPENAI_MODEL,
        keyFindings: aiOut.executive_summary.keyFindings.length,
        nextActions: aiOut.executive_summary.nextActions.length,
        topRisks: aiOut.executive_summary.topRisks.length,
        checklist: aiOut.checklist.length,
        risks: aiOut.risks.length,
        buyer_questions: aiOut.buyer_questions.length,
      },
      userId,
    );

    // IMPORTANT: write ONLY columns that exist in job_results
    const uiRisks = aiOut.risks.map((r) => ({
      severity: r.severity,
      text: `${r.title}: ${r.detail}`,
    }));

    const proposalDraftPayload = {
      executive_summary: aiOut.executive_summary,
      buyer_questions: aiOut.buyer_questions,
      proposal_draft: aiOut.proposal_draft,
      full_risks: aiOut.risks, // keep detailed risks for export/debug
      schema_version: "tp_v1",
    };

    const { error: upsertErr } = await supabase.from("job_results").upsert({
      job_id: jobId,
      user_id: userId,
      extracted_text: extractedText,
      checklist: aiOut.checklist,
      risks: uiRisks,
      proposal_draft: proposalDraftPayload,
    });

    if (upsertErr) {
      await logEvent(
        jobId,
        "db_write_failed",
        "error",
        "Failed to write job_results",
        { message: upsertErr.message },
        userId,
      );
      await failJob(jobId, userId, "DB write failed while saving results.", { message: upsertErr.message });
      return new Response(JSON.stringify({ ok: false, error: "DB write failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    await supabase.from("jobs").update({ status: "done" }).eq("id", jobId);

    await logEvent(
      jobId,
      "job_done",
      "info",
      "Job finished successfully",
      { extractedChars: extractedText.length, model: OPENAI_MODEL, openAiKeySource },
      userId,
    );

    return new Response(JSON.stringify({ ok: true, jobId }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("PROCESS_JOB_ERROR", e);
    return new Response(JSON.stringify({ ok: false, error: asErrorMessage(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
