/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JobRow = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  source_type: "pdf" | "docx";
  status: string;
  pipeline?: any;
};

type Severity = "high" | "medium" | "low";

type AiChecklistItem = { type: "MUST" | "SHOULD" | "INFO"; text: string; source?: string };

type AiRisk = { title: string; severity: Severity; detail: string };

type AiOutput = {
  executive_summary: {
    decisionBadge: string;
    decisionLine: string;
    keyFindings: string[];
    nextActions: string[];
    topRisks: Array<{ title: string; severity: Severity; detail: string }>;
    submissionDeadline: string;
  };
  checklist: AiChecklistItem[];
  risks: AiRisk[];
  buyer_questions: string[];
  proposal_draft: string;
};

type AiRawOutput = {
  executive_summary: {
    decisionBadge: string;
    decisionLine: string;
    keyFindings: string[];
    nextActions: string[];
    topRisks: Array<{ title: string; severity: Severity; detail: string; evidence_ids: string[] }>;
    submissionDeadline: string;
  };
  checklist: Array<{ type: "MUST" | "SHOULD" | "INFO"; text: string; evidence_ids: string[] }>;
  risks: Array<{ title: string; severity: Severity; detail: string; evidence_ids: string[] }>;
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
 * Returns text derived from Unstructured elements, augmented with conservative PAGE / SECTION / ANNEX anchors.
 *
 * Auth header: unstructured-api-key
 */
async function submitUnstructuredOnDemandJob(args: {
  fileBytes: Uint8Array;
  fileName: string;
  contentType: string;
}): Promise<{ jobId: string; fileId: string | null }> {
  const apiKey = firstEnv(["UNSTRUCTURED_API_KEY", "TP_UNSTRUCTURED_API_KEY"], "UNSTRUCTURED_API_KEY");
  const baseUrl = String(Deno.env.get("UNSTRUCTURED_WORKFLOW_URL") ?? "https://platform.unstructuredapp.io").replace(/\/+$/, "");
  const templateId = String(Deno.env.get("UNSTRUCTURED_JOB_TEMPLATE_ID") ?? "hi_res_and_enrichment");

  const form = new FormData();
  // request_data must be a stringified JSON object. See Unstructured on-demand jobs quickstart.
  form.append("request_data", JSON.stringify({ template_id: templateId }));
  form.append("input_files", new Blob([args.fileBytes], { type: args.contentType }), args.fileName);

  const res = await fetch(`${baseUrl}/api/v1/jobs/`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "unstructured-api-key": apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Unstructured create job error ${res.status}: ${txt.slice(0, 600)}`);
  }

  const json = await res.json();
  const jobId = String(json?.id ?? "");
  const fileIds: unknown = json?.input_file_ids;
  const fileId =
    Array.isArray(fileIds) && typeof fileIds[0] === "string"
      ? String(fileIds[0])
      : null;

  if (!jobId) throw new Error("Unstructured create job response missing id");
  return { jobId, fileId };
}

async function getUnstructuredJob(jobId: string): Promise<any> {
  const apiKey = firstEnv(["UNSTRUCTURED_API_KEY", "TP_UNSTRUCTURED_API_KEY"], "UNSTRUCTURED_API_KEY");
  const baseUrl = String(Deno.env.get("UNSTRUCTURED_WORKFLOW_URL") ?? "https://platform.unstructuredapp.io").replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "unstructured-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Unstructured get job error ${res.status}: ${txt.slice(0, 600)}`);
  }
  return await res.json();
}

async function downloadUnstructuredJobOutput(args: {
  jobId: string;
  fileId: string;
}): Promise<any> {
  const apiKey = firstEnv(["UNSTRUCTURED_API_KEY", "TP_UNSTRUCTURED_API_KEY"], "UNSTRUCTURED_API_KEY");
  const baseUrl = String(Deno.env.get("UNSTRUCTURED_WORKFLOW_URL") ?? "https://platform.unstructuredapp.io").replace(/\/+$/, "");

  const url = new URL(`${baseUrl}/api/v1/jobs/${encodeURIComponent(args.jobId)}/download`);
  url.searchParams.set("file_id", args.fileId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "unstructured-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Unstructured download output error ${res.status}: ${txt.slice(0, 600)}`);
  }
  return await res.json();
}

const UNSTRUCTURED_MARKER_PREFIX = "__UNSTRUCTURED_JOB__:";

function makeUnstructuredMarker(args: { jobId: string; fileId: string | null; pollCount?: number; submittedAtMs?: number | null }): string {
  const n = Number.isFinite(args.pollCount) ? Math.max(0, Number(args.pollCount)) : 0;
  const submittedAtMs = Number.isFinite(args.submittedAtMs) ? Math.max(0, Number(args.submittedAtMs)) : 0;
  // Format: __UNSTRUCTURED_JOB__:<jobId>:<fileId>:<pollCount>:<submittedAtMs>
  return `${UNSTRUCTURED_MARKER_PREFIX}${args.jobId}:${args.fileId ?? ""}:${n}:${submittedAtMs}`;
}

function parseUnstructuredMarker(s: string): { jobId: string; fileId: string | null; pollCount: number } | null {
  const str = String(s ?? "");
  if (!str.startsWith(UNSTRUCTURED_MARKER_PREFIX)) return null;
  const rest = str.slice(UNSTRUCTURED_MARKER_PREFIX.length);
  const parts = rest.split(":");
  const jobId = parts[0] ?? "";
  const fileId = (parts[1] ?? "").trim() || null;
  const pollCount = Number(parts[2] ?? "0");
  return jobId ? { jobId, fileId, pollCount: Number.isFinite(pollCount) ? pollCount : 0 } : null;
}

/**
 * Unstructured extraction via on-demand jobs (workflow operations).
 *
 * IMPORTANT:
 * - This function does NOT wait for completion; it either:
 *   A) submits a job and returns a marker to persist, or
 *   B) if given a marker, performs a single poll attempt and returns:
 *      - null (not ready yet), or
 *      - the final extracted text.
 */
async function extractWithUnstructuredJobs(args: {
  fileBytes?: Uint8Array; // required for first submission
  fileName?: string;
  contentType?: string;
  marker?: string;
}): Promise<{
  extractedText: string | null;
  markerToSave: string | null;
  status: "submitted" | "polling" | "ready" | "failed";
  jobStatus?: string;
  jobPayload?: any;
}> {
  // Poll existing job
  if (args.marker) {
    const parsed = parseUnstructuredMarker(args.marker);
    if (!parsed || !parsed.jobId) throw new Error("Invalid Unstructured marker");

    const job = await getUnstructuredJob(parsed.jobId);

    const rawStatus = String(job?.status ?? job?.state ?? job?.job_status ?? "").trim();
    const statusLc = rawStatus.toLowerCase();

    const isDone = ["completed", "complete", "succeeded", "success", "done", "finished"].some((k) =>
      statusLc.includes(k)
    );
    const isFailed = ["failed", "error", "cancel", "canceled"].some((k) => statusLc.includes(k));

    if (isFailed) {
      return { extractedText: null, markerToSave: null, status: "failed", jobStatus: rawStatus || statusLc, jobPayload: job };
    }

    if (!isDone) {
      // not ready yet → bump poll count in the marker
      const nextMarker = makeUnstructuredMarker({
        jobId: parsed.jobId,
        fileId: parsed.fileId,
        pollCount: parsed.pollCount + 1,
        submittedAtMs: parsed.submittedAtMs,
      });
      return { extractedText: null, markerToSave: nextMarker, status: "polling", jobStatus: rawStatus || statusLc, jobPayload: job };
    }

    const fileId =
      parsed.fileId ??
      (Array.isArray(job?.input_file_ids) && typeof job.input_file_ids[0] === "string" ? String(job.input_file_ids[0]) : null);

    if (!fileId) throw new Error("Unstructured job completed but file_id is missing");

    const elements = await downloadUnstructuredJobOutput({ jobId: parsed.jobId, fileId });
    if (!Array.isArray(elements)) {
      throw new Error("Unstructured download output is not an array");
    }

    const extractedText = buildAnchoredTextFromUnstructuredElements(elements);
    return { extractedText, markerToSave: null, status: "ready", jobStatus: rawStatus || statusLc };
  }

  // Submit a new on-demand job
  if (!args.fileBytes || !args.fileName || !args.contentType) {
    throw new Error("Missing file inputs for Unstructured job submission");
  }

  const { jobId, fileId } = await submitUnstructuredOnDemandJob({
    fileBytes: args.fileBytes,
    fileName: args.fileName,
    contentType: args.contentType,
  });

  const marker = makeUnstructuredMarker({ jobId, fileId, pollCount: 0, submittedAtMs: Date.now() });
  return { extractedText: null, markerToSave: marker, status: "submitted" };
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

type EvidenceCandidate = {
  id: string;
  excerpt: string;
  page: number | null;
  anchor: string | null;
  kind: "clause" | "bullet" | "line";
  score: number;
};

function buildEvidenceCandidates(extractedText: string, maxCandidates: number): EvidenceCandidate[] {
  const text = String(extractedText ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Heuristic: skip the very first "title block" lines (often non-normative titles)
  const startIdx = Math.min(lines.length, 25);
  const bodyLines = lines.slice(startIdx);

  const kwMust = [" shall ", " must ", " shall not ", " required", " will be rejected", " disqualified", " rejection"];
  const kwSubmit = ["submit", "submission", "deliver", "deadline", "closing", "return", "envelope", "sealed", "electronic"];
  const kwMoney = ["tender security", "bid security", "bank guarantee", "ksh", "kes", "eur", "€", "$", "usd", "gbp"];

  const isLikelyToc = (l: string) => /\.\.{4,}/.test(l) || /table\s+of\s+contents/i.test(l);

  const candidates: EvidenceCandidate[] = [];
  const seen = new Set<string>();

  const scoreLine = (l: string): number => {
    const low = ` ${l.toLowerCase()} `;
    let s = 0;
    if (kwMust.some((k) => low.includes(k))) s += 10;
    if (kwSubmit.some((k) => low.includes(k))) s += 4;
    if (kwMoney.some((k) => low.includes(k))) s += 4;
    if (/\b\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}\b/.test(l) || /\b\d{4}-\d{2}-\d{2}\b/.test(l)) s += 4;
    if (/\b\d{1,2}[:\.]\d{2}\b/.test(l) || /\b\d{1,2}\s*(am|pm)\b/i.test(l)) s += 3;
    if (/\b(shall|must|required|rejected|disqualified)\b/i.test(l)) s += 3;
    return s;
  };

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    if (line.length < 25) continue;
    if (isLikelyToc(line)) continue;

    const s = scoreLine(line);
    if (s < 6) continue;

    const prev = bodyLines[i - 1] ?? "";
    const next = bodyLines[i + 1] ?? "";
    const excerptRaw = [prev, line, next].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    const excerpt = excerptRaw.length > 520 ? excerptRaw.slice(0, 520).trim() + "…" : excerptRaw;
    const key = excerpt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      id: `E${String(candidates.length + 1).padStart(3, "0")}`,
      excerpt,
      page: null,
      anchor: null,
      kind: /^(•|-|\d+\.)\s/.test(line) ? "bullet" : "line",
      score: s,
    });

    if (candidates.length >= maxCandidates * 2) break; // collect enough then sort
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxCandidates);
}

function formatEvidenceList(evidence: EvidenceCandidate[], maxChars: number): string {
  const chunks: string[] = [];
  let used = 0;
  for (const e of evidence) {
    const line = `${e.id}: ${e.excerpt}`;
    if (used + line.length + 2 > maxChars) break;
    chunks.push(line);
    used += line.length + 2;
  }
  return chunks.join("\n\n");
}

async function runOpenAiEvidenceFirst(args: {
  apiKey: string;
  model: string;
  evidenceList: string;
  maxOutputTokens: number;
}): Promise<AiRawOutput> {
  const { apiKey, model, evidenceList, maxOutputTokens } = args;

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
                evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["title", "severity", "detail", "evidence_ids"],
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
            evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
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
            evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["title", "severity", "detail", "evidence_ids"],
        },
      },
      buyer_questions: { type: "array", items: { type: "string" }, maxItems: 10 },
      proposal_draft: { type: "string" },
    },
    required: ["executive_summary", "checklist", "risks", "buyer_questions", "proposal_draft"],
  };

  const instructions =
    "You are TenderRay. Drafting support only. Not legal advice. Not procurement advice. " +
    "Use executive, compliance-grade language. No AI talk. " +
    "Always write in the same language as the evidence snippets. " +
    "Avoid false certainty.";

  const userPrompt =
    "Task\n" +
    "You will receive evidence snippets extracted from a tender/RFP.\n" +
    "Your job is to produce a decision-first bid kit grounded ONLY in these snippets.\n\n" +
    "STRICT RULES\n" +
    "1) You may ONLY cite evidence by evidence_ids that exist in the provided list.\n" +
    "2) MUST = mandatory / disqualifying if missed. SHOULD = preferred/scoring. INFO = contextual.\n" +
    "3) MUST and risks MUST have at least one evidence_id. If you cannot support it, output it as INFO (manual check).\n" +
    "4) Do not invent cross-references like ITT 24.1 as evidence. Use evidence_ids only.\n" +
    "5) Keep checklist items atomic; do not merge method + address + deadline into one item unless a single snippet clearly states it.\n\n" +
    "Evidence snippets (verbatim) follow.\n\n" +
    evidenceList;

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
        name: "tenderray_review_evidence_first",
        schema,
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Always read as text first so we can log meaningful errors (res.json() often throws "Unexpected end of JSON input")
  const rawBody = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}: ${rawBody.slice(0, 900)}`);
  }

  let json: any;
  try {
    json = rawBody ? JSON.parse(rawBody) : null;
  } catch (e: any) {
    throw new Error(`OpenAI response JSON parse failed: ${String(e?.message ?? e)} | body: ${rawBody.slice(0, 900)}`);
  }

  // Responses API may not always populate output_text. Extract text from output[] as fallback.
  const getOutputText = (resp: any): string => {
    if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text;
    const out = Array.isArray(resp?.output) ? resp.output : [];
    for (const item of out) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        // common shapes: { type: "output_text", text: "..." } or { type: "text", text: "..." }
        const t = (typeof c?.text === "string" ? c.text : "") || (typeof c?.value === "string" ? c.value : "");
        if (t && String(t).trim()) return String(t);
      }
    }
    return "";
  };

  const outText = getOutputText(json);

  if (!outText.trim()) {
    const keys = json ? Object.keys(json).slice(0, 25).join(",") : "null";
    throw new Error(`OpenAI returned no output text (keys: ${keys})`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(outText);
  } catch (e: any) {
    throw new Error(`Model output JSON parse failed: ${String(e?.message ?? e)} | output: ${outText.slice(0, 900)}`);
  }

  return parsed as AiRawOutput;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
    if (req.method !== "POST") return textResponse("Method Not Allowed", 405);

    const { job_id } = await req.json().catch(() => ({}));
    if (!job_id || typeof job_id !== "string") return textResponse("Missing job_id", 400);

    const SUPABASE_URL = firstEnv(["TP_SUPABASE_URL", "SUPABASE_URL"], "TP_SUPABASE_URL");
    const SERVICE_ROLE = firstEnv(["TP_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"], "TP_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id,user_id,file_name,file_path,source_type,status,pipeline")
      .eq("id", job_id)
      .single<JobRow>();

    if (jobErr || !job) return textResponse("Job not found", 404);

    // If already finalized, exit fast.
    if (job.status === "done") {
      return jsonResponse({ ok: true, status: "done" });
    }
    if (job.status === "failed") {
      return jsonResponse({ ok: true, status: "failed" });
    }

    // Claim if queued; if already processing, continue (stage 2 self-invocation).
    if (job.status === "queued") {
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from("jobs")
        .update({ status: "processing" })
        .eq("id", job.id)
        .in("status", ["queued"])
        .select("id")
        .maybeSingle();

      if (claimErr) return textResponse("Failed to claim job", 500);
      if (!claimed) {
        return jsonResponse({ ok: true, status: "already_claimed" });
      }
      await logEvent(supabaseAdmin, job, "info", "Job claimed and processing started");
    }

    const useMockExtract = flagEnv("TP_MOCK_EXTRACT");
    const useMockAi = flagEnv("TP_MOCK_AI");

    // Stage detection: if we already saved extracted_text but no checklist, we are in stage 2.
    const { data: prevResults } = await supabaseAdmin
      .from("job_results")
      .select("extracted_text,checklist,risks,proposal_draft,executive_summary,clarifications")
      .eq("job_id", job.id)
      .maybeSingle();

    const prevExtracted = (prevResults as any)?.extracted_text;
    const prevChecklist = (prevResults as any)?.checklist;
    const prevRisks = (prevResults as any)?.risks;
    const prevProposalDraft = (prevResults as any)?.proposal_draft;

    const unstructuredMarker = typeof prevExtracted === "string" ? parseUnstructuredMarker(prevExtracted) : null;

    const hasExtracted =
      typeof prevExtracted === "string" && prevExtracted.trim().length > 0 && unstructuredMarker === null;

    const hasFinal = Array.isArray(prevChecklist) && prevChecklist.length > 0 && Array.isArray(prevRisks) && typeof prevProposalDraft === "string" && prevProposalDraft.trim().length > 0;

    // -------------------------
    // STAGE 1: Extraction only (Unstructured on-demand jobs)
    // -------------------------
    if (!hasExtracted) {
      // If we previously stored an Unstructured job marker, do a single poll attempt.
      if (unstructuredMarker) {
        await logEvent(supabaseAdmin, job, "info", "Unstructured job poll attempt", {
          jobId: unstructuredMarker.jobId,
          pollCount: unstructuredMarker.pollCount,
        });

        const maxPolls = parseNumberEnv("TP_UNSTRUCTURED_MAX_POLLS", 600);
const maxMinutes = parseNumberEnv("TP_UNSTRUCTURED_MAX_MINUTES", 60);

// Big documents can take minutes. "Not ready yet" is not an error.
// We only fail on a real Unstructured failure status (handled inside extractWithUnstructuredJobs),
// or if we've been waiting longer than maxMinutes since submission.
const submittedAtMs = (unstructuredMarker as any).submittedAtMs as number | null;
if (submittedAtMs) {
  const elapsedMs = Date.now() - submittedAtMs;
  const elapsedMinutes = elapsedMs / 60000;
  if (elapsedMinutes > maxMinutes) {
    await logEvent(supabaseAdmin, job, "error", "Unstructured job timeout exceeded", {
      jobId: unstructuredMarker.jobId,
      elapsedMinutes: Number(elapsedMinutes.toFixed(2)),
      maxMinutes,
      pollCount: unstructuredMarker.pollCount,
    });
    await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
    // Return quickly; UI may show failed state without retry storm.
    return textResponse("Unstructured job timeout exceeded", 200);
  }
}

if (unstructuredMarker.pollCount >= maxPolls) {
  await logEvent(supabaseAdmin, job, "warn", "Unstructured job still processing (high poll count)", {
    jobId: unstructuredMarker.jobId,
    pollCount: unstructuredMarker.pollCount,
    maxPolls,
  });
  // Continue; next tick can keep polling.
}

        const polled = await extractWithUnstructuredJobs({ marker: String(prevExtracted ?? "") });

        // If Unstructured reports failure, stop and mark the job failed (do NOT poll forever).
        if (polled.status === "failed") {
          await logEvent(supabaseAdmin, job, "error", "Unstructured job failed", {
            jobId: unstructuredMarker.jobId,
            pollCount: unstructuredMarker.pollCount,
            jobStatus: polled.jobStatus ?? null,
            jobPayload: polled.jobPayload ?? null,
          });
          await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
          return textResponse("Unstructured job failed", 500);
        }

        // Log the current provider-reported status occasionally (helps diagnose stuck jobs).
        if (unstructuredMarker.pollCount % 5 === 0) {
          await logEvent(supabaseAdmin, job, "info", "Unstructured job status", {
            jobId: unstructuredMarker.jobId,
            pollCount: unstructuredMarker.pollCount,
            jobStatus: polled.jobStatus ?? null,
          });
        }

        if (polled.status === "polling") {
          // Persist updated marker (pollCount increments) and re-invoke self with a small delay.
          const nextMarker = polled.markerToSave ?? String(prevExtracted ?? "");
          const { error: updErr } = await supabaseAdmin.from("job_results").upsert({
            job_id: job.id,
            user_id: job.user_id,
            extracted_text: nextMarker,
          });

          if (updErr) {
            await logEvent(supabaseAdmin, job, "error", "Updating Unstructured marker failed", { error: updErr.message });
            await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
            return textResponse("Marker update failed", 500);
          }
          // NOTE: Do not self-invoke. The frontend "tick" loop will trigger the next poll.
          return jsonResponse({ ok: true, status: "unstructured_polling" });
        }

        // Ready: we have extracted text now.
        const extractedText = String(polled.extractedText ?? "");

        await logEvent(
          supabaseAdmin,
          job,
          extractedText ? "info" : "warn",
          extractedText ? "Unstructured job output downloaded" : "Unstructured job output empty",
          { chars: extractedText.length },
        );

        const { error: saveExtractErr } = await supabaseAdmin.from("job_results").upsert({
          job_id: job.id,
          user_id: job.user_id,
          extracted_text: extractedText,
        });

        if (saveExtractErr) {
          await logEvent(supabaseAdmin, job, "error", "Saving extracted text failed", { error: saveExtractErr.message });
          await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
          return textResponse("Extract save failed", 500);
        }

        await logEvent(supabaseAdmin, job, "info", "Stage 1 completed: extracted_text saved");
      } else {
        // First time: submit an on-demand job to Unstructured, persist marker, and return quickly.
        if (useMockExtract) {
          const extractedText = mockExtractFixture({ sourceType: job.source_type, fileName: job.file_name });
          await logEvent(supabaseAdmin, job, "info", "Mock extract enabled", { chars: extractedText.length });

          const { error: saveExtractErr } = await supabaseAdmin.from("job_results").upsert({
            job_id: job.id,
            user_id: job.user_id,
            extracted_text: extractedText,
          });

          if (saveExtractErr) {
            await logEvent(supabaseAdmin, job, "error", "Saving extracted text failed", { error: saveExtractErr.message });
            await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
            return textResponse("Extract save failed", 500);
          }

          await logEvent(supabaseAdmin, job, "info", "Stage 1 completed: extracted_text saved");
        } else {
          const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(job.file_path);

          if (dlErr || !fileData) {
            await logEvent(supabaseAdmin, job, "error", "Storage download failed", { error: dlErr?.message });
            await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
            return textResponse("Download failed", 500);
          }

          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const contentType =
            job.source_type === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

          await logEvent(supabaseAdmin, job, "info", "Submitting Unstructured on-demand job", {
            fileName: job.file_name,
            sourceType: job.source_type,
            bytes: bytes.byteLength,
          });

          const submitted = await extractWithUnstructuredJobs({
            fileBytes: bytes,
            fileName: job.file_name,
            contentType,
          });

          const marker = submitted.markerToSave ?? "";
          if (!marker) throw new Error("Unstructured submission did not return a marker");

          const { error: saveMarkerErr } = await supabaseAdmin.from("job_results").upsert({
            job_id: job.id,
            user_id: job.user_id,
            extracted_text: marker,
          });

          if (saveMarkerErr) {
            await logEvent(supabaseAdmin, job, "error", "Saving Unstructured marker failed", { error: saveMarkerErr.message });
            await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
            return textResponse("Marker save failed", 500);
          }

          await logEvent(supabaseAdmin, job, "info", "Unstructured job submitted (marker saved)");

          // Re-invoke self after a short delay to poll.
          const pollDelayMs = parseNumberEnv("TP_UNSTRUCTURED_POLL_DELAY_MS", 8_000);
          try {
            const selfUrl = new URL(req.url);
            const p = (async () => {
              try {
                await new Promise((r) => setTimeout(r, pollDelayMs));
                await fetch(selfUrl.toString(), {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ job_id }),
                });
              } catch (_) {
                // ignore
              }
            })();

            // @ts-ignore
            if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
              // @ts-ignore
              EdgeRuntime.waitUntil(p);
            } else {
              void p;
            }
          } catch (_) {
            // no-op
          }

          return jsonResponse({ ok: true, status: "unstructured_submitted" });
        }
      }

      // If we reach here, extracted_text is now saved. Schedule stage 2 as a separate invocation.
      try {
        const selfUrl = new URL(req.url); // preserves tp_secret query param
        const p = fetch(selfUrl.toString(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ job_id }),
        });

        // @ts-ignore
        if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
          // @ts-ignore
          EdgeRuntime.waitUntil(p);
        } else {
          void p;
        }
      } catch (_) {
        // no-op
      }

      return jsonResponse({ ok: true, status: "extracted_scheduled" });
    }


// If already finalized, exit fast (idempotency).
if (hasFinal) {
  await logEvent(supabaseAdmin, job, "info", "Reasoning skipped (results already exist)");
  await supabaseAdmin.from("jobs").update({ status: "done" }).eq("id", job.id);
  await logEvent(supabaseAdmin, job, "info", "Job marked done (idempotent)");
  return jsonResponse({ ok: true, status: "done" });
}

    // -------------------------
    // STAGE 2: Evidence-first AI
    // -------------------------
    
// -------------------------
// Stage 2 guards (idempotency + anti-burn)
// -------------------------
const existingPipeline = (job as any)?.pipeline && typeof (job as any).pipeline === "object" ? (job as any).pipeline : {};
const existingReasoning = existingPipeline?.reasoning && typeof existingPipeline.reasoning === "object"
  ? existingPipeline.reasoning
  : {};

const nowMs = Date.now();
const maxAttempts = parseNumberEnv("TP_REASONING_MAX_ATTEMPTS", 3);
const cooldownSec = parseNumberEnv("TP_REASONING_COOLDOWN_SEC", 90);
const lockTtlSec = parseNumberEnv("TP_REASONING_LOCK_TTL_SEC", 300);

const attempts = Number(existingReasoning.attempts ?? 0);

const parseIsoMs = (v: unknown): number | null => {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

const startedAtMs = parseIsoMs(existingReasoning.started_at);
if (existingReasoning.in_progress === true && startedAtMs && nowMs - startedAtMs < lockTtlSec * 1000) {
  await logEvent(supabaseAdmin, job, "info", "Reasoning already in progress (lock)", {
    attempts,
    started_at: existingReasoning.started_at,
    lockTtlSec,
  });
  return jsonResponse({ ok: true, status: "reasoning_in_progress" });
}

const lastAttemptMs = parseIsoMs(existingReasoning.last_attempt_at);
if (lastAttemptMs && nowMs - lastAttemptMs < cooldownSec * 1000) {
  await logEvent(supabaseAdmin, job, "info", "Reasoning cooldown active", {
    attempts,
    last_attempt_at: existingReasoning.last_attempt_at,
    cooldownSec,
  });
  return jsonResponse({ ok: true, status: "cooldown" });
}

if (attempts >= maxAttempts) {
  await logEvent(supabaseAdmin, job, "error", "Reasoning attempts exceeded", { attempts, maxAttempts });
  await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
  return textResponse("Reasoning attempts exceeded", 500);
}

// Acquire lock + bump attempt counter (best-effort; do not fail job if pipeline column is missing)
try {
  const nextPipeline = {
    ...existingPipeline,
    stage: "reasoning",
    reasoning: {
      ...existingReasoning,
      attempts: attempts + 1,
      in_progress: true,
      started_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    },
  };
  const { error: pipeErr } = await supabaseAdmin.from("jobs").update({ pipeline: nextPipeline }).eq("id", job.id);
  if (pipeErr) {
    await logEvent(supabaseAdmin, job, "warn", "Failed to update pipeline (continuing)", { error: pipeErr.message });
  }
} catch (_) {
  // ignore
}

const extractedText = String(prevExtracted ?? "");

    const model = String(Deno.env.get("TP_OPENAI_MODEL") ?? "gpt-4.1-mini");
    const maxOutputTokens = parseNumberEnv("TP_MAX_OUTPUT_TOKENS", 1800);
    const maxUsdPerJob = parseNumberEnv("TP_MAX_USD_PER_JOB", 0.05);

    // Evidence list caps (critical for wall clock + cost)
    const maxCandidates = parseNumberEnv("TP_EVIDENCE_MAX_CANDIDATES", 180);
    const maxEvidenceChars = parseNumberEnv("TP_EVIDENCE_MAX_CHARS", 40_000);

    let aiOutFinal: AiOutput;

    if (useMockAi) {
      aiOutFinal = mockAiFixture(extractedText);
      await logEvent(supabaseAdmin, job, "info", "Mock AI enabled");
    } else {
      const apiKey = firstEnv(["TP_OPENAI_API_KEY", "OPENAI_API_KEY"], "TP_OPENAI_API_KEY");

      const candidates = buildEvidenceCandidates(extractedText, maxCandidates);
      const evidenceList = formatEvidenceList(candidates, maxEvidenceChars);

      const inputTokensEst = estimateTokensFromChars(evidenceList.length);
      const usdEst = estimateUsd({ model, inputTokens: inputTokensEst, outputTokens: maxOutputTokens });

      if (usdEst > maxUsdPerJob) {
        await logEvent(supabaseAdmin, job, "warn", "Job exceeds cost cap (evidence list), reduce limits", {
          model,
          maxUsdPerJob,
          usdEst,
          evidenceChars: evidenceList.length,
          inputTokensEst,
          maxOutputTokens,
        });

        await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
        return textResponse("Job exceeds cost cap", 413);
      }

      await logEvent(supabaseAdmin, job, "info", "OpenAI started (evidence-first)", {
        model,
        maxOutputTokens,
        candidates: candidates.length,
        evidenceChars: evidenceList.length,
      });

      let raw: AiRawOutput;
const t0 = Date.now();
try {
  raw = await runOpenAiEvidenceFirst({ apiKey, model, evidenceList, maxOutputTokens });
} catch (err) {
  const emsg = err instanceof Error ? err.message : String(err);
  await logEvent(supabaseAdmin, job, "error", "OpenAI failed (evidence-first)", { error: emsg });
  // release lock best-effort
  try {
    const cur = (job as any)?.pipeline && typeof (job as any).pipeline === "object" ? (job as any).pipeline : {};
    const curR = cur?.reasoning && typeof cur.reasoning === "object" ? cur.reasoning : {};
    const next = { ...cur, stage: "reasoning", reasoning: { ...curR, in_progress: false } };
    await supabaseAdmin.from("jobs").update({ pipeline: next }).eq("id", job.id);
  } catch (_) {}
  await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
  return textResponse("OpenAI failed", 500);
}
await logEvent(supabaseAdmin, job, "info", "OpenAI finished (evidence-first)", {
  model,
  maxOutputTokens,
  durationMs: Date.now() - t0,
});


      // Map evidence_ids -> excerpts and enforce MUST/RISK proof.
      const byId = new Map<string, EvidenceCandidate>();
      for (const c of candidates) byId.set(c.id, c);

      const normalizeEvidence = (ids: string[]): { ids: string[]; excerpt: string } => {
        const uniq = Array.from(new Set((ids ?? []).filter((x) => typeof x === "string" && x.trim().length > 0)));
        const found = uniq.map((id) => byId.get(id)).filter(Boolean) as EvidenceCandidate[];
        const excerpt = found.map((e) => e.excerpt).join("\n\n").trim();
        return { ids: found.map((e) => e.id), excerpt };
      };

      // Build final AiOutput expected by the app/UI (uses `source` strings).
      aiOutFinal = {
        executive_summary: {
          ...raw.executive_summary,
          topRisks: raw.executive_summary.topRisks.map((r: any) => {
            const ev = normalizeEvidence(r.evidence_ids ?? []);
            return { title: r.title, severity: r.severity, detail: r.detail + (ev.excerpt ? `\n\nEvidence:\n${ev.excerpt}` : "") };
          }),
        },
        checklist: raw.checklist.map((it: any) => {
          const ev = normalizeEvidence(it.evidence_ids ?? []);
          if (it.type === "MUST" && ev.ids.length === 0) {
            return { type: "INFO", text: `Manual check: ${String(it.text ?? "").trim()}`, source: "Not found in extracted text." };
          }
          return { type: it.type, text: String(it.text ?? "").trim(), source: ev.excerpt || "Not found in extracted text." };
        }),
        risks: raw.risks
          .map((r: any) => {
            const ev = normalizeEvidence(r.evidence_ids ?? []);
            if (ev.ids.length === 0) return null;
            return { title: r.title, severity: r.severity, detail: r.detail + (ev.excerpt ? `\n\nEvidence:\n${ev.excerpt}` : "") };
          })
          .filter(Boolean) as any,
        buyer_questions: raw.buyer_questions,
        proposal_draft: raw.proposal_draft,
      };

      await logEvent(supabaseAdmin, job, "info", "OpenAI completed (evidence-first)", { model, maxOutputTokens });
    }

    await logEvent(supabaseAdmin, job, "info", "Saving results started");

    const { error: upsertErr } = await supabaseAdmin.from("job_results").upsert({
      job_id: job.id,
      user_id: job.user_id,
      extracted_text: extractedText,
      executive_summary: aiOutFinal.executive_summary,
      checklist: aiOutFinal.checklist,
      risks: aiOutFinal.risks,
      clarifications: aiOutFinal.buyer_questions,
      proposal_draft: aiOutFinal.proposal_draft,
    });

    if (upsertErr) {
        await logEvent(supabaseAdmin, job, "error", "Saving results failed", { error: upsertErr.message });
  // release lock best-effort
  try {
    const cur = (job as any)?.pipeline && typeof (job as any).pipeline === "object" ? (job as any).pipeline : {};
    const curR = cur?.reasoning && typeof cur.reasoning === "object" ? cur.reasoning : {};
    const next = { ...cur, stage: "reasoning", reasoning: { ...curR, in_progress: false } };
    await supabaseAdmin.from("jobs").update({ pipeline: next }).eq("id", job.id);
  } catch (_) {}
  await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
  return textResponse("Result save failed", 500);
}

    await logEvent(supabaseAdmin, job, "info", "Results saved successfully");
// mark pipeline done + release lock best-effort
try {
  const cur = (job as any)?.pipeline && typeof (job as any).pipeline === "object" ? (job as any).pipeline : {};
  const curR = cur?.reasoning && typeof cur.reasoning === "object" ? cur.reasoning : {};
  const next = { ...cur, stage: "done", reasoning: { ...curR, in_progress: false, finished_at: new Date().toISOString() } };
  await supabaseAdmin.from("jobs").update({ pipeline: next }).eq("id", job.id);
} catch (_) {}

await supabaseAdmin.from("jobs").update({ status: "done" }).eq("id", job.id);
await logEvent(supabaseAdmin, job, "info", "Job marked done");


    return jsonResponse({ ok: true, status: "done" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return textResponse(`Error: ${msg}`, 500);
  }
});
