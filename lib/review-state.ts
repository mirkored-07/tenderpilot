export type DecisionBucket = "go" | "hold" | "no-go" | "unknown";

function cleanText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDecisionText(raw: unknown): string {
  return cleanText(raw).toLowerCase();
}

function parsePossibleJsonLikeValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const t = raw.trim();
  if (!t) return raw;
  if (!((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]")))) {
    return raw;
  }
  try {
    return JSON.parse(t);
  } catch {
    return raw;
  }
}

function extractDecisionLikeText(raw: unknown): string {
  const parsed = parsePossibleJsonLikeValue(raw);

  if (typeof parsed === "string") return cleanText(parsed);
  if (!parsed || typeof parsed !== "object") return cleanText(parsed);

  const obj = parsed as Record<string, unknown>;
  const candidates = [
    obj.value,
    obj.label,
    obj.decision,
    obj.decisionOverride,
    obj.decision_override,
    obj.finalDecisionBadge,
    obj.final_decision,
    obj.bucket,
    obj.status,
  ];

  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) return text;
  }

  return "";
}

export function isUseExtractedDecisionOverride(v: unknown): boolean {
  const t = normalizeDecisionText(extractDecisionLikeText(v));

  if (!t) return true;
  if (["extracted", "unknown", "unset", "none", "null", "n/a", "na", "auto", "automatic", "ai", "system", "default"].includes(t)) return true;
  if (t.includes("use extracted")) return true;
  if (t.includes("extracted decision")) return true;
  if (t.includes("follow ai")) return true;
  if (t.includes("use ai")) return true;
  if (t.startsWith("(") && t.includes("extracted")) return true;

  return false;
}

export function decisionBucket(raw: unknown): DecisionBucket {
  const t = normalizeDecisionText(raw);

  if (/\b(no[-\s]?go|nogo|do\s+not\s+(bid|proceed|submit)|not\s+(bid|proceed|submit)|reject|decline|withdraw)\b/.test(t)) {
    return "no-go";
  }
  if (/\b(hold|caution|clarif(y|ication)|verify|pending|tbd|conditional|depends|review)\b/.test(t) || t.includes("proceed with caution")) {
    return "hold";
  }
  if (/\b(go|proceed|bid|submit)\b/.test(t)) {
    return "go";
  }
  return "unknown";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function pickArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function isTerminalTenderStatus(status: string): boolean {
  const t = normalizeDecisionText(status);
  return ["expired", "closed", "cancelled", "canceled", "withdrawn", "terminated"].includes(t);
}

function inferBucketFromRuleMetadata(args: { tenderStatus?: unknown; hardStopReasons?: unknown }): DecisionBucket {
  const tenderStatus = cleanText(args.tenderStatus);
  if (isTerminalTenderStatus(tenderStatus)) return "no-go";

  const reasons = pickArray(args.hardStopReasons);
  const joined = normalizeDecisionText(reasons.join(" | "));
  if (!joined) return "unknown";

  if (/\b(expired|passed|closed|cancelled|canceled|withdrawn|terminated|no longer available|submission route unavailable)\b/.test(joined)) {
    return "no-go";
  }
  if (/\b(exclusion|formalit|signature|required|mandatory|missing|policy mismatch|jurisdiction)\b/.test(joined)) {
    return "hold";
  }
  return "unknown";
}

export function getAiDecisionText(executive?: any, pipeline?: any): string {
  const raw = executive ?? {};
  const pipelineAi = pipeline?.ai ?? pipeline ?? {};

  return firstNonEmpty(
    raw?.finalDecisionBadge,
    raw?.decisionBadge,
    raw?.decision,
    raw?.verdict,
    raw?.final_decision,
    raw?.decision_badge,
    raw?.llmDecisionBadge,
    pipelineAi?.final_decision,
    pipelineAi?.finalDecision,
    pipelineAi?.finalDecisionBadge,
    pipelineAi?.decisionBadge,
    pipelineAi?.decision,
    pipelineAi?.verdict,
    pipelineAi?.llm_decision,
    pipelineAi?.llmDecisionBadge,
  );
}

export function getEffectiveDecisionText(args: { executive?: any; pipeline?: any; decisionOverride?: unknown }): string {
  const overrideText = extractDecisionLikeText(args.decisionOverride);
  const overrideBucket = decisionBucket(overrideText);

  if (!isUseExtractedDecisionOverride(args.decisionOverride) && overrideBucket !== "unknown") {
    return overrideText;
  }

  const aiText = getAiDecisionText(args.executive, args.pipeline);
  if (aiText) return aiText;

  const executive = args.executive ?? {};
  const pipelineAi = args.pipeline?.ai ?? args.pipeline ?? {};
  const inferredBucket = inferBucketFromRuleMetadata({
    tenderStatus: firstNonEmpty(executive?.tenderStatus, executive?.tender_status, pipelineAi?.tender_status, pipelineAi?.tenderStatus),
    hardStopReasons: executive?.hardStopReasons ?? executive?.hard_stop_reasons ?? pipelineAi?.hard_stop_reasons ?? pipelineAi?.hardStopReasons,
  });

  if (inferredBucket === "no-go") return "No-Go";
  if (inferredBucket === "hold") return "Hold";
  if (inferredBucket === "go") return "Go";
  return "";
}

export function getSubmissionDeadlineText(args: { executive?: any; pipeline?: any; deadlineOverride?: unknown }): string {
  const overrideText = cleanText(args.deadlineOverride);
  if (overrideText) return overrideText;

  const pipelineAi = args.pipeline?.ai ?? args.pipeline ?? {};
  const executiveText = firstNonEmpty(
    args.executive?.submissionDeadlineText,
    args.executive?.submissionDeadline,
    args.executive?.submission_deadline_text,
    args.executive?.submission_deadline,
  );
  const pipelineText = firstNonEmpty(
    pipelineAi?.submission_deadline_text,
    pipelineAi?.submissionDeadlineText,
    pipelineAi?.pre_extracted_facts?.submission_deadline?.source_text,
    pipelineAi?.pre_extracted_facts?.submission_deadline?.text,
    pipelineAi?.pre_extracted_facts?.submission_deadline?.display_text,
    args.pipeline?.pre_extracted_facts?.submission_deadline?.source_text,
    args.pipeline?.pre_extracted_facts?.submission_deadline?.text,
    args.pipeline?.pre_extracted_facts?.submission_deadline?.display_text,
  );

  if (executiveText && executiveText.toLowerCase() !== "not found in extracted text") return executiveText;
  if (pipelineText && pipelineText.toLowerCase() !== "not found in extracted text") return pipelineText;
  return executiveText || pipelineText;
}

export function extractDeadlineSourceDisplay(input: unknown): string {
  const raw = cleanText(input);
  if (!raw || raw.toLowerCase() === "not found in extracted text") return "";

  const timeThenDate = raw.match(/(?:ore\s*)?(\d{1,2})[:.](\d{2})[^\d]{0,24}(?:del\s+giorno\s+|am\s+|on\s+|le\s+|del\s+|de\s+)?(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i);
  if (timeThenDate) {
    const hh = timeThenDate[1].padStart(2, "0");
    const mm = timeThenDate[2].padStart(2, "0");
    const dd = timeThenDate[3].padStart(2, "0");
    const mo = timeThenDate[4].padStart(2, "0");
    let yyyy = timeThenDate[5];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${dd}/${mo}/${yyyy} • ${hh}:${mm}`;
  }

  const dateThenTime = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})[^\d]{0,24}(?:alle\s+ore\s+|ore\s+|at\s+|à\s+|um\s+|a las\s+)?(\d{1,2})[:.](\d{2})/i);
  if (dateThenTime) {
    const dd = dateThenTime[1].padStart(2, "0");
    const mo = dateThenTime[2].padStart(2, "0");
    let yyyy = dateThenTime[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const hh = dateThenTime[4].padStart(2, "0");
    const mm = dateThenTime[5].padStart(2, "0");
    return `${dd}/${mo}/${yyyy} • ${hh}:${mm}`;
  }

  const dateOnly = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (dateOnly) {
    const dd = dateOnly[1].padStart(2, "0");
    const mo = dateOnly[2].padStart(2, "0");
    let yyyy = dateOnly[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${dd}/${mo}/${yyyy}`;
  }

  return raw.length <= 48 ? raw : "";
}

export function getSubmissionDeadlineDisplayText(args: { executive?: any; pipeline?: any; deadlineOverride?: unknown }): string {
  const rawText = getSubmissionDeadlineText(args);
  return extractDeadlineSourceDisplay(rawText) || rawText;
}

export function getSubmissionDeadlineIso(args: { executive?: any; pipeline?: any; deadlineOverride?: unknown }): string {
  const overrideText = cleanText(args.deadlineOverride);
  if (overrideText) return overrideText;

  const pipelineAi = args.pipeline?.ai ?? args.pipeline ?? {};

  return firstNonEmpty(
    args.executive?.submissionDeadlineIso,
    args.executive?.submission_deadline_iso,
    pipelineAi?.submission_deadline_iso,
    pipelineAi?.submissionDeadlineIso,
    pipelineAi?.pre_extracted_facts?.submission_deadline?.iso,
    args.pipeline?.pre_extracted_facts?.submission_deadline?.iso,
  );
}

export function getEffectiveReviewState(args: { executive?: any; pipeline?: any; decisionOverride?: unknown; deadlineOverride?: unknown }) {
  const decisionText = getEffectiveDecisionText(args);
  const decision = decisionBucket(decisionText);
  const submissionDeadlineText = getSubmissionDeadlineText(args);
  const submissionDeadlineDisplayText = getSubmissionDeadlineDisplayText(args);
  const submissionDeadlineIso = getSubmissionDeadlineIso(args);

  return {
    decisionText,
    decision,
    submissionDeadlineText,
    submissionDeadlineDisplayText,
    submissionDeadlineIso,
  };
}
