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
    // Backfilled by backend for UI compatibility
    source?: string;
  }>;
  risks: Array<{
    title: string;
    severity: Severity;
    detail: string;
    evidence_ids?: string[];
    // Backfilled by backend for UI compatibility
    source?: string;
  }>;
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

async function runOpenAi(args: {
  apiKey: string;
  model: string;
  extractedText: string;
  evidenceCandidates: EvidenceCandidate[];
  maxOutputTokens: number;
}): Promise<AiOutput> {
  const { apiKey, model, extractedText, evidenceCandidates, maxOutputTokens } = args;

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
    "You are TenderRay. Drafting support only. Not legal advice. Not procurement advice. " +
    "Use executive, compliance grade language. No AI talk. " +
    "Always write in the same language as the tender source text. " +
    "Avoid false certainty. If not present, write: Not found in extracted text.";

  const evidenceList = evidenceCandidates
    .map((e) => {
      const page = e.page != null ? ` [PAGE ${e.page}]` : "";
      const anchor = e.anchor ? ` ${e.anchor}` : "";
      return `${e.id}${page}${anchor}: ${e.excerpt}`;
    })
    .join("

");

  const userPrompt = `Task
Review the tender source text and produce a decision-first bid kit.

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
6. Deduplication. Do not repeat checklist items verbatim inside the executive summary.
7. Missing info. Put ambiguities or missing info into buyer_questions.

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
        name: "tenderray_review",
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
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from("uploads").download(job.file_path);

      if (dlErr || !fileData) {
        await logEvent(supabaseAdmin, job, "error", "Storage download failed", { error: dlErr?.message });
        await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
        return new Response("Download failed", { status: 500 });
      }

      const bytes = new Uint8Array(await fileData.arrayBuffer());

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

      evidenceCandidates = buildEvidenceCandidates(extractedText);

      await logEvent(
        supabaseAdmin,
        job,
        extractedText ? "info" : "warn",
        extractedText ? "Unstructured extract completed" : "Unstructured extract returned empty text",
        { chars: extractedText.length, evidenceCandidates: evidenceCandidates.length },
      );
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
      aiOut = await runOpenAi({ apiKey, model, extractedText: clipped, evidenceCandidates, maxOutputTokens });
      await logEvent(supabaseAdmin, job, "info", "OpenAI completed", { model, maxOutputTokens });
    }


    // Evidence-first normalization (product-grade):
    // - AI must cite evidence_ids for MUST checklist items and for risks.
    // - Backend backfills `source` (UI compatibility) from the referenced evidence excerpt(s).
    // - MUST without valid evidence => downgrade to INFO + manual check.
    // - Risks without valid evidence => move to buyer_questions (manual check) and remove from risks list.
    {
      const evidenceById = new Map<string, EvidenceCandidate>();
      for (const e of evidenceCandidates) evidenceById.set(e.id, e);

      const resolveSource = (ids?: string[]): { ids: string[]; source: string } => {
        const valid = (ids ?? []).filter((id) => evidenceById.has(id));
        if (valid.length === 0) return { ids: [], source: "Not found in extracted text." };
        // For highlighting, keep a single contiguous excerpt (best = first id)
        const first = evidenceById.get(valid[0])!;
        return { ids: valid, source: first.excerpt };
      };

      const newBuyerQuestions: string[] = Array.isArray(aiOut.buyer_questions) ? [...aiOut.buyer_questions] : [];

      const checklist = (Array.isArray(aiOut.checklist) ? aiOut.checklist : []).map((it) => {
        const { ids, source } = resolveSource(it.evidence_ids);

        if (it.type === "MUST") {
          if (ids.length === 0) {
            return {
              ...it,
              type: "INFO",
              text: `Manual check: ${String(it.text ?? "").trim()}`,
              evidence_ids: [],
              source: "Not found in extracted text.",
            };
          }
          return { ...it, evidence_ids: ids, source };
        }

        // SHOULD / INFO: source optional; keep if evidence exists, else omit.
        if (ids.length > 0) return { ...it, evidence_ids: ids, source };
        return { ...it, evidence_ids: [], source: "Not found in extracted text." };
      });

      const risks: AiOutput["risks"] = [];
      for (const r of Array.isArray(aiOut.risks) ? aiOut.risks : []) {
        const { ids, source } = resolveSource(r.evidence_ids);
        if (ids.length === 0) {
          newBuyerQuestions.push(`Manual check (risk): ${String(r.title ?? "").trim()} — ${String(r.detail ?? "").trim()}`);
          continue;
        }
        risks.push({ ...r, evidence_ids: ids, source });
      }

      aiOut = { ...aiOut, checklist, risks, buyer_questions: newBuyerQuestions };
    }


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