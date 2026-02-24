/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JobRow = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  source_type: "pdf" | "docx";
  status: string;
  pipeline?: any | null; // JSONB (optional in typings)
};

type Severity = "high" | "medium" | "low";

type EvidenceCandidate = {
  id: string; // e.g. E001
  excerpt: string; // verbatim text from extracted content (highlightable)
  page: number | null;
  anchor: string | null; // SECTION/ANNEX heading if available
  kind: "clause" | "bullet" | "table_row" | "other";
  score: number;
};

type AiOutput = {
  executive_summary: {
    decisionBadge: string;
    decisionLine: string;
    keyFindings: string[];
    nextActions: string[];
    topRisks: Array<{ title: string; severity: Severity; detail: string }>;
    submissionDeadline: string;
  };
  checklist: Array<{
    type: "MUST" | "SHOULD" | "INFO";
    text: string;
    evidence_ids?: string[]; // MUST/RISK should cite at least one evidence id
    // Evidence-first reliability flags (stored in JSON; schema unchanged)
    needs_verification?: boolean;
    verification_reason?: string;
    // Backfilled by backend for UI compatibility
    source?: string;
  }>;
  risks: Array<{
    title: string;
    severity: Severity;
    detail: string;
    evidence_ids?: string[];
    needs_verification?: boolean;
    verification_reason?: string;
    // Backfilled by backend for UI compatibility
    source?: string;
  }>;
  buyer_questions: string[];
  proposal_draft: string;
  // Note: OpenAI strict schema requires `rule` to be present; we allow null when unavailable.
  policy_triggers: Array<{ key: string; impact: "blocks" | "increases_risk" | "decreases_fit" | "requires_clarification"; note: string; rule: string | null }>;
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


// ---- Lease / heartbeat / runtime guards (Stage 2 stabilization) ----
const JOB_LEASE_MS = parseNumberEnv("TP_JOB_LEASE_MS", 5 * 60 * 1000); // default 5 min
const HEARTBEAT_MS = parseNumberEnv("TP_JOB_HEARTBEAT_MS", 15 * 1000); // default 15s
const MAX_RUNTIME_MS = parseNumberEnv("TP_MAX_RUNTIME_MS", 55 * 1000); // default 55s; set env to tune (keep <= platform limit)
const RUNTIME_BUFFER_MS = parseNumberEnv("TP_RUNTIME_BUFFER_MS", 2_000); // safety buffer
const RUNTIME_SAFETY_MS = parseNumberEnv("TP_RUNTIME_SAFETY_MS", 2 * 1000); // buffer

function leaseCutoffISO(): string {
  return new Date(Date.now() - JOB_LEASE_MS).toISOString();
}

// Best-effort: make a stuck "processing" job reclaimable on the next tick without changing lifecycle.
async function makeJobReclaimableNow(supabaseAdmin: any, jobId: string) {
  const staleISO = new Date(Date.now() - JOB_LEASE_MS - 10_000).toISOString();
  try {
    await supabaseAdmin.from("jobs").update({ updated_at: staleISO }).eq("id", jobId);
  } catch {
    // swallow (best-effort)
  }
}

async function tryClaimWithLease(
  supabaseAdmin: any,
  jobId: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const cutoff = leaseCutoffISO();

  // 1) Try to claim queued
  {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .update({ status: "processing", updated_at: nowIso })
      .eq("id", jobId)
      .eq("status", "queued")
      .select("id");

    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) return true;
  }

  // 2) Try to reclaim stale processing (lease expired)
  {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .update({ status: "processing", updated_at: nowIso })
      .eq("id", jobId)
      .eq("status", "processing")
      .lt("updated_at", cutoff)
      .select("id");

    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  }
}


function startHeartbeat(supabaseAdmin: any, jobId: string, maxMs = 90_000) {
  const startedAt = Date.now();

  const timer = setInterval(() => {
    // DO NOT make this callback `async` (can surface unhandled rejections in edge runtime).
    void (async () => {
      try {
        if (Date.now() - startedAt > maxMs) {
          clearInterval(timer);
          return;
        }
        await supabaseAdmin
          .from("jobs")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", jobId)
          .eq("status", "processing");
      } catch {
        // never throw from heartbeat
      }
    })();
  }, HEARTBEAT_MS);

  return () => clearInterval(timer);
}

function remainingRuntimeMs(startMs: number): number {
  return MAX_RUNTIME_MS - (Date.now() - startMs);
}

function clampText(input: string, maxChars: number) {
  const txt = String(input ?? "");
  if (txt.length <= maxChars) return { text: txt, truncated: false };

  // Keep submission instructions / annex references more often by preserving tail content.
  const marker = "\n\n[CONTENT SKIPPED DUE TO SIZE]\n\n";
  const budget = Math.max(0, maxChars - marker.length);

  const headLen = Math.max(0, Math.floor(budget * 0.7));
  const tailLen = Math.max(0, budget - headLen);

  const head = txt.slice(0, headLen).trimEnd();
  const tail = tailLen > 0 ? txt.slice(Math.max(0, txt.length - tailLen)).trimStart() : "";

  return { text: (head + marker + tail).slice(0, maxChars), truncated: true };
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
  supabaseAdmin: any,
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

async function loadWorkspacePlaybookAdmin(
  supabaseAdmin: any,
  workspaceId: string,
): Promise<{ playbook: any | null; version: number | null }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("workspace_playbooks")
      .select("playbook,version")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) throw error;

    const pb = (data as any)?.playbook;
    const playbook = pb && typeof pb === "object" ? pb : null;

    const vRaw = Number((data as any)?.version ?? NaN);
    const version = Number.isFinite(vRaw) && vRaw > 0 ? Math.round(vRaw) : null;

    return { playbook, version };
  } catch {
    // Best-effort. If the table is not deployed yet, do not block processing.
    return { playbook: null, version: null };
  }
}

/**
 * Unstructured Hosted API extraction (Edge-compatible)
 * Returns text derived from Unstructured elements, augmented with conservative PAGE / SECTION / ANNEX anchors.
 *
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
  const safeBytes = Uint8Array.from(args.fileBytes);
  form.append("files", new Blob([safeBytes], { type: args.contentType }), args.fileName);

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

  return buildAnchoredTextFromUnstructuredElements(json);
}
/**
 * Mistral Document AI OCR extraction (Edge-compatible)
 * Uses a public/signed URL so we don't need to upload bytes.
 *
 * Endpoint: POST https://api.mistral.ai/v1/ocr
 * Model default: mistral-ocr-latest
 */
async function extractWithMistralOcr(args: {
  documentUrl: string;
  model?: string;
  tableFormat?: "markdown" | "html";
  extractHeader?: boolean;
  extractFooter?: boolean;
}): Promise<{ text: string; model: string; pages: number }> {
  const apiKey = firstEnv(["MISTRAL_API_KEY", "TP_MISTRAL_API_KEY"], "MISTRAL_API_KEY");
  const apiUrl = String(Deno.env.get("MISTRAL_OCR_URL") ?? "https://api.mistral.ai/v1/ocr");
  const model = String(args.model ?? Deno.env.get("MISTRAL_OCR_MODEL") ?? "mistral-ocr-latest");

  const timeoutMs = parseNumberEnv("MISTRAL_TIMEOUT_MS", 120_000);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model,
      document: {
        type: "document_url",
        document_url: args.documentUrl,
      },
    };

    // Prefer inline markdown tables unless you explicitly want separate html/markdown tables.
    // If you set table_format, Mistral may return placeholders like [tbl-x.html] and tables in a separate field.
    if (args.tableFormat) body.table_format = args.tableFormat;

    if (typeof args.extractHeader === "boolean") body.extract_header = args.extractHeader;
    if (typeof args.extractFooter === "boolean") body.extract_footer = args.extractFooter;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Mistral OCR error ${res.status}: ${txt.slice(0, 600)}`);
    }

    const json = await res.json();

    const pages = Array.isArray(json?.pages) ? json.pages : [];
    const usedModel = String(json?.model ?? model);

    const parts: string[] = [];
    for (const p of pages) {
      const idx = Number(p?.index);
      const pageNum = Number.isFinite(idx) ? idx + 1 : null;
      if (pageNum) parts.push(`[PAGE ${pageNum}]`);

      // If you enable extract_header/extract_footer, you can optionally surface them like this:
      // const header = typeof p?.header === "string" ? p.header.trim() : "";
      // if (header) parts.push(`HEADER: ${header}`);

      const md = typeof p?.markdown === "string" ? p.markdown.trim() : "";
      if (md) parts.push(md);

      // const footer = typeof p?.footer === "string" ? p.footer.trim() : "";
      // if (footer) parts.push(`FOOTER: ${footer}`);
    }

    const text = parts.join("\n\n").trim();

    return { text, model: usedModel, pages: pages.length };
  } finally {
    clearTimeout(t);
  }
}


function normalizeAnchorLabel(label: string): string {
  return String(label ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function elementPageNumber(el: any): number | null {
  const n = el?.metadata?.page_number ?? el?.metadata?.page_num ?? el?.metadata?.page ?? null;
  const num = Number(n);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function unstructuredCategory(el: any): string {
  const cat = el?.type ?? el?.category ?? "";
  return String(cat ?? "").toLowerCase();
}

function looksLikeAnnexOrAppendix(t: string): boolean {
  const s = String(t ?? "").trim();
  return /^(annex|appendix|schedule)\b/i.test(s);
}

function looksLikeMajorNumberHeading(t: string): { num: string; title: string } | null {
  // "5. Tenderer's Responsibilities"
  const m = String(t ?? "").trim().match(/^(\d+)\.\s+(.{3,})$/);
  if (!m) return null;
  return { num: m[1], title: m[2].trim() };
}

function looksLikeClauseNumber(t: string): { num: string; rest: string } | null {
  // "5.4 The tenderer shall ..."
  const m = String(t ?? "").trim().match(/^(\d+(?:\.\d+)+)\s+(.{3,})$/);
  if (!m) return null;
  return { num: m[1], rest: m[2].trim() };
}

function looksLikeSectionHeading(t: string): boolean {
  const s = String(t ?? "").trim();
  if (!s) return false;

  // Common tender headings
  if (
    /^instructions to tenderers\b/i.test(s) ||
    /^instructions for (tenderers|bidders)\b/i.test(s) ||
    /^instructions to bidders\b/i.test(s) ||
    /^evaluation( criteria)?\b/i.test(s) ||
    /^submission( instructions)?\b/i.test(s) ||
    /^how to submit\b/i.test(s) ||
    /^eligibility\b/i.test(s) ||
    /^qualification\b/i.test(s) ||
    /^terms and conditions\b/i.test(s) ||
    /^contract(ual)?\b/i.test(s)
  ) return true;

  // Title-like headings: short, no trailing punctuation
  if (s.length <= 90 && !/[.!?]$/.test(s) && (s.match(/[;:]/g) ?? []).length <= 1) return true;

  return false;
}

function buildAnchoredTextFromUnstructuredElements(elements: any[]): string {
  const parts: string[] = [];
  let lastPage: number | null = null;

  // Keep context for numeric headings (e.g., "5. Tenderer's Responsibilities" for "5.4 ...")
  let currentMajorHeadingNum: string | null = null;
  let currentMajorHeadingTitle: string | null = null;

  for (const el of elements) {
    const raw = typeof el?.text === "string" ? el.text.trim() : "";
    if (!raw) continue;

    const page = elementPageNumber(el);
    if (page && page !== lastPage) {
      parts.push(`[PAGE ${page}]`);
      lastPage = page;
    }

    const cat = unstructuredCategory(el);
    const isTitleish =
      cat.includes("title") ||
      cat.includes("header") ||
      cat.includes("heading") ||
      cat.includes("section") ||
      cat.includes("subtitle");

    // ANNEX / APPENDIX anchors only when explicit
    if (looksLikeAnnexOrAppendix(raw)) {
      parts.push(`ANNEX: ${normalizeAnchorLabel(raw)}`);
      parts.push(raw);
      continue;
    }

    // Numeric major heading
    const major = looksLikeMajorNumberHeading(raw);
    if (major) {
      currentMajorHeadingNum = major.num;
      currentMajorHeadingTitle = major.title;
      parts.push(`SECTION ${major.num} – ${normalizeAnchorLabel(major.title)}`);
      parts.push(raw);
      continue;
    }

    // Numeric clause anchor (e.g., 5.4)
    const clause = looksLikeClauseNumber(raw);
    if (clause) {
      let suffix = "";
      if (currentMajorHeadingNum && clause.num.startsWith(currentMajorHeadingNum + ".") && currentMajorHeadingTitle) {
        suffix = ` – ${normalizeAnchorLabel(currentMajorHeadingTitle)}`;
      }
      parts.push(`SECTION ${clause.num}${suffix}`);
      parts.push(raw);
      continue;
    }

    // Other headings
    if (isTitleish || looksLikeSectionHeading(raw)) {
      parts.push(`SECTION: ${normalizeAnchorLabel(raw)}`);
    }

    parts.push(raw);
  }

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

SECTION: Submission instructions
Bidders must submit their proposal via the portal.

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
        "Drafting support only. Verify mandatory requirements and deadlines against the source tender.",
      keyFindings: [
        "Submission deadline appears present and should be confirmed",
        "Several mandatory requirements exist that may affect eligibility",
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
      { type: "MUST", text: "Provide 24/7 incident intake with 30 minute response time for critical incidents", source: "Not found in extracted text" },
      { type: "MUST", text: "Provide a dedicated service manager as single point of contact", source: "Not found in extracted text" },
      { type: "MUST", text: "Demonstrate ISO 27001 certification or equivalent controls", source: "Not found in extracted text" },
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
    policy_triggers: [],
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
  evidenceCandidates: EvidenceCandidate[];
  maxOutputTokens: number;
  timeoutMs?: number;
  workspacePlaybook?: { playbook: any; version: number | null } | null;
}): Promise<AiOutput> {
  const { apiKey, model, extractedText, evidenceCandidates, maxOutputTokens, timeoutMs, workspacePlaybook } = args;

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
            evidence_ids: { type: "array", items: { type: "string" } },
          },
          required: ["type", "text", "evidence_ids"],
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
            evidence_ids: { type: "array", items: { type: "string" } },
          },
          required: ["title", "severity", "detail", "evidence_ids"],
        },
      },
      buyer_questions: { type: "array", items: { type: "string" } },
      proposal_draft: { type: "string" },
      policy_triggers: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: {
              type: "string",
              enum: [
                "industry_tags",
                "offerings_summary",
                "delivery_geographies",
                "languages_supported",
                "delivery_modes",
                "capacity_band",
                "typical_lead_time_weeks",
                "certifications",
                "non_negotiables",
              ],
            },
            impact: {
              type: "string",
              enum: ["blocks", "increases_risk", "decreases_fit", "requires_clarification"],
            },
            note: { type: "string" },
            // OpenAI strict JSON schema requires every property to be listed in `required`.
            // Keep `rule` nullable so the model can return null when it cannot provide a stable rule id.
            rule: { type: ["string", "null"] },
          },
          required: ["key", "impact", "note", "rule"],
        },
      },
    },
    required: ["executive_summary", "checklist", "risks", "buyer_questions", "proposal_draft", "policy_triggers"],
  };

  const instructions =
    "You are TenderPilot. Drafting support only. Not legal advice. Not procurement advice. " +
    "Use executive, compliance grade language. No AI talk. " +
    "Always write in the same language as the tender source text. " +
    "Avoid false certainty. If not present, write: Not found in extracted text.";

  const evidenceList = evidenceCandidates
    .map((e) => {
      const page = e.page != null ? ` [PAGE ${e.page}]` : "";
      const anchor = e.anchor ? ` ${e.anchor}` : "";
      return `${e.id}${page}${anchor}: ${e.excerpt}`;
    })
    .join("\n\n");

  const playbookJson = (() => {
    try {
      const pb = workspacePlaybook?.playbook;
      if (!pb || typeof pb !== "object") return "Not provided.";
      const raw = JSON.stringify(pb, null, 2);
      if (!raw) return "Not provided.";
      const cap = 3500;
      return raw.length > cap ? raw.slice(0, cap) + "\n[TRUNCATED]" : raw;
    } catch {
      return "Not provided.";
    }
  })();

  const playbookVersionLabel = workspacePlaybook?.version ? String(workspacePlaybook.version) : "Not provided";


  const userPrompt = `Task
Review the tender source text and produce a decision-first bid kit.

Workspace Bid Playbook (policy constraints, NOT evidence)
Version: ${playbookVersionLabel}
${playbookJson}

Strict rules
1. Grounding. Use only the evidence snippets provided. Do not guess. If a detail is not present, write: Not found in extracted text.
2. Decision. Choose decisionBadge exactly as one of: Proceed, Proceed with caution, Hold – potential blocker. Provide decisionLine as one clear sentence.
3. Submission deadline. If an explicit deadline date or time is present, copy it verbatim. Otherwise set submissionDeadline to: Not found in extracted text.
4. Checklist. MUST means mandatory or disqualifying if missed. SHOULD means preferred or scoring. INFO is context.
5. Evidence (STRICT). You MUST cite evidence_ids:
   - For each MUST checklist item: include at least one evidence id that directly proves it.
   - For each risk: include at least one evidence id that supports it.
   - Do not invent clause numbers or cross-references (e.g., ITT 24.1). Cite only evidence ids.
   - If you cannot support a MUST or a risk with evidence, downgrade it to INFO and add a buyer question for manual verification.
6. Playbook (STRICT). The playbook is policy, not evidence:
   - Never cite the playbook as evidence.
   - If the playbook influences decision, prioritization, or required actions, add entries to policy_triggers.
   - When you claim a conflict with the playbook, cite evidence ids that support the tender-side requirement driving the conflict.
7. Policy triggers output (REQUIRED):
   - policy_triggers must be an array. If no playbook constraints apply, return an empty array.
   - Each trigger must be one line, auditable, and map to a playbook key.
8. Deduplication. Do not repeat checklist items verbatim inside the executive summary.
9. Missing info. Put ambiguities or missing info into buyer_questions.

Evidence snippets (use ONLY these; cite their ids in evidence_ids):
${evidenceList}

Tender source text (context only; do not cite directly):
${extractedText}`;


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
        name: "TenderPilot_review",
        schema,
      },
    },
  };

  const reqTimeoutMs = Math.max(3_000, Math.min(timeoutMs ?? 60_000, 90_000));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), reqTimeoutMs);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (String(e).toLowerCase().includes("abort")) {
      throw new Error(`OpenAI request timed out after ${reqTimeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  return parseOpenAiJsonFromResponse(json) as AiOutput;
}


function buildEvidenceCandidates(extractedText: string): EvidenceCandidate[] {
  const raw = String(extractedText ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  // Heuristic: skip an initial title block until we hit TABLE OF CONTENTS or a clear section header.
  const titleSkipUntil = (() => {
    const maxScan = Math.min(lines.length, 80);
    for (let i = 0; i < maxScan; i++) {
      const t = lines[i].toLowerCase();
      if (t.includes("table of contents")) return i + 1;
      if (/^section\s+\w+/i.test(lines[i])) return i;
      if (/^invitation to tender/i.test(lines[i])) return i;
    }
    return 0;
  })();

  const normativeRe =
    /\b(shall not|shall|must not|must|required|is required|are required|will be rejected|disqualified|rejection)\b/i;

  const moneyRe = /\b(kshs?|kes|eur|usd|gbp)\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/i;
  const deadlineRe =
    /\b(deadline|closing|submit|delivered|on or before|no later than)\b/i;
  const dateRe =
    /\b(\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2})\b/i;
  const timeRe = /\b(\d{1,2}[:.]\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm))\b/i;
  const submissionRe = /\b(sealed envelope|envelope|copies|original|physically|electronic|online portal|upload|address|p\.o\. box|po box)\b/i;
  const securityRe = /\b(tender security|bid security|tender-secure|guarantee|security)\b/i;

  const isTocLike = (s: string): boolean => /\.\.{4,}/.test(s) || s.toLowerCase().includes("table of contents");
  const isTitleLike = (s: string): boolean => {
    const t = s.trim();
    if (!t) return false;
    const low = t.toLowerCase();
    if (
      low.startsWith("standard tender document") ||
      low.startsWith("tender document for") ||
      low.startsWith("request for") ||
      low.startsWith("invitation to tender")
    ) return true;

    const hasVerb = normativeRe.test(t);
    if (!hasVerb && t === t.toUpperCase() && t.length < 140) return true;

    return false;
  };

  const candidates: EvidenceCandidate[] = [];
  const seen = new Set<string>();

  const getAnchor = (i: number): string | null => {
    for (let j = i; j >= 0 && j >= i - 8; j--) {
      const l = lines[j];
      if (/^\[page\s+\d+\]/i.test(l)) continue;
      if (/^(section|annex|appendix|part)\b/i.test(l)) return l;
      // all-caps headings (but avoid TOC lines)
      if (l === l.toUpperCase() && l.length >= 12 && l.length <= 120 && !isTocLike(l)) return l;
    }
    return null;
  };

  const getPage = (i: number): number | null => {
    for (let j = i; j >= 0 && j >= i - 30; j--) {
      const m = lines[j].match(/^\[page\s+(\d+)\]/i);
      if (m) return Number(m[1]);
    }
    return null;
  };

  const scoreLine = (l: string): number => {
    let score = 0;
    if (normativeRe.test(l)) score += 6;
    if (deadlineRe.test(l)) score += 3;
    if (dateRe.test(l) || timeRe.test(l)) score += 3;
    if (submissionRe.test(l)) score += 2;
    if (securityRe.test(l)) score += 2;
    if (moneyRe.test(l)) score += 1;
    if (/\bnot permitted\b/i.test(l)) score += 2;
    return score;
  };

  const makeExcerpt = (i: number): string => {
    // window of up to 3 lines (current + neighbors) to keep it highlightable
    const parts: string[] = [];
    const anchor = getAnchor(i);
    if (anchor && !isTitleLike(anchor) && !isTocLike(anchor)) parts.push(anchor);

    for (const k of [i - 1, i, i + 1]) {
      if (k >= 0 && k < lines.length) {
        const v = lines[k];
        if (!isTocLike(v) && !isTitleLike(v)) parts.push(v);
      }
    }

    let excerpt = parts.join(" ").replace(/\s+/g, " ").trim();
    if (excerpt.length > 480) excerpt = excerpt.slice(0, 480).trim();
    return excerpt;
  };

  let idCounter = 1;
  for (let i = titleSkipUntil; i < lines.length; i++) {
    const l = lines[i];
    if (isTocLike(l) || isTitleLike(l)) continue;

    const score = scoreLine(l);
    if (score < 5) continue; // keep precision high

    const excerpt = makeExcerpt(i);
    if (!excerpt || excerpt.length < 30) continue;
    if (isTocLike(excerpt) || isTitleLike(excerpt)) continue;

    const key = excerpt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const kind: EvidenceCandidate["kind"] =
      /^[•\-]\s+/.test(l) ? "bullet" : /\btable\b/i.test(l) ? "table_row" : "clause";

    candidates.push({
      id: `E${String(idCounter++).padStart(3, "0")}`,
      excerpt,
      page: getPage(i),
      anchor: getAnchor(i),
      kind,
      score,
    });

    if (candidates.length >= 240) break; // cap for prompt size
  }

  // Sort by score desc, then shorter excerpts first (better highlightability)
  return candidates
    .sort((a, b) => (b.score - a.score) || (a.excerpt.length - b.excerpt.length))
    .slice(0, 220);
}

	const corsHeaders = {
	  "Access-Control-Allow-Origin": "*",
	  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	  "Access-Control-Allow-Methods": "POST, OPTIONS",
	};

	// Helper so every response includes CORS headers
	function corsResponse(body: BodyInit | null, init: ResponseInit = {}) {
	  return new Response(body, {
		...init,
		headers: {
		  ...corsHeaders,
		  ...(init.headers ?? {}),
		},
	  });
	}


	function corsJson(payload: unknown, init: ResponseInit = {}) {
	  return corsResponse(JSON.stringify(payload), {
		...init,
		headers: {
		  "content-type": "application/json",
		  ...(init.headers ?? {}),
		},
	  });
	}

	function normalizeThrownError(e: unknown) {
	  if (e instanceof Error) {
		return { name: e.name, message: e.message, stack: e.stack };
	  }
	  try {
		return { name: "NonErrorThrown", message: JSON.stringify(e) };
	  } catch {
		return { name: "NonErrorThrown", message: String(e) };
	  }
	}

	// Prevent edge runtime from turning unhandled promise rejections into text/plain 500s.
	// We still return JSON from the request handler.
	addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
	  try { ev.preventDefault(); } catch {}
	  console.error("unhandledrejection:", ev.reason);
	});
	addEventListener("error", (ev: ErrorEvent) => {
	  try { ev.preventDefault(); } catch {}
	  console.error("error:", ev.message);
	});

Deno.serve(async (req) => {
  let activeJobId: string | null = null;
  // CORS preflight
  if (req.method === "OPTIONS") return corsResponse("ok");

  try {
    const url = new URL(req.url);

    // Optional shared-secret gate (recommended for pg_net/cron callers)
    const expectedSecret = String(Deno.env.get("TP_SECRET") ?? "").trim();
    if (expectedSecret) {
      const provided = String(url.searchParams.get("tp_secret") ?? "").trim();
      if (!provided || provided !== expectedSecret) {
        return corsResponse(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // pg_net often calls with GET, so allow GET + POST
    if (req.method !== "POST" && req.method !== "GET") {
      return corsResponse("Method Not Allowed", { status: 405 });
    }

    const SUPABASE_URL = firstEnv(["SUPABASE_URL"], "SUPABASE_URL");
    const SERVICE_ROLE = firstEnv(["SUPABASE_SERVICE_ROLE_KEY"], "SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // DEBUG: prove which Supabase project/DB this function is using
    try {
      const u = String(SUPABASE_URL || "");
      const host = (() => { try { return new URL(u).host; } catch { return ""; } })();
      const projectRef = host ? host.split(".")[0] : "";
      console.log("process-job DEBUG env:", {
        SUPABASE_URL: u,
        projectRef,
        has_TP_SUPABASE_URL: !!Deno.env.get("TP_SUPABASE_URL"),
        has_TP_SERVICE_ROLE_KEY: !!Deno.env.get("TP_SERVICE_ROLE_KEY"),
        has_SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
        has_SUPABASE_DB_URL: !!Deno.env.get("SUPABASE_DB_URL"),
      });
    } catch (e) {
      console.log("process-job DEBUG env log failed:", e);
    }

    // ---- Robust job id extraction (supports pg_net tick calls with no body) ----
    const qpJobId =
      url.searchParams.get("job_id") ||
      url.searchParams.get("jobId") ||
      url.searchParams.get("id") ||
      "";

    let parsed: any = {};
    let rawBody = "";

    // Only attempt body parsing for POST; never throw if empty/invalid
    if (req.method === "POST") {
      try {
        rawBody = await req.text();
      } catch {
        rawBody = "";
      }
      if (rawBody && rawBody.trim().length > 0) {
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = {};
        }
      }
    }

    let jobId =
      (typeof qpJobId === "string" && qpJobId) ||
      (typeof parsed?.job_id === "string" && parsed.job_id) ||
      (typeof parsed?.jobId === "string" && parsed.jobId) ||
      (typeof parsed?.id === "string" && parsed.id) ||
      (typeof parsed?.record?.id === "string" && parsed.record.id) ||
      "";

    // Helper: find the next claimable job id (queued OR stale processing)
    async function findNextClaimableJobId(): Promise<string | null> {
      const cutoff = leaseCutoffISO();
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("id")
        .or(`status.eq.queued,and(status.eq.processing,updated_at.lt.${cutoff})`)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (error) throw error;
      return data?.id ?? null;
    }

    // If caller didn't supply jobId (pg_net tick style), claim-next
    if (!jobId) {
      let claimedJobId: string | null = null;

      // Try a few times to avoid races when multiple ticks fire
      for (let i = 0; i < 3; i++) {
        const candidate = await findNextClaimableJobId();
        if (!candidate) break;
        const ok = await tryClaimWithLease(supabaseAdmin, candidate);
        if (ok) {
          claimedJobId = candidate;
          break;
        }
      }

      if (!claimedJobId) {
        return corsResponse(JSON.stringify({ ok: true, status: "idle" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      jobId = claimedJobId;
    } else {
      // Caller supplied a jobId: claim it with lease rules
      const claimed = await tryClaimWithLease(supabaseAdmin, jobId);
      if (!claimed) {
        return corsResponse(JSON.stringify({ ok: true, status: "already_claimed" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Track claimed job id for cleanup on unexpected failure
    activeJobId = jobId;

    // Fetch job after claim
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status,pipeline")
      .eq("id", jobId)
      .single<JobRow>();

    if (jobErr || !job) {
      return corsResponse(JSON.stringify({ ok: true, status: "not_found" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const startMs = Date.now();
    let stopHeartbeat: null | (() => void) = null;

    // Heartbeat to keep lease fresh
    stopHeartbeat = startHeartbeat(supabaseAdmin, job.id);

    const remainingMs = () => MAX_RUNTIME_MS - (Date.now() - startMs);

    const yieldIfLowTime = async () => {
      if (remainingMs() <= RUNTIME_BUFFER_MS) {
        if (stopHeartbeat) stopHeartbeat();
        await makeJobReclaimableNow(supabaseAdmin, job.id);
        return corsResponse(JSON.stringify({ ok: true, status: "yield" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return null;
    };

    const earlyYield = await yieldIfLowTime();
    if (earlyYield) return earlyYield;

    await logEvent(supabaseAdmin, job, "info", "Job claimed and processing started", {
      lease_ms: JOB_LEASE_MS,
      heartbeat_ms: HEARTBEAT_MS,
    });

    const useMockExtract = flagEnv("TP_MOCK_EXTRACT");
    const useMockAi = flagEnv("TP_MOCK_AI");

    
    // If the client already provided a fast-path extracted_text (PDF.js), reuse it.
    // This avoids slow/unreliable large-doc extraction on the Edge function.
    const { data: existingResult } = await supabaseAdmin
      .from("job_results")
      .select("extracted_text")
      .eq("job_id", job.id)
      .maybeSingle();

    const existingExtracted = String(existingResult?.extracted_text ?? "").trim();
let extractedText = "";
    let evidenceCandidates: EvidenceCandidate[] = [];

    if (existingExtracted) {
      extractedText = existingExtracted;
      evidenceCandidates = buildEvidenceCandidates(extractedText);
      await logEvent(supabaseAdmin, job, "info", "Using pre-extracted text (fast path)", { chars: extractedText.length, evidenceCandidates: evidenceCandidates.length });
    } else if (useMockExtract) {
      extractedText = mockExtractFixture({ sourceType: job.source_type, fileName: job.file_name });
      evidenceCandidates = buildEvidenceCandidates(extractedText);
      await logEvent(supabaseAdmin, job, "info", "Mock extract enabled", { chars: extractedText.length, evidenceCandidates: evidenceCandidates.length });
    } else {
      // Prefer server-side signed URL for extractor providers (no byte upload, supports pdf/docx).
      const signedExpirySeconds = parseNumberEnv("TP_EXTRACT_SIGNED_URL_TTL_S", 600);

      const { data: signed, error: signedErr } = await supabaseAdmin
        .storage
        .from("uploads")
        .createSignedUrl(job.file_path, signedExpirySeconds);

      const signedUrl = String(signed?.signedUrl ?? "").trim();

      // Provider switch: keep Unstructured during test, switch to Mistral by env.
      const provider = String(Deno.env.get("TP_EXTRACT_PROVIDER") ?? "unstructured").trim().toLowerCase();
      const allowFallbackToUnstructured = flagEnv("TP_MISTRAL_FALLBACK_UNSTRUCTURED") || provider !== "mistral";

      const contentType =
        job.source_type === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      // If we cannot create a signed URL, fall back to storage download (needed for Unstructured).
      if (!signedUrl) {
        await logEvent(supabaseAdmin, job, "warn", "Signed URL creation failed; falling back to storage download", {
          error: signedErr?.message ?? null,
          provider,
        });

        const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(job.file_path);

        if (dlErr || !fileData) {
          await logEvent(supabaseAdmin, job, "error", "Storage download failed", { error: dlErr?.message });
          await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
          return new Response("Download failed", { status: 500 });
        }

        const bytes = new Uint8Array(await fileData.arrayBuffer());

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

        evidenceCandidates = buildEvidenceCandidates(extractedText);

        await logEvent(
          supabaseAdmin,
          job,
          extractedText ? "info" : "warn",
          extractedText ? "Unstructured extract completed" : "Unstructured extract returned empty text",
          { chars: extractedText.length, evidenceCandidates: evidenceCandidates.length },
        );
      } else {
        // Signed URL available: use provider selected (Mistral or Unstructured).
        if (provider === "mistral") {
          await logEvent(supabaseAdmin, job, "info", "Mistral OCR extract started", {
            fileName: job.file_name,
            sourceType: job.source_type,
            signedUrl: "[redacted]",
          });

          try {
            const res = await extractWithMistralOcr({
              documentUrl: signedUrl,
              // You can set tableFormat="html" if you want table placeholders + separate html tables.
              // Leaving it undefined keeps tables inline in markdown.
            });

            extractedText = res.text;

            await logEvent(
              supabaseAdmin,
              job,
              extractedText ? "info" : "warn",
              extractedText ? "Mistral OCR extract completed" : "Mistral OCR extract returned empty text",
              { chars: extractedText.length, pages: res.pages, model: res.model },
            );
          } catch (e) {
            await logEvent(supabaseAdmin, job, "warn", "Mistral OCR extract failed", {
              error: (e as Error)?.message ?? String(e),
              allowFallbackToUnstructured,
            });

            if (!allowFallbackToUnstructured) throw e;

            // Fallback to Unstructured (test phase safety net)
            const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(job.file_path);

            if (dlErr || !fileData) {
              await logEvent(supabaseAdmin, job, "error", "Storage download failed after Mistral failure", { error: dlErr?.message });
              await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
              return new Response("Download failed", { status: 500 });
            }

            const bytes = new Uint8Array(await fileData.arrayBuffer());

            await logEvent(supabaseAdmin, job, "info", "Unstructured extract started (fallback)", {
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

            await logEvent(
              supabaseAdmin,
              job,
              extractedText ? "info" : "warn",
              extractedText ? "Unstructured extract completed (fallback)" : "Unstructured extract returned empty text (fallback)",
              { chars: extractedText.length },
            );
          }

          evidenceCandidates = buildEvidenceCandidates(extractedText);
        } else {
          // Keep your current behavior: Unstructured is the fallback provider
          const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(job.file_path);

          if (dlErr || !fileData) {
            await logEvent(supabaseAdmin, job, "error", "Storage download failed", { error: dlErr?.message });
            await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
            return new Response("Download failed", { status: 500 });
          }

          const bytes = new Uint8Array(await fileData.arrayBuffer());

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

          evidenceCandidates = buildEvidenceCandidates(extractedText);

          await logEvent(
            supabaseAdmin,
            job,
            extractedText ? "info" : "warn",
            extractedText ? "Unstructured extract completed" : "Unstructured extract returned empty text",
            { chars: extractedText.length, evidenceCandidates: evidenceCandidates.length },
          );
        }
      }
    }

    // Persist evidence candidates for evidence-first UI (Option A).
    // We store a bounded evidence map in jobs.pipeline.evidence so the UI can render deterministic
    // excerpts by evidence_id without searching/parsing extracted_text.
    try {
      const existingPipeline = (job as any)?.pipeline && typeof (job as any).pipeline === "object"
        ? (job as any).pipeline
        : {};

      const bounded = (evidenceCandidates ?? [])
        .slice(0, parseNumberEnv("TP_PIPELINE_EVIDENCE_MAX", 160))
        .map((e) => ({
          id: e.id,
          excerpt: e.excerpt,
          page: e.page,
          anchor: e.anchor,
          kind: e.kind,
          score: e.score,
        }));

      const nextPipeline = {
        ...existingPipeline,
        evidence: {
          version: 1,
          generated_at: new Date().toISOString(),
          candidates: bounded,
        },
      };

      const { error: pipeErr } = await supabaseAdmin
        .from("jobs")
        .update({ pipeline: nextPipeline })
        .eq("id", job.id);

      if (pipeErr) {
        await logEvent(supabaseAdmin, job, "warn", "Pipeline evidence save failed", { error: pipeErr.message });
      } else {
        await logEvent(supabaseAdmin, job, "info", "Pipeline evidence saved", { candidates: bounded.length });
      }
    } catch (e) {
      await logEvent(supabaseAdmin, job, "warn", "Pipeline evidence save threw", { error: (e as Error)?.message ?? String(e) });
    }


    // AI analysis
    const model = String(Deno.env.get("TP_OPENAI_MODEL") ?? "gpt-4.1-mini");
    const maxInputChars = parseNumberEnv("TP_MAX_INPUT_CHARS", 120_000);
    const maxOutputTokens = parseNumberEnv("TP_MAX_OUTPUT_TOKENS", 1800);
    const maxUsdPerJob = parseNumberEnv("TP_MAX_USD_PER_JOB", 0.05);

    let aiOut: AiOutput;
    let playbookVersion: number | null = null;

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

      const remaining = remainingRuntimeMs(startMs);

      // If we are too close to runtime limit, yield and make the job reclaimable immediately.
      if (remaining <= 7_000) {
        await logEvent(supabaseAdmin, job, "warn", "Yielding due to runtime budget", { remaining_ms: remaining });
        await makeJobReclaimableNow(supabaseAdmin, job.id);

        return corsResponse(JSON.stringify({ ok: true, status: "yield" }), {
          headers: { "content-type": "application/json" },
        });
      }

      const workspacePlaybook = await loadWorkspacePlaybookAdmin(supabaseAdmin, job.user_id);
      playbookVersion = workspacePlaybook.version;
      if (workspacePlaybook.playbook) {
        await logEvent(supabaseAdmin, job, "info", "Workspace playbook loaded", {
          version: workspacePlaybook.version,
        });
      }

      await logEvent(supabaseAdmin, job, "info", "OpenAI started", { model, maxOutputTokens, remaining_ms: remaining });

      // Configurable OpenAI timeout cap (default 35s)
      const openAiTimeoutCap = parseNumberEnv("OPENAI_TIMEOUT_MS", 35_000);

      // Give OpenAI only the remaining budget minus a safety buffer, but cap by OPENAI_TIMEOUT_MS
      const timeoutMs = Math.max(
        3_000,
        Math.min(
          remaining - RUNTIME_SAFETY_MS,
          Math.max(5_000, openAiTimeoutCap),
        ),
      );

      aiOut = await runOpenAi({ apiKey, model, extractedText: clipped, evidenceCandidates, maxOutputTokens, timeoutMs, workspacePlaybook });
      await logEvent(supabaseAdmin, job, "info", "OpenAI completed", { model, maxOutputTokens });
    }


    // Evidence-first normalization (product-grade):
    // - AI should cite evidence_ids for MUST checklist items and for risks.
    // - Backend backfills `source` (UI compatibility) from the referenced evidence excerpt(s).
    // - If evidence_ids are missing/unresolvable, we DO NOT reshape semantics (no downgrades / no moving risks).
    //   Instead we flag `needs_verification` so the UI can surface "Decision-grade" reliability.
    {
      const evidenceById = new Map<string, EvidenceCandidate>();
      for (const e of evidenceCandidates) evidenceById.set(e.id, e);

      const resolveSource = (ids?: string[]): { ids: string[]; source: string | null } => {
        const valid = (ids ?? []).filter((id) => evidenceById.has(id));
        if (valid.length === 0) return { ids: [], source: null };
        // For highlighting, keep a single contiguous excerpt (best = first id)
        const first = evidenceById.get(valid[0])!;
        return { ids: valid, source: first.excerpt };
      };

      const missingEvidenceReason = "No resolvable evidence_id (candidate not present / trimmed).";

      const checklist: AiOutput["checklist"] = (Array.isArray(aiOut.checklist) ? aiOut.checklist : []).map((it) => {
        const t = (it as any).type as "MUST" | "SHOULD" | "INFO";
        const { ids, source } = resolveSource(it.evidence_ids);

        const base: any = {
          ...(it as any),
          type: t,
          evidence_ids: ids,
        };

        if (source) base.source = source;

        // Decision-grade reliability: MUST must remain MUST; missing evidence becomes a flag.
        if (t === "MUST" && ids.length === 0) {
          base.needs_verification = true;
          base.verification_reason = missingEvidenceReason;
        }

        return base;
      });

      const risks: AiOutput["risks"] = (Array.isArray(aiOut.risks) ? aiOut.risks : []).map((r) => {
        const { ids, source } = resolveSource(r.evidence_ids);
        const out: any = { ...r, evidence_ids: ids };
        if (source) out.source = source;
        if (ids.length === 0) {
          out.needs_verification = true;
          out.verification_reason = missingEvidenceReason;
        }
        return out;
      });

      aiOut = { ...aiOut, checklist, risks };
    }
    const resultPayload: any = {
      job_id: job.id,
      user_id: job.user_id,
      extracted_text: extractedText,
      executive_summary: aiOut.executive_summary,
      checklist: aiOut.checklist,
      risks: aiOut.risks,
      clarifications: aiOut.buyer_questions,
      proposal_draft: aiOut.proposal_draft,
      policy_triggers: Array.isArray((aiOut as any).policy_triggers) ? (aiOut as any).policy_triggers : [],
    };

    if (playbookVersion !== null) {
      resultPayload.playbook_version = playbookVersion;
    }

    let upsertErr: any = null;

    {
      const { error } = await supabaseAdmin.from("job_results").upsert(resultPayload);
      upsertErr = error ?? null;
    }

    // Backwards-compatible fallback if the migration has not been applied yet.
    if (upsertErr) {
      const msg = String((upsertErr as any)?.message ?? "");
      const migrationMissing =
        msg.includes("policy_triggers") ||
        msg.includes("playbook_version") ||
        msg.toLowerCase().includes("could not find") ||
        (msg.toLowerCase().includes("column") &&
          (msg.includes("policy_triggers") || msg.includes("playbook_version")));

      if (migrationMissing) {
        const legacyPayload: any = {
          job_id: job.id,
          user_id: job.user_id,
          extracted_text: extractedText,
          executive_summary: aiOut.executive_summary,
          checklist: aiOut.checklist,
          risks: aiOut.risks,
          clarifications: aiOut.buyer_questions,
          proposal_draft: aiOut.proposal_draft,
        };

        const { error: retryErr } = await supabaseAdmin.from("job_results").upsert(legacyPayload);
        upsertErr = retryErr ?? null;

        if (!upsertErr) {
          await logEvent(supabaseAdmin, job, "warn", "Job results saved without playbook columns (migration missing)");
        }
      }
    }

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
	  console.error("process-job fatal error:", e);
    const msg = e instanceof Error ? e.message : String(e);

    // Never brick a job: make it reclaimable on next tick (best-effort).
    // Prefer the job claimed in this invocation; fall back to request payload if provided.
    try {
      let jobIdForCleanup: string | null = activeJobId;

      if (!jobIdForCleanup) {
        const { job_id } = await req.clone().json().catch(() => ({} as any));
        if (typeof job_id === "string" && job_id.length > 0) jobIdForCleanup = job_id;
      }

      if (jobIdForCleanup) {
        const SUPABASE_URL = firstEnv(["SUPABASE_URL"], "SUPABASE_URL");
        const SERVICE_ROLE = firstEnv(["SUPABASE_SERVICE_ROLE_KEY"], "SUPABASE_SERVICE_ROLE_KEY");

        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
          auth: { persistSession: false },
        });

        await makeJobReclaimableNow(supabaseAdmin, jobIdForCleanup);
      }
    } catch {
      // ignore
    }

    const isOpenAiTimeout =
      typeof msg === "string" &&
      msg.toLowerCase().includes("openai request timed out");

    if (isOpenAiTimeout) {
      // Job was made reclaimable above; treat timeout as transient to avoid repeated 500s in pg_net.
      return corsJson({ ok: true, status: "transient_openai_timeout_retryable" }, { status: 200 });
    }

    return corsJson({ ok: false, error: normalizeThrownError(e) }, { status: 500 });
  } finally {
    try {
      stopHeartbeat?.();
    } catch {
      // ignore
    }
  }
});