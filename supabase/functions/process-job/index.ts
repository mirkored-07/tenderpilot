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
type DecisionBadge = "Go" | "Hold" | "No-Go";
type CoverageState = "covered" | "partial" | "not_found";
type EvidenceBucket = "submission" | "eligibility" | "commercial" | "evaluation" | "contract_terms" | "general";

type EvidenceCandidate = {
  id: string; // e.g. E001
  excerpt: string; // verbatim text from extracted content (highlightable)
  page: number | null;
  anchor: string | null; // SECTION/ANNEX heading if available
  kind: "clause" | "bullet" | "table_row" | "other";
  score: number;
  bucket?: EvidenceBucket;
};

type DeterministicTenderFact = {
  value: string;
  evidence_ids: string[];
  source: "evidence" | "text_fallback";
  confidence: "high" | "medium";
};

type PreExtractedDeadlineFact = {
  text: string;
  iso: string | null;
  timezone: string | null;
  source: "parsed_from_evidence" | "not_found" | "unparseable";
};

type PreExtractedTenderFacts = {
  submissionDeadline: PreExtractedDeadlineFact;
  clarificationDeadline: PreExtractedDeadlineFact;
  submissionChannel: DeterministicTenderFact | null;
  procurementProcedure: DeterministicTenderFact | null;
  validityPeriod: DeterministicTenderFact | null;
  contractTerm: DeterministicTenderFact | null;
  lotStructure: DeterministicTenderFact | null;
  attachmentMentions: Array<{ value: string; evidence_ids: string[] }>;
  scheduleMentions: Array<{ value: string; evidence_ids: string[] }>;
};

const PROCESS_JOB_PROMPT_VERSION = "2026-03-10-c4";
const PROCESS_JOB_SCHEMA_VERSION = "2026-03-08-c1";
const EVIDENCE_SELECTION_VERSION = "2026-03-10-c2";
const OPENAI_TEMPERATURE = 0;
const GEMINI_TEMPERATURE = 0;
const DEFAULT_LLM_MODEL_KEY = "openai:gpt-4.1-mini";
const DEFAULT_ALLOWED_BENCHMARK_MODEL_KEY = "google:gemini-2.5-flash";

type LlmProvider = "openai" | "google";

type LlmRegistryEntry = {
  key: string;
  provider: LlmProvider;
  providerModel: string;
  apiKeyEnvNames: string[];
  defaultTimeoutMs: number;
  timeoutEnvName: string;
};

type ModelResolutionReason =
  | "requested_allowed"
  | "requested_unknown"
  | "requested_not_allowed"
  | "default_env"
  | "default_env_unknown"
  | "fallback_baseline";

type ResolvedModelSelection = {
  requestedModel: string | null;
  selectionSource: string | null;
  defaultModel: string;
  resolvedModel: string;
  resolutionReason: ModelResolutionReason;
  entry: LlmRegistryEntry;
  allowedModels: string[];
};

const LLM_MODEL_REGISTRY: Record<string, LlmRegistryEntry> = {
  "openai:gpt-4.1-mini": {
    key: "openai:gpt-4.1-mini",
    provider: "openai",
    providerModel: "gpt-4.1-mini",
    apiKeyEnvNames: ["TP_OPENAI_API_KEY", "OPENAI_API_KEY"],
    defaultTimeoutMs: 35_000,
    timeoutEnvName: "OPENAI_TIMEOUT_MS",
  },
  "openai:gpt-5-mini": {
    key: "openai:gpt-5-mini",
    provider: "openai",
    providerModel: "gpt-5-mini",
    apiKeyEnvNames: ["TP_OPENAI_API_KEY", "OPENAI_API_KEY"],
    defaultTimeoutMs: 50_000,
    timeoutEnvName: "OPENAI_TIMEOUT_MS",
  },
  "openai:gpt-4o-mini": {
    key: "openai:gpt-4o-mini",
    provider: "openai",
    providerModel: "gpt-4o-mini",
    apiKeyEnvNames: ["TP_OPENAI_API_KEY", "OPENAI_API_KEY"],
    defaultTimeoutMs: 35_000,
    timeoutEnvName: "OPENAI_TIMEOUT_MS",
  },
  "openai:gpt-4.1-nano": {
    key: "openai:gpt-4.1-nano",
    provider: "openai",
    providerModel: "gpt-4.1-nano",
    apiKeyEnvNames: ["TP_OPENAI_API_KEY", "OPENAI_API_KEY"],
    defaultTimeoutMs: 35_000,
    timeoutEnvName: "OPENAI_TIMEOUT_MS",
  },
  "google:gemini-2.5-flash": {
    key: "google:gemini-2.5-flash",
    provider: "google",
    providerModel: "gemini-2.5-flash",
    apiKeyEnvNames: ["TP_GEMINI_API_KEY", "GEMINI_API_KEY"],
    defaultTimeoutMs: 50_000,
    timeoutEnvName: "GEMINI_TIMEOUT_MS",
  },
  "google:gemini-2.5-pro": {
    key: "google:gemini-2.5-pro",
    provider: "google",
    providerModel: "gemini-2.5-pro",
    apiKeyEnvNames: ["TP_GEMINI_API_KEY", "GEMINI_API_KEY"],
    defaultTimeoutMs: 50_000,
    timeoutEnvName: "GEMINI_TIMEOUT_MS",
  },
};

function normalizeModelKey(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes(":")) return value;
  return `openai:${value}`;
}

function getRegistryEntry(modelKey: unknown): LlmRegistryEntry | null {
  const normalized = normalizeModelKey(modelKey);
  return normalized ? (LLM_MODEL_REGISTRY[normalized] ?? null) : null;
}

function modelSupportsTemperature(model: string): boolean {
  const m = String(model ?? "").trim().toLowerCase();
  if (!m) return true;
  if (m.startsWith("gpt-5")) return false;
  if (m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")) return false;
  return true;
}

function parseAllowedModelKeys(defaultModel: string): string[] {
  const raw = String(Deno.env.get("TP_LLM_ALLOWED_MODELS") ?? "").trim();
  const values = raw
    ? raw.split(",").map((item) => normalizeModelKey(item)).filter(Boolean)
    : [defaultModel, DEFAULT_ALLOWED_BENCHMARK_MODEL_KEY];

  const deduped = new Set<string>();
  for (const value of values) {
    if (LLM_MODEL_REGISTRY[value]) deduped.add(value);
  }
  deduped.add(defaultModel);
  return [...deduped];
}

function readPipelineAiSelection(pipeline: unknown): { requestedModel: string | null; selectionSource: string | null } {
  if (!pipeline || typeof pipeline !== "object") {
    return { requestedModel: null, selectionSource: null };
  }

  const ai = (pipeline as Record<string, unknown>)?.ai;
  if (!ai || typeof ai !== "object") {
    return { requestedModel: null, selectionSource: null };
  }

  const aiState = ai as Record<string, unknown>;
  const requestedModel = normalizeModelKey(aiState.requested_model);
  const selectionSource = String(aiState.selection_source ?? "").trim() || null;
  return { requestedModel: requestedModel || null, selectionSource };
}

function resolveLlmSelection(job: JobRow): ResolvedModelSelection {
  const { requestedModel, selectionSource } = readPipelineAiSelection(job.pipeline);

  const envDefaultRaw =
    normalizeModelKey(Deno.env.get("TP_LLM_DEFAULT_MODEL")) ||
    normalizeModelKey(Deno.env.get("TP_OPENAI_MODEL")) ||
    DEFAULT_LLM_MODEL_KEY;

  const envDefaultEntry = getRegistryEntry(envDefaultRaw);
  const defaultEntry = envDefaultEntry ?? LLM_MODEL_REGISTRY[DEFAULT_LLM_MODEL_KEY];
  const defaultModel = defaultEntry.key;
  const allowedModels = parseAllowedModelKeys(defaultModel);

  if (requestedModel) {
    const requestedEntry = getRegistryEntry(requestedModel);
    if (!requestedEntry) {
      return {
        requestedModel,
        selectionSource,
        defaultModel,
        resolvedModel: defaultModel,
        resolutionReason: "requested_unknown",
        entry: defaultEntry,
        allowedModels,
      };
    }

    if (!allowedModels.includes(requestedEntry.key)) {
      return {
        requestedModel,
        selectionSource,
        defaultModel,
        resolvedModel: defaultModel,
        resolutionReason: "requested_not_allowed",
        entry: defaultEntry,
        allowedModels,
      };
    }

    return {
      requestedModel,
      selectionSource,
      defaultModel,
      resolvedModel: requestedEntry.key,
      resolutionReason: "requested_allowed",
      entry: requestedEntry,
      allowedModels,
    };
  }

  return {
    requestedModel: null,
    selectionSource,
    defaultModel,
    resolvedModel: defaultModel,
    resolutionReason: envDefaultEntry ? "default_env" : "default_env_unknown",
    entry: defaultEntry,
    allowedModels,
  };
}

function firstApiKeyForModel(entry: LlmRegistryEntry): string {
  const label = entry.provider === "google" ? "TP_GEMINI_API_KEY" : "TP_OPENAI_API_KEY";
  return firstEnv(entry.apiKeyEnvNames, label);
}

const EVIDENCE_BUCKET_ORDER: EvidenceBucket[] = ["submission", "eligibility", "commercial", "evaluation", "contract_terms", "general"];

type DecisionSource = "llm" | "hard_rule" | "policy_rule";
type TenderStatus = "open" | "expired" | "unclear";

type AiOutput = {
  executive_summary: {
    decisionBadge: DecisionBadge;
    decisionLine: string;
    llmDecisionBadge?: DecisionBadge;
    finalDecisionBadge?: DecisionBadge;
    decisionSource?: DecisionSource;
    hardStopReasons?: string[];
    submissionDeadlineIso?: string | null;
    submissionTimezone?: string | null;
    submissionDeadlineSource?: "llm" | "evidence_fallback" | "not_found" | "unparseable";
    tenderStatus?: TenderStatus;
    decision_reasons: Array<{
      category: "blocker" | "eligibility" | "submission" | "commercial" | "technical" | "playbook" | "uncertainty" | "fit";
      reason: string;
      evidence_ids?: string[];
    }>;
    hard_blockers: Array<{
      title: string;
      detail: string;
      evidence_ids?: string[];
    }>;
    evidence_coverage: {
      submission: CoverageState;
      eligibility: CoverageState;
      scope: CoverageState;
      commercial: CoverageState;
      evaluation: CoverageState;
      contract_terms: CoverageState;
      note: string;
    };
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

// ---- i18n / output language (Option A: decision labels remain Go/Hold/No-Go) ----
type LangCode = "en" | "de" | "it" | "fr" | "es";

function normalizeLang(raw: unknown): LangCode {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "de") return "de";
  if (v === "it") return "it";
  if (v === "fr") return "fr";
  if (v === "es") return "es";
  return "en";
}

function langName(code: LangCode): string {
  if (code === "de") return "German";
  if (code === "it") return "Italian";
  if (code === "fr") return "French";
  if (code === "es") return "Spanish";
  return "English";
}

type EvidenceRegexSet = {
  normative: RegExp;
  deadline: RegExp;
  submission: RegExp;
  security: RegExp;
  prohibition: RegExp;
  qualification: RegExp;
  commercial: RegExp;
  evaluation: RegExp;
  contract_terms: RegExp;
};

const LANGUAGE_DETECTION_TERMS: Record<LangCode, string[]> = {
  en: [
    "invitation to tender",
    "tender document",
    "bid security",
    "deadline",
    "submission",
    "clarification",
    "shall",
    "must",
  ],
  de: [
    "ausschreibung",
    "vergab",
    "angebot",
    "bieter",
    "frist",
    "einzureichen",
    "zuschlag",
    "vergabeunterlagen",
    "leistungsverzeichnis",
  ],
  es: [
    "licitación",
    "pliego",
    "oferta",
    "ofertas",
    "fecha límite",
    "presentación",
    "adjudicación",
    "solvencia",
  ],
  fr: [
    "appel d'offres",
    "marché public",
    "offre",
    "offres",
    "date limite",
    "remise des offres",
    "candidat",
    "soumission",
  ],
  it: [
    "disciplinare",
    "stazione appaltante",
    "operatore economico",
    "offerta",
    "offerte",
    "gara",
    "chiarimenti",
    "a pena di esclusione",
    "avvalimento",
    "subappalto",
  ],
};

const COMMON_MONEY_RE = /\b(eur|euro|usd|gbp|cad|aud|sek|nok|dkk|chf|kshs?|kes)\b|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\b/i;
const COMMON_DATE_RE = /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4})\b/i;
const COMMON_TIME_RE = /\b(\d{1,2}[:.]\d{2}(?:\s*(?:am|pm|uhr|ore|h))?|\d{1,2}\s*(?:am|pm|uhr|ore|h))\b/i;

const LANGUAGE_EVIDENCE_PATTERNS: Record<LangCode, EvidenceRegexSet> = {
  en: {
    normative: /\b(shall not|shall|must not|must|required|is required|are required|will be rejected|disqualified|rejection|mandatory)\b/i,
    deadline: /\b(deadline|closing|submit|submission|delivered|on or before|no later than|clarification deadline)\b/i,
    submission: /\b(sealed envelope|envelope|copies|original|physically|electronic|online portal|upload|address|p\.o\. box|po box|procurement portal)\b/i,
    security: /\b(tender security|bid security|guarantee|security bond|performance bond)\b/i,
    prohibition: /\b(not permitted|not allowed|shall not|must not|prohibited)\b/i,
    qualification: /\b(eligibility|qualification|experience|turnover|certificate|certification|iso\s*9001|iso\s*27001|references?)\b/i,
    commercial: /\b(price|pricing|commercial|payment terms|fixed price|rates|fee|fees|budget|currency|vat)\b/i,
    evaluation: /\b(evaluation|award criteria|scoring|weighted|points|technical score|financial score|most economically advantageous)\b/i,
    contract_terms: /\b(contract term|term of the contract|renewal|extension|liability|indemnity|termination|penalt(?:y|ies)|service credits|governing law|warranty)\b/i,
  },
  de: {
    normative: /\b(muss|müssen|muessen|ist erforderlich|sind erforderlich|erforderlich|zwingend|verpflichtend|vorzulegen|einzureichen|ausschluss|ausgeschlossen|wird ausgeschlossen|darf nicht|dürfen nicht)\b/i,
    deadline: /\b(frist|abgabefrist|einreichfrist|spätestens|spaetestens|bis zum|schlussfrist|angebotsfrist|teilnahmefrist)\b/i,
    submission: /\b(vergabeportal|plattform|einzureichen|abzugeben|angebot ist einzureichen|elektronisch|schriftlich|umschlag|anschrift|adresse)\b/i,
    security: /\b(sicherheit|bürgschaft|buergschaft|angebotssicherheit|vertragserfüllungsbürgschaft|vertragserfuellungsbuergschaft)\b/i,
    prohibition: /\b(nicht zulässig|nicht zulaessig|unzulässig|unzulaessig|darf nicht|dürfen nicht|ausgeschlossen)\b/i,
    qualification: /\b(eignung|nachweis|referenz|umsatz|zertifikat|zertifizierung|iso\s*9001|iso\s*27001|fachkunde|leistungsfähigkeit|leistungsfaehigkeit)\b/i,
    commercial: /\b(preis|preise|preisblatt|vergütung|verguetung|zahlung|zahlungsbedingungen|festpreis|stunden(?:satz|saetze)|budget|waehrung|währung)\b/i,
    evaluation: /\b(wertung|bewertung|zuschlagskriterien|punkte|gewichtung|wirtschaftlichstes angebot|wertungskriterien)\b/i,
    contract_terms: /\b(vertragslaufzeit|laufzeit|verlängerung|verlaengerung|kündigung|kuendigung|haftung|vertragsstrafe|strafen|gewährleistung|gewaehrleistung)\b/i,
  },
  es: {
    normative: /\b(debe|deben|obligatori[oa]s?|requerid[oa]s?|es obligatorio|son obligatorios|quedar[aá] excluido|exclusi[oó]n|inadmisible|no se admite|no se permiten)\b/i,
    deadline: /\b(plazo|fecha límite|fecha limite|hasta el día|hasta el dia|antes de las|presentaci[oó]n de ofertas|límite de presentaci[oó]n|limite de presentaci[oó]n)\b/i,
    submission: /\b(plataforma|portal|presentaci[oó]n electr[oó]nica|sobre|sobres|direcci[oó]n|adjuntar|subir|licitaci[oó]n electr[oó]nica)\b/i,
    security: /\b(garant[ií]a|garant[ií]a provisional|garant[ií]a definitiva|aval|fianza)\b/i,
    prohibition: /\b(no se admite|no se permiten|prohibido|debe abstenerse|inadmisible|exclusi[oó]n)\b/i,
    qualification: /\b(solvencia|experiencia|certificado|certificaci[oó]n|facturaci[oó]n|iso\s*9001|iso\s*27001|referencias?)\b/i,
    commercial: /\b(precio|precios|oferta econ[oó]mica|pago|pagos|tarifa|tarifas|presupuesto|moneda|iva)\b/i,
    evaluation: /\b(criterios? de adjudicaci[oó]n|evaluaci[oó]n|valoraci[oó]n|puntuaci[oó]n|ponderaci[oó]n|oferta econ[oó]micamente m[aá]s ventajosa)\b/i,
    contract_terms: /\b(plazo contractual|duraci[oó]n del contrato|pr[oó]rroga|renovaci[oó]n|resoluci[oó]n|penalidades?|responsabilidad|garant[ií]a)\b/i,
  },
  fr: {
    normative: /\b(doit|doivent|obligatoire|obligatoires|exig[eé]e?s?|requis|requise|requises|non admis|interdit|exclusion|sera rejet[ée])\b/i,
    deadline: /\b(date limite|avant le|au plus tard|délai|delai|remise des offres|date de remise|heure limite)\b/i,
    submission: /\b(plateforme|portail|dép[oô]t électronique|depot electronique|enveloppe|adresse|transmission|t[ée]l[ée]verser|soumission [ée]lectronique)\b/i,
    security: /\b(garantie|caution|retenue de garantie|garantie financi[eè]re)\b/i,
    prohibition: /\b(interdit|non admis|ne peut pas|ne peuvent pas|exclusion|rejet[ée])\b/i,
    qualification: /\b(capacit[ée]|qualification|certificat|certification|chiffre d'affaires|r[eé]f[eé]rences?|iso\s*9001|iso\s*27001|exp[eé]rience)\b/i,
    commercial: /\b(prix|tarif|tarifs|offre financi[eè]re|paiement|conditions de paiement|budget|devise|tva)\b/i,
    evaluation: /\b(crit[eè]res? d['’]attribution|[ée]valuation|notation|pond[eé]ration|points|offre [ée]conomiquement la plus avantageuse)\b/i,
    contract_terms: /\b(dur[ée]e du contrat|reconduction|renouvellement|r[eé]siliation|responsabilit[eé]|p[eé]nalit[eé]s?|garantie)\b/i,
  },
  it: {
    normative: /\b(a pena di esclusione|deve|devono|obbligatori[oaie]?|e richiesto|è richiesto|sono richiesti|da presentare|da allegare|esclusione|vietato|non ammesso|non sono ammess[ei])\b/i,
    deadline: /\b(termine|scadenza|entro e non oltre|entro le ore|presentazione dell'offerta|presentazione delle offerte|chiarimenti entro|pervenire entro)\b/i,
    submission: /\b(portale|piattaforma|messaggistica on line|offerta tecnica|offerta economica|busta amministrativa|busta tecnica|busta economica|firma digitale|caricare|inviare|pec)\b/i,
    security: /\b(garanzia|cauzione|cauzione provvisoria|garanzia provvisoria|garanzia definitiva|polizza fideiussoria)\b/i,
    prohibition: /\b(vietato|non ammesso|non sono ammess[ei]|esclusione|a pena di esclusione)\b/i,
    qualification: /\b(requisiti|fatturato|certificazione|certificazioni|iso\s*9001|iso\s*27001|avvalimento|subappalto|anac|cig|dgue|referenze?)\b/i,
    commercial: /\b(prezzo|prezzi|offerta economica|corrispettivo|pagamento|pagamenti|canone|tariffa|tariffe|budget|valuta|iva)\b/i,
    evaluation: /\b(criteri? di aggiudicazione|valutazione|punteggio|ponderazione|offerta economicamente pi[uù] vantaggiosa)\b/i,
    contract_terms: /\b(durata del contratto|durata contrattuale|rinnovo|proroga|recesso|penali|responsabilit[aà]|garanzia)\b/i,
  },
};

function detectSourceLanguage(text: string): LangCode {
  const sample = String(text ?? "").slice(0, 12000).toLowerCase();
  const scores: Record<LangCode, number> = { en: 0, de: 0, es: 0, fr: 0, it: 0 };

  for (const lang of Object.keys(LANGUAGE_DETECTION_TERMS) as LangCode[]) {
    for (const term of LANGUAGE_DETECTION_TERMS[lang]) {
      if (sample.includes(term)) scores[lang] += 3;
    }
    const patterns = LANGUAGE_EVIDENCE_PATTERNS[lang];
    for (const re of [patterns.normative, patterns.deadline, patterns.submission, patterns.security, patterns.qualification]) {
      const hits = sample.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
      if (hits?.length) scores[lang] += Math.min(hits.length, 4);
    }
  }

  const ranked = (Object.entries(scores) as Array<[LangCode, number]>).sort((a, b) => b[1] - a[1]);
  if (!ranked[0] || ranked[0][1] <= 0) return "en";
  if (ranked[0][1] === ranked[1]?.[1] && ranked[0][0] !== "en") {
    return ranked[1][0] === "en" ? ranked[0][0] : "en";
  }
  return ranked[0][0];
}

async function loadUserLanguagesAdmin(supabaseAdmin: any, userId: string): Promise<{ ui: LangCode; output: LangCode }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("locale,output_language")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    const ui = normalizeLang((data as any)?.locale);
    const out = normalizeLang((data as any)?.output_language ?? (data as any)?.locale);
    return { ui, output: out };
  } catch {
    // Columns may not exist yet; keep the system robust.
    return { ui: "en", output: "en" };
  }
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

function estimateUsd(args: { modelKey: string; inputTokens: number; outputTokens: number }): number | null {
  // Prices per 1M tokens (USD) for currently supported OpenAI models.
  const entry = getRegistryEntry(args.modelKey);
  if (!entry || entry.provider !== "openai") return null;

  const m = entry.providerModel;

  let inPerM = 0.25;
  let outPerM = 2.00;

  if (m === "gpt-5-mini") {
    inPerM = 0.25;
    outPerM = 2.00;
  } else if (m === "gpt-4o-mini") {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePlainObjects(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergePlainObjects(out[key] as Record<string, unknown>, value);
      continue;
    }
    out[key] = value;
  }

  return out;
}

async function mergeJobPipeline(
  supabaseAdmin: any,
  job: JobRow,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: any }> {
  const existingPipeline = isPlainObject(job.pipeline) ? job.pipeline as Record<string, unknown> : {};
  const nextPipeline = mergePlainObjects(existingPipeline, patch);
  const { error } = await supabaseAdmin.from("jobs").update({ pipeline: nextPipeline }).eq("id", job.id);

  if (error) {
    return { ok: false, error };
  }

  job.pipeline = nextPipeline;
  return { ok: true };
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

function isAlphaNumericChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

function normalizeAiTextPunctuation(input: unknown): string {
  const raw = String(input ?? "");
  if (!raw) return "";

  return raw
    .replace(/[—–―]+/g, ": ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[	 ]+/g, " ")
    .replace(/\s+:/g, ":")
    .replace(/:\s*:+/g, ": ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?!\s|$)/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAiTextValue(input: unknown, maxLen = 260): string {
  return normalizeAiTextPunctuation(String(input ?? "")).slice(0, maxLen).trim();
}

function normalizeAiTextList(input: unknown, maxItems: number, maxLen = 220): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeAiTextValue(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeAiMultilineText(input: unknown, maxLen = 3200): string {
  const raw = String(input ?? "");
  if (!raw.trim()) return "";
  const lines = raw
    .split(/\r?\n/)
    .map((line) => normalizeAiTextPunctuation(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return lines.slice(0, maxLen).trim();
}

function normalizeAiOutputForUi(input: AiOutput): AiOutput {
  const executive = input?.executive_summary ?? ({} as AiOutput["executive_summary"]);
  const evidenceCoverage = executive?.evidence_coverage ?? {
    submission: "not_found",
    eligibility: "not_found",
    scope: "not_found",
    commercial: "not_found",
    evaluation: "not_found",
    contract_terms: "not_found",
    note: "",
  };

  return {
    ...input,
    executive_summary: {
      ...executive,
      decisionBadge: executive?.decisionBadge === "Go" || executive?.decisionBadge === "Hold" || executive?.decisionBadge === "No-Go"
        ? executive.decisionBadge
        : "Hold",
      decisionLine: normalizeAiTextValue(executive?.decisionLine, 220),
      decision_reasons: (Array.isArray(executive?.decision_reasons) ? executive.decision_reasons : [])
        .map((item: any) => ({
          ...item,
          reason: normalizeAiTextValue(item?.reason, 260),
          evidence_ids: Array.isArray(item?.evidence_ids) ? item.evidence_ids.map((id: any) => String(id)).filter(Boolean).slice(0, 4) : [],
        }))
        .filter((item: any) => item.reason)
        .slice(0, 6),
      hard_blockers: (Array.isArray(executive?.hard_blockers) ? executive.hard_blockers : [])
        .map((item: any) => ({
          ...item,
          title: normalizeAiTextValue(item?.title, 140),
          detail: normalizeAiTextValue(item?.detail, 260),
          evidence_ids: Array.isArray(item?.evidence_ids) ? item.evidence_ids.map((id: any) => String(id)).filter(Boolean).slice(0, 4) : [],
        }))
        .filter((item: any) => item.title || item.detail)
        .slice(0, 5),
      evidence_coverage: {
        submission: evidenceCoverage?.submission === "covered" || evidenceCoverage?.submission === "partial" || evidenceCoverage?.submission === "not_found" ? evidenceCoverage.submission : "not_found",
        eligibility: evidenceCoverage?.eligibility === "covered" || evidenceCoverage?.eligibility === "partial" || evidenceCoverage?.eligibility === "not_found" ? evidenceCoverage.eligibility : "not_found",
        scope: evidenceCoverage?.scope === "covered" || evidenceCoverage?.scope === "partial" || evidenceCoverage?.scope === "not_found" ? evidenceCoverage.scope : "not_found",
        commercial: evidenceCoverage?.commercial === "covered" || evidenceCoverage?.commercial === "partial" || evidenceCoverage?.commercial === "not_found" ? evidenceCoverage.commercial : "not_found",
        evaluation: evidenceCoverage?.evaluation === "covered" || evidenceCoverage?.evaluation === "partial" || evidenceCoverage?.evaluation === "not_found" ? evidenceCoverage.evaluation : "not_found",
        contract_terms: evidenceCoverage?.contract_terms === "covered" || evidenceCoverage?.contract_terms === "partial" || evidenceCoverage?.contract_terms === "not_found" ? evidenceCoverage.contract_terms : "not_found",
        note: normalizeAiTextValue(evidenceCoverage?.note, 220),
      },
      keyFindings: normalizeAiTextList(executive?.keyFindings, 6, 220),
      nextActions: normalizeAiTextList(executive?.nextActions, 4, 220),
      topRisks: (Array.isArray(executive?.topRisks) ? executive.topRisks : [])
        .map((item: any) => ({
          ...item,
          title: normalizeAiTextValue(item?.title, 140),
          detail: normalizeAiTextValue(item?.detail, 260),
        }))
        .filter((item: any) => item.title || item.detail)
        .slice(0, 5),
      submissionDeadline: normalizeAiTextValue(executive?.submissionDeadline, 120) || DEADLINE_NOT_FOUND_TEXT,
      llmDecisionBadge: executive?.llmDecisionBadge === "Go" || executive?.llmDecisionBadge === "Hold" || executive?.llmDecisionBadge === "No-Go"
        ? executive.llmDecisionBadge
        : undefined,
      finalDecisionBadge: executive?.finalDecisionBadge === "Go" || executive?.finalDecisionBadge === "Hold" || executive?.finalDecisionBadge === "No-Go"
        ? executive.finalDecisionBadge
        : undefined,
      decisionSource: normalizeDecisionSourceValue(executive?.decisionSource),
      hardStopReasons: normalizeAiTextList(executive?.hardStopReasons, 4, 180),
      submissionDeadlineIso: (() => {
        const v = String(executive?.submissionDeadlineIso ?? "").trim();
        return v || null;
      })(),
      submissionTimezone: (() => {
        const v = String(executive?.submissionTimezone ?? "").trim();
        return v || null;
      })(),
      submissionDeadlineSource: (() => {
        const v = String(executive?.submissionDeadlineSource ?? "").trim();
        return v === "llm" || v === "evidence_fallback" || v === "not_found" || v === "unparseable" ? v : undefined;
      })(),
      tenderStatus: normalizeTenderStatusValue(executive?.tenderStatus),
    },
    checklist: (Array.isArray(input?.checklist) ? input.checklist : [])
      .map((item: any) => ({
        ...item,
        text: normalizeAiTextValue(item?.text, 260),
      }))
      .filter((item: any) => item.text)
      .slice(0, 20),
    risks: (Array.isArray(input?.risks) ? input.risks : [])
      .map((item: any) => ({
        ...item,
        title: normalizeAiTextValue(item?.title, 140),
        detail: normalizeAiTextValue(item?.detail, 260),
      }))
      .filter((item: any) => item.title || item.detail)
      .slice(0, 12),
    buyer_questions: normalizeAiTextList(input?.buyer_questions, 8, 220),
    proposal_draft: normalizeAiMultilineText(input?.proposal_draft, 3200),
    policy_triggers: (Array.isArray(input?.policy_triggers) ? input.policy_triggers : [])
      .map((item: any) => ({
        ...item,
        key: normalizeAiTextValue(item?.key, 80),
        note: normalizeAiTextValue(item?.note, 180),
        rule: item?.rule == null ? null : normalizeAiTextValue(item?.rule, 180),
      }))
      .filter((item: any) => item.key && item.note)
      .slice(0, 8),
  };
}


function normalizeDecisionSourceValue(input: unknown): DecisionSource {
  const value = String(input ?? "").trim();
  if (value === "hard_rule" || value === "policy_rule") return value;
  return "llm";
}

function normalizeTenderStatusValue(input: unknown): TenderStatus {
  const value = String(input ?? "").trim();
  if (value === "open" || value === "expired") return value;
  return "unclear";
}

const DEADLINE_NOT_FOUND_TEXT = "Not found in extracted text";

const TIMEZONE_OFFSETS_MINUTES: Record<string, number> = {
  UTC: 0,
  GMT: 0,
  BST: 60,
  WET: 0,
  WEST: 60,
  CET: 60,
  CEST: 120,
  EET: 120,
  EEST: 180,
  PST: -480,
  PDT: -420,
  MST: -420,
  MDT: -360,
  CST: -360,
  CDT: -300,
  EST: -300,
  EDT: -240,
};

function extractTimezoneLabel(raw: string): string | null {
  const match = String(raw ?? "").toUpperCase().match(/\b(UTC|GMT|BST|WET|WEST|CET|CEST|EET|EEST|PST|PDT|MST|MDT|CST|CDT|EST|EDT)\b/);
  return match ? match[1] : null;
}

function buildUtcIso(args: { year: number; month: number; day: number; hour?: number; minute?: number; timezone?: string | null; assumeEndOfDay?: boolean }): string | null {
  const year = args.year;
  const month = args.month;
  const day = args.day;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const hour = Number.isFinite(args.hour as number) ? Number(args.hour) : args.assumeEndOfDay ? 23 : 0;
  const minute = Number.isFinite(args.minute as number) ? Number(args.minute) : args.assumeEndOfDay ? 59 : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const tz = args.timezone ? String(args.timezone).toUpperCase() : null;
  const offsetMinutes = tz && tz in TIMEZONE_OFFSETS_MINUTES ? TIMEZONE_OFFSETS_MINUTES[tz] : 0;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, args.assumeEndOfDay ? 59 : 0, 0) - (offsetMinutes * 60 * 1000);
  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1,
  january: 1,
  gennaio: 1,
  gen: 1,
  janvier: 1,
  januar: 1,
  ene: 1,
  enero: 1,
  feb: 2,
  february: 2,
  febbraio: 2,
  fevrier: 2,
  février: 2,
  februar: 2,
  febrero: 2,
  mar: 3,
  march: 3,
  marzo: 3,
  mars: 3,
  märz: 3,
  maerz: 3,
  abr: 4,
  apr: 4,
  april: 4,
  aprile: 4,
  avril: 4,
  abril: 4,
  may: 5,
  maggio: 5,
  mai: 5,
  mayo: 5,
  mag: 5,
  jun: 6,
  june: 6,
  giugno: 6,
  juin: 6,
  juni: 6,
  junio: 6,
  giu: 6,
  jul: 7,
  july: 7,
  luglio: 7,
  juillet: 7,
  juli: 7,
  julio: 7,
  lug: 7,
  aug: 8,
  august: 8,
  agosto: 8,
  aout: 8,
  août: 8,
  ago: 8,
  sep: 9,
  sept: 9,
  september: 9,
  settembre: 9,
  set: 9,
  septembre: 9,
  septiembre: 9,
  okt: 10,
  oct: 10,
  october: 10,
  ottobre: 10,
  octobre: 10,
  oktober: 10,
  octubre: 10,
  ott: 10,
  nov: 11,
  november: 11,
  novembre: 11,
  noviembre: 11,
  dec: 12,
  december: 12,
  dicembre: 12,
  decembre: 12,
  décembre: 12,
  dezember: 12,
  diciembre: 12,
  dic: 12,
};

const DEADLINE_TIMEZONE_TOKEN = String.raw`(?:UTC|GMT|BST|WET|WEST|CET|CEST|EET|EEST|PST|PDT|MST|MDT|CST|CDT|EST|EDT)`;
const MULTILINGUAL_MONTH_TOKEN = String.raw`[A-Za-zÀ-ÿ]{3,15}`;
const SUBMISSION_DEADLINE_POSITIVE_PATTERNS = [
  /\b(tender submission deadline|submission deadline|deadline for (?:submission|tenders?|offers?|bids?)|offer deadline|bid deadline|tender deadline|deadline to submit)\b/i,
  /\b(termine di presentazione(?: delle offerte| dell'offerta| della domanda di partecipazione)?|scadenza(?: per la presentazione(?: delle offerte| dell'offerta))?|presentazione dell'offerta|presentazione delle offerte|entro e non oltre)\b/i,
  /\b(date limite(?: de remise| de soumission)?|date de remise des offres|date de soumission|remise des offres|soumission des offres|au plus tard le)\b/i,
  /\b(angebotsfrist|einreichungsfrist|frist zur einreichung|frist für die abgabe|abgabefrist|abgabe der angebote|spätestens bis|spaetestens bis|spätestens zum|spaetestens zum)\b/i,
  /\b(fecha l[íi]mite(?: de presentaci[oó]n)?|plazo de presentaci[oó]n|presentaci[oó]n de ofertas|a m[aá]s tardar|antes del)\b/i,
];
const SUBMISSION_DEADLINE_NEGATIVE_PATTERN = /\b(chiarimenti?|clarifications?|questions?|faq|quesiti|messaggistica|qa\b|q&a|site visit|visita|inspection|briefing|opening|apertura|award|aggiudicazione|stipula|signature|firma del contratto|date limite des questions|questions des soumissionnaires|fragen|bieterfragen|aclaraciones?)\b/i;
const SUBMISSION_CONTEXT_PATTERN = /\b(submi(?:ssion|t)|offer|tender|bid|offert[ae]|domanda di partecipazione|presentazione(?: delle offerte| dell'offerta)?|soumission|remise des offres|offre|angebote?|einreichung|presentaci[oó]n(?: de ofertas?)?|oferta)\b/i;
const EXPLICIT_SUBMISSION_LABEL_PATTERN = new RegExp([
  String.raw`\b(?:tender submission deadline|submission deadline|deadline for (?:submission|tenders?|offers?|bids?)|offer deadline|bid deadline|tender deadline)\b`,
  String.raw`\b(?:termine di presentazione(?: delle offerte| dell'offerta| della domanda di partecipazione)?|scadenza(?: per la presentazione(?: delle offerte| dell'offerta))?)\b`,
  String.raw`\b(?:date limite(?: de remise| de soumission)?|date de remise des offres|date de soumission)\b`,
  String.raw`\b(?:angebotsfrist|einreichungsfrist|frist zur einreichung|frist für die abgabe|abgabefrist|abgabe der angebote)\b`,
  String.raw`\b(?:fecha l[íi]mite(?: de presentaci[oó]n)?|plazo de presentaci[oó]n|presentaci[oó]n de ofertas)\b`,
].join("|"), "i");

function scoreSubmissionDeadlineHint(text: string): number {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return -999;
  let score = 0;
  for (const pattern of SUBMISSION_DEADLINE_POSITIVE_PATTERNS) {
    if (pattern.test(normalized)) score += 6;
  }
  if (EXPLICIT_SUBMISSION_LABEL_PATTERN.test(normalized)) score += 8;
  if (SUBMISSION_CONTEXT_PATTERN.test(normalized)) score += 4;
  if (/\b(?:ore|at|alle|a las|um|à|au|am)\s*\d{1,2}[:.]\d{2}\b/i.test(normalized) || /\b\d{1,2}[:.]\d{2}\b/.test(normalized)) score += 2;
  if (/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(normalized) || new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+${MULTILINGUAL_MONTH_TOKEN}\s+\d{2,4}\b`, "i").test(normalized)) score += 2;
  if (/\b(?:entro e non oltre|au plus tard|spätestens|spaetestens|a m[aá]s tardar)\b/i.test(normalized)) score += 2;
  if (SUBMISSION_DEADLINE_NEGATIVE_PATTERN.test(normalized)) score -= 8;
  if (/(?:chiarimenti?|clarifications?|questions?|faq|quesiti|fragen|aclaraciones?)/i.test(normalized) && !/(?:offert[ae]|submission|soumission|angebote?|presentaci[oó]n)/i.test(normalized)) score -= 6;
  if (normalized.length <= 260) score += 1;
  return score;
}

function normalizeSubmissionDeadline(rawInput: unknown): {
  rawText: string;
  iso: string | null;
  timezone: string | null;
  parseStatus: "not_found" | "parsed" | "unparseable";
} {
  const rawText = normalizeAiTextValue(rawInput, 220);
  if (!rawText || rawText.toLowerCase() === DEADLINE_NOT_FOUND_TEXT.toLowerCase()) {
    return { rawText: DEADLINE_NOT_FOUND_TEXT, iso: null, timezone: null, parseStatus: "not_found" };
  }

  const text = rawText.replace(/\s+/g, " ").trim();
  const timezone = extractTimezoneLabel(text);

  const patterns = [
    new RegExp(String.raw`\b(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(${DEADLINE_TIMEZONE_TOKEN})?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b`, "i"),
    new RegExp(String.raw`\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+(?:at|alle|ore|um|a las|à|au)\b|\s*,)?\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(${DEADLINE_TIMEZONE_TOKEN})?\b`, "i"),
    new RegExp(String.raw`\b(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2})[:.](\d{2}))?\s*(${DEADLINE_TIMEZONE_TOKEN})?\b`, "i"),
    new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MULTILINGUAL_MONTH_TOKEN})\s+(\d{2,4})(?:\s+(?:at|alle|ore|um|a las|à|au)\b|\s*,)?\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(${DEADLINE_TIMEZONE_TOKEN})?\b`, "i"),
    new RegExp(String.raw`\b(\d{1,2})[:.](\d{2})\s*(AM|PM)?\s*(${DEADLINE_TIMEZONE_TOKEN})?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(${MULTILINGUAL_MONTH_TOKEN})\s+(\d{2,4})\b`, "i"),
  ];

  const first = text.match(patterns[0]);
  if (first) {
    let hour = Number(first[1]);
    const minute = Number(first[2]);
    const ampm = String(first[3] ?? "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const tz = String(first[4] ?? timezone ?? "").toUpperCase() || null;
    const day = Number(first[5]);
    const month = Number(first[6]);
    let year = Number(first[7]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const iso = buildUtcIso({ year, month, day, hour, minute, timezone: tz, assumeEndOfDay: false });
    return { rawText, iso, timezone: tz, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const second = text.match(patterns[1]);
  if (second) {
    const day = Number(second[1]);
    const month = Number(second[2]);
    let year = Number(second[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    let hour = Number(second[4]);
    const minute = Number(second[5]);
    const ampm = String(second[6] ?? "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const tz = String(second[7] ?? timezone ?? "").toUpperCase() || null;
    const iso = buildUtcIso({ year, month, day, hour, minute, timezone: tz, assumeEndOfDay: false });
    return { rawText, iso, timezone: tz, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const third = text.match(patterns[2]);
  if (third) {
    const year = Number(third[1]);
    const month = Number(third[2]);
    const day = Number(third[3]);
    const hour = third[4] == null ? undefined : Number(third[4]);
    const minute = third[5] == null ? undefined : Number(third[5]);
    const tz = String(third[6] ?? timezone ?? "").toUpperCase() || null;
    const iso = buildUtcIso({ year, month, day, hour, minute, timezone: tz, assumeEndOfDay: hour == null && minute == null });
    return { rawText, iso, timezone: tz, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const fourth = text.match(patterns[3]);
  if (fourth) {
    const day = Number(fourth[1]);
    const month = MONTH_NAME_TO_NUMBER[String(fourth[2] ?? "").toLowerCase()];
    let year = Number(fourth[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    let hour = Number(fourth[4]);
    const minute = Number(fourth[5]);
    const ampm = String(fourth[6] ?? "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const tz = String(fourth[7] ?? timezone ?? "").toUpperCase() || null;
    const iso = month ? buildUtcIso({ year, month, day, hour, minute, timezone: tz, assumeEndOfDay: false }) : null;
    return { rawText, iso, timezone: tz, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const fifth = text.match(patterns[4]);
  if (fifth) {
    let hour = Number(fifth[1]);
    const minute = Number(fifth[2]);
    const ampm = String(fifth[3] ?? "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const tz = String(fifth[4] ?? timezone ?? "").toUpperCase() || null;
    const day = Number(fifth[5]);
    const month = MONTH_NAME_TO_NUMBER[String(fifth[6] ?? "").toLowerCase()];
    let year = Number(fifth[7]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const iso = month ? buildUtcIso({ year, month, day, hour, minute, timezone: tz, assumeEndOfDay: false }) : null;
    return { rawText, iso, timezone: tz, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const dateOnly = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (dateOnly) {
    const day = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    let year = Number(dateOnly[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const iso = buildUtcIso({ year, month, day, timezone, assumeEndOfDay: true });
    return { rawText, iso, timezone, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const dateOnlyMonthName = text.match(new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MULTILINGUAL_MONTH_TOKEN})\s+(\d{2,4})\b`, "i"));
  if (dateOnlyMonthName) {
    const day = Number(dateOnlyMonthName[1]);
    const month = MONTH_NAME_TO_NUMBER[String(dateOnlyMonthName[2] ?? "").toLowerCase()];
    let year = Number(dateOnlyMonthName[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const iso = month ? buildUtcIso({ year, month, day, timezone, assumeEndOfDay: true }) : null;
    return { rawText, iso, timezone, parseStatus: iso ? "parsed" : "unparseable" };
  }

  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) {
    return { rawText, iso: fallback.toISOString(), timezone, parseStatus: "parsed" };
  }

  return { rawText, iso: null, timezone, parseStatus: "unparseable" };
}

function extractSubmissionDeadlineHints(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): string[] {
  const weighted = new Map<string, number>();
  const evidenceBias = new Map<string, number>();

  const push = (value: unknown, bonus = 0, source: "evidence" | "text" = "text") => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const key = text.toLowerCase();
    const score = scoreSubmissionDeadlineHint(text) + bonus;
    const existing = weighted.get(key) ?? Number.NEGATIVE_INFINITY;
    if (score > existing) weighted.set(key, score);
    if (source === "evidence") {
      const evidenceScore = evidenceBias.get(key) ?? 0;
      evidenceBias.set(key, Math.max(evidenceScore, 2));
    }
  };

  const labelWindowPatterns = [
    /(Tender Submission Deadline[^\n]{0,180})/ig,
    /(Submission Deadline[^\n]{0,180})/ig,
    /(deadline for (?:submission|offers?|bids?|tenders?)[^\n]{0,180})/ig,
    /(termine di presentazione[^\n]{0,180})/ig,
    /(scadenza[^\n]{0,180})/ig,
    /(entro e non oltre[^\n]{0,180})/ig,
    /(date limite[^\n]{0,180})/ig,
    /(remise des offres[^\n]{0,180})/ig,
    /(soumission[^\n]{0,180})/ig,
    /(Angebotsfrist[^\n]{0,180})/ig,
    /(Einreichungsfrist[^\n]{0,180})/ig,
    /(Abgabefrist[^\n]{0,180})/ig,
    /(fecha l[íi]mite[^\n]{0,180})/ig,
    /(plazo de presentaci[oó]n[^\n]{0,180})/ig,
    /(a m[aá]s tardar[^\n]{0,180})/ig,
  ];

  const temporalRowPatterns = [
    new RegExp(String.raw`([^\n]{0,120}\b\d{1,2}[:.]\d{2}\b[^\n]{0,40}\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b[^\n]{0,120})`, "ig"),
    new RegExp(String.raw`([^\n]{0,120}\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b[^\n]{0,40}\b\d{1,2}[:.]\d{2}\b[^\n]{0,120})`, "ig"),
    new RegExp(String.raw`([^\n]{0,120}\b\d{1,2}(?:st|nd|rd|th)?\s+${MULTILINGUAL_MONTH_TOKEN}\s+\d{2,4}\b[^\n]{0,120})`, "ig"),
  ];

  const considerBlock = (value: string, source: "evidence" | "text") => {
    if (!value) return;
    const compact = value.replace(/\s+/g, " ").trim();
    for (const pattern of labelWindowPatterns) {
      const matches = compact.match(pattern) ?? [];
      for (const match of matches) push(match, 4, source);
    }
    for (const pattern of temporalRowPatterns) {
      const matches = compact.match(pattern) ?? [];
      for (const match of matches) {
        if (scoreSubmissionDeadlineHint(match) >= 4) push(match, 2, source);
      }
    }
    if (scoreSubmissionDeadlineHint(compact) >= 8) {
      push(compact, 1, source);
    }
  };

  for (const candidate of args.evidenceCandidates ?? []) {
    considerBlock(String(candidate?.excerpt ?? ""), "evidence");
    considerBlock(String(candidate?.anchor ?? ""), "evidence");
  }

  const extractedText = String(args.extractedText ?? "");
  if (extractedText) {
    const lines = extractedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const joined = [lines[i - 1], line, lines[i + 1]].filter(Boolean).join(" ");
      if (scoreSubmissionDeadlineHint(line) >= 4) {
        push(joined || line, 3, "text");
        push(line, 2, "text");
      } else if (scoreSubmissionDeadlineHint(joined) >= 8) {
        push(joined, 2, "text");
      }
    }
    considerBlock(extractedText, "text");
  }

  return [...weighted.entries()]
    .sort((a, b) => {
      const scoreA = a[1] + (evidenceBias.get(a[0]) ?? 0);
      const scoreB = b[1] + (evidenceBias.get(b[0]) ?? 0);
      return scoreB - scoreA;
    })
    .map(([value]) => value)
    .slice(0, 16);
}

function resolveSubmissionDeadline(args: { rawInput: unknown; evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }) {
  const direct = normalizeSubmissionDeadline(args.rawInput);
  if (direct.parseStatus === "parsed") return { ...direct, source: "llm" as const };

  const hints = extractSubmissionDeadlineHints({
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });

  const parsedHints = hints
    .map((hint) => {
      const parsed = normalizeSubmissionDeadline(hint);
      const deadlineMs = parsed.iso ? Date.parse(parsed.iso) : Number.NEGATIVE_INFINITY;
      return {
        hint,
        parsed,
        score: scoreSubmissionDeadlineHint(hint) + (parsed.parseStatus === "parsed" ? 6 : 0),
        deadlineMs: Number.isFinite(deadlineMs) ? deadlineMs : Number.NEGATIVE_INFINITY,
      };
    })
    .filter((item) => item.parsed.parseStatus === "parsed");

  parsedHints.sort((a, b) => (b.score - a.score) || (b.deadlineMs - a.deadlineMs) || (a.hint.length - b.hint.length));

  const best = parsedHints[0];
  if (best) {
    return { ...best.parsed, source: "evidence_fallback" as const };
  }

  return { ...direct, source: direct.parseStatus === "not_found" ? "not_found" as const : "unparseable" as const };
}

const CLARIFICATION_CONTEXT_PATTERN = /\b(clarification|clarifications|questions?|q&a|faq|chiarimenti?|quesiti|messaggistica|questions? des soumissionnaires|fragen|bieterfragen|rueckfragen|rückfragen|aclaraciones?|consultas?)\b/i;
const SITE_VISIT_CONTEXT_PATTERN = /\b(site visit|inspection|briefing|sopralluogo|visita obbligatoria|presa visione|visite du site|ortsbegehung|besichtigung|visita al sitio)\b/i;
const CONTRACT_DEADLINE_CONTEXT_PATTERN = /\b(contract signature|signature of the contract|standstill|award date|award notice|stipula|firma del contratto|aggiudicazione|signature du contrat|attribution|vertragsunterzeichnung|zuschlag|firma del contrato|adjudicaci[oó]n)\b/i;
const SUBMISSION_SECTION_CONTEXT_PATTERN = /\b(modalit[aà] di presentazione(?: dell'offerta| delle offerte)?|presentazione(?: dell'offerta| delle offerte)?|trasmissione dell'offerta|submission(?: of tenders?)?|submission instructions|submission requirements|remise des offres|soumission des offres|angebotsabgabe|einreichung(?: der angebote)?|presentaci[oó]n de ofertas?)\b/i;
const CLARIFICATION_SECTION_HEADING_PATTERN = CLARIFICATION_CONTEXT_PATTERN;
const SUBMISSION_SENTENCE_PATTERNS = [
  /((?:presentare|trasmettere|inviare|submit|deliver|remettre|soumettre|abgeben|einreichen|presentar)[^.\n]{0,260}?(?:entro e non oltre|no later than|au plus tard|sp[aä]testens|a m[aá]s tardar)[^.\n]{0,120}(?:\b\d{1,2}[:.]\d{2}\b[^.\n]{0,80})?\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b[^.\n]{0,120})/ig,
  /((?:submission|offert[ae]|soumission|angebot|oferta)[^.\n]{0,220}?(?:deadline|scadenza|date limite|angebotsfrist|fecha l[íi]mite)[^.\n]{0,120}(?:\b\d{1,2}[:.]\d{2}\b[^.\n]{0,80})?\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b[^.\n]{0,120})/ig,
];
const CLARIFICATION_SENTENCE_PATTERNS = [
  /((?:clarifications?|questions?|q&a|chiarimenti?|quesiti|messaggistica|fragen|aclaraciones?|consultas?)[^.\n]{0,220}(?:entro e non oltre|no later than|au plus tard|sp[aä]testens|a m[aá]s tardar)?[^.\n]{0,120}(?:\b\d{1,2}[:.]\d{2}\b[^.\n]{0,80})?\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b[^.\n]{0,120})/ig,
];

type CriticalDeadlineCandidate = {
  kind: "submission" | "clarification" | "site_visit" | "contract" | "other";
  text: string;
  heading: string | null;
  source: "evidence" | "text";
  evidence_ids: string[];
  parsed: {
    rawText: string;
    iso: string | null;
    timezone: string | null;
    parseStatus: "not_found" | "parsed" | "unparseable";
  };
  score: number;
};

function looksLikeContextHeading(line: string): boolean {
  const text = String(line ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 180) return false;
  if (/^\[page\s+\d+\]$/i.test(text)) return false;
  if (SUBMISSION_SECTION_CONTEXT_PATTERN.test(text) || CLARIFICATION_CONTEXT_PATTERN.test(text) || SITE_VISIT_CONTEXT_PATTERN.test(text)) return true;
  const uppercaseLike = text === text.toUpperCase() && /[A-ZÀ-Ü]/.test(text) && text.length >= 10;
  const numberedSection = /^(?:[IVXLC]+|\d+(?:[.)]|(?:\.\d+)+))[\s-]+/.test(text);
  return uppercaseLike || numberedSection;
}

function nearestContextHeading(lines: string[], index: number): string | null {
  for (let i = index; i >= 0 && i >= index - 8; i--) {
    const candidate = String(lines[i] ?? "").trim();
    if (looksLikeContextHeading(candidate)) return candidate;
  }
  return null;
}

function classifyDeadlineCandidate(text: string, heading?: string | null): CriticalDeadlineCandidate["kind"] {
  const material = `${String(heading ?? "")} ${String(text ?? "")}`.replace(/\s+/g, " ").trim();
  if (!material) return "other";

  let submission = 0;
  let clarification = 0;
  let siteVisit = 0;
  let contract = 0;

  if (EXPLICIT_SUBMISSION_LABEL_PATTERN.test(material)) submission += 10;
  if (SUBMISSION_CONTEXT_PATTERN.test(material)) submission += 6;
  if (SUBMISSION_SECTION_CONTEXT_PATTERN.test(material)) submission += 5;
  if (/\b(?:entro e non oltre|no later than|au plus tard|sp[aä]testens|a m[aá]s tardar)\b/i.test(material)) submission += 2;
  for (const re of SUBMISSION_DEADLINE_POSITIVE_PATTERNS) if (re.test(material)) submission += 4;

  if (CLARIFICATION_CONTEXT_PATTERN.test(material)) clarification += 10;
  if (/(?:messaggistica|questions? des soumissionnaires|bieterfragen|rueckfragen|rückfragen)/i.test(material)) clarification += 4;

  if (SITE_VISIT_CONTEXT_PATTERN.test(material)) siteVisit += 10;
  if (CONTRACT_DEADLINE_CONTEXT_PATTERN.test(material)) contract += 10;

  if (SUBMISSION_CONTEXT_PATTERN.test(material) && CLARIFICATION_CONTEXT_PATTERN.test(material)) {
    submission += 2;
    clarification += 2;
  }
  if (COMMON_DATE_RE.test(material)) {
    submission += 1;
    clarification += 1;
    siteVisit += 1;
    contract += 1;
  }
  if (COMMON_TIME_RE.test(material)) {
    submission += 1;
    clarification += 1;
  }

  const ranked = [
    { kind: "submission" as const, score: submission },
    { kind: "clarification" as const, score: clarification },
    { kind: "site_visit" as const, score: siteVisit },
    { kind: "contract" as const, score: contract },
  ].sort((a, b) => b.score - a.score);

  return ranked[0].score >= 4 ? ranked[0].kind : "other";
}

function scoreDeadlineCandidate(
  text: string,
  heading: string | null,
  kind: CriticalDeadlineCandidate["kind"],
  source: "evidence" | "text",
  parseStatus: "not_found" | "parsed" | "unparseable",
): number {
  const normalized = `${String(heading ?? "")} ${String(text ?? "")}`.replace(/\s+/g, " ").trim();
  if (!normalized) return -999;

  let score = 0;
  if (kind === "submission") score += scoreSubmissionDeadlineHint(text);
  if (kind === "clarification") {
    if (CLARIFICATION_CONTEXT_PATTERN.test(normalized)) score += 14;
    if (/\b(?:entro e non oltre|no later than|au plus tard|sp[aä]testens|a m[aá]s tardar)\b/i.test(normalized)) score += 2;
  }
  if (kind === "site_visit") score += SITE_VISIT_CONTEXT_PATTERN.test(normalized) ? 12 : 0;
  if (kind === "contract") score += CONTRACT_DEADLINE_CONTEXT_PATTERN.test(normalized) ? 12 : 0;
  if (heading && SUBMISSION_SECTION_CONTEXT_PATTERN.test(heading) && kind === "submission") score += 8;
  if (heading && CLARIFICATION_SECTION_HEADING_PATTERN.test(heading) && kind === "clarification") score += 8;
  if (COMMON_DATE_RE.test(normalized)) score += 2;
  if (COMMON_TIME_RE.test(normalized)) score += 2;
  if (parseStatus === "parsed") score += 8;
  if (parseStatus === "unparseable") score -= 3;
  if (source === "evidence") score += 3;
  if (normalized.length <= 320) score += 1;
  if (kind === "submission" && CLARIFICATION_CONTEXT_PATTERN.test(normalized) && !SUBMISSION_CONTEXT_PATTERN.test(normalized)) score -= 12;
  if (kind === "submission" && (SITE_VISIT_CONTEXT_PATTERN.test(normalized) || CONTRACT_DEADLINE_CONTEXT_PATTERN.test(normalized))) score -= 10;
  return score;
}

function collectDeadlineTextWindows(extractedText: string): Array<{ text: string; heading: string | null }> {
  const raw = String(extractedText ?? "");
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const windows: Array<{ text: string; heading: string | null }> = [];
  const seen = new Set<string>();

  const push = (value: string, heading: string | null = null) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!COMMON_DATE_RE.test(text) && !COMMON_TIME_RE.test(text)) return;
    const key = `${String(heading ?? "").toLowerCase()}__${text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    windows.push({ text, heading });
  };

  for (let i = 0; i < lines.length; i++) {
    const heading = nearestContextHeading(lines, i);
    const line = lines[i];
    const centered = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(" ");
    const forward = lines.slice(i, Math.min(lines.length, i + 4)).join(" ");
    push(line, heading);
    push(centered, heading);
    push(forward, heading);
    if (heading) push(`${heading} ${forward}`, heading);
  }

  for (const pattern of SUBMISSION_SENTENCE_PATTERNS) {
    const matches = raw.match(pattern) ?? [];
    for (const match of matches) push(match, null);
  }
  for (const pattern of CLARIFICATION_SENTENCE_PATTERNS) {
    const matches = raw.match(pattern) ?? [];
    for (const match of matches) push(match, null);
  }

  for (const block of raw.split(/\r?\n\s*\r?\n/)) {
    const compact = String(block ?? "").replace(/\s+/g, " ").trim();
    if (!compact) continue;
    push(compact, null);
  }

  return windows;
}

function extractCriticalDeadlineCandidates(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): CriticalDeadlineCandidate[] {
  const candidates = new Map<string, CriticalDeadlineCandidate>();

  const consider = (value: string, heading: string | null, source: "evidence" | "text", evidenceIds: string[]) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!COMMON_DATE_RE.test(text) && !COMMON_TIME_RE.test(text)) return;
    const kind = classifyDeadlineCandidate(text, heading);
    if (kind === "other") return;
    const parsed = normalizeSubmissionDeadline(text);
    const score = scoreDeadlineCandidate(text, heading, kind, source, parsed.parseStatus);
    if (score < 4) return;
    const key = `${kind}__${text.toLowerCase()}`;
    const existing = candidates.get(key);
    if (!existing || score > existing.score) {
      candidates.set(key, { kind, text, heading, source, evidence_ids: evidenceIds.slice(0, 3), parsed, score });
    }
  };

  for (const candidate of args.evidenceCandidates ?? []) {
    const excerpt = String(candidate?.excerpt ?? "");
    const anchor = String(candidate?.anchor ?? "").trim() || null;
    const evidenceIds = candidate?.id ? [String(candidate.id)] : [];
    consider(excerpt, anchor, "evidence", evidenceIds);
    if (anchor) consider(`${anchor} ${excerpt}`, anchor, "evidence", evidenceIds);
  }

  const windows = collectDeadlineTextWindows(String(args.extractedText ?? ""));
  for (const window of windows) {
    consider(window.text, window.heading, "text", []);
  }

  return [...candidates.values()];
}

function pickBestDeadlineCandidate(candidates: CriticalDeadlineCandidate[], kind: CriticalDeadlineCandidate["kind"]): CriticalDeadlineCandidate | null {
  const ranked = candidates
    .filter((candidate) => candidate.kind === kind)
    .map((candidate) => ({
      ...candidate,
      deadlineMs: candidate.parsed.iso ? Date.parse(candidate.parsed.iso) : Number.NEGATIVE_INFINITY,
    }))
    .sort((a, b) => (b.score - a.score) || (b.deadlineMs - a.deadlineMs) || (a.text.length - b.text.length));
  return ranked[0] ?? null;
}

function resolveDeterministicSubmissionDeadline(args: { rawInput: unknown; evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }) {
  const candidates = extractCriticalDeadlineCandidates({
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });
  const bestSubmission = pickBestDeadlineCandidate(candidates, "submission");
  if (bestSubmission && bestSubmission.parsed.parseStatus === "parsed") {
    return { ...bestSubmission.parsed, source: "evidence_fallback" as const };
  }

  const direct = normalizeSubmissionDeadline(args.rawInput);
  if (direct.parseStatus === "parsed") return { ...direct, source: "llm" as const };
  return { ...direct, source: direct.parseStatus === "not_found" ? "not_found" as const : "unparseable" as const };
}

function resolveDeterministicClarificationDeadline(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): PreExtractedDeadlineFact {
  const candidates = extractCriticalDeadlineCandidates({
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });
  const bestClarification = pickBestDeadlineCandidate(candidates, "clarification");
  if (!bestClarification) {
    return { text: DEADLINE_NOT_FOUND_TEXT, iso: null, timezone: null, source: "not_found" };
  }
  if (bestClarification.parsed.parseStatus !== "parsed") {
    return { text: bestClarification.text || DEADLINE_NOT_FOUND_TEXT, iso: null, timezone: bestClarification.parsed.timezone, source: "unparseable" };
  }
  return {
    text: bestClarification.parsed.rawText || DEADLINE_NOT_FOUND_TEXT,
    iso: bestClarification.parsed.iso,
    timezone: bestClarification.parsed.timezone,
    source: "parsed_from_evidence",
  };
}

function deriveTenderStatus(args: { submissionDeadlineIso?: string | null; nowIso?: string }): TenderStatus {
  const iso = String(args.submissionDeadlineIso ?? "").trim();
  if (!iso) return "unclear";
  const deadlineMs = Date.parse(iso);
  const nowMs = Date.parse(String(args.nowIso ?? new Date().toISOString()));
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return "unclear";
  return deadlineMs < nowMs ? "expired" : "open";
}

type RuleScanSnippet = { text: string; evidence_ids: string[] };
type ExplicitClosureSignal = {
  title: string;
  detail: string;
  reason: string;
  evidence_ids: string[];
  matchedText: string;
};

function collectRuleScanSnippets(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): RuleScanSnippet[] {
  const out: RuleScanSnippet[] = [];
  const seen = new Set<string>();
  const push = (value: unknown, evidenceIds?: string[]) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const key = `${text.toLowerCase()}__${(evidenceIds ?? []).join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, evidence_ids: (evidenceIds ?? []).filter(Boolean).slice(0, 2) });
  };

  for (const candidate of args.evidenceCandidates ?? []) {
    const id = String(candidate?.id ?? "").trim();
    const ids = id ? [id] : [];
    push(candidate?.excerpt, ids);
    push(candidate?.anchor, ids);
  }

  const extractedText = String(args.extractedText ?? "");
  if (extractedText) {
    const lines = extractedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const closureHint = /\b(cancelled|canceled|withdrawn|discontinued|terminated|abandoned|closed|suspended|aufgehoben|eingestellt|widerrufen|zur(?:ü|ue)ckgezogen|annullat\w*|revocat\w*|ritirat\w*|chius\w*|abbandon\w*|annul\w*|abandonn\w*|cl[ôo]tur\w*|retir\w*|cancelad\w*|anulad\w*|cerrad\w*|suspendid\w*)\b/i;
    for (let i = 0; i < lines.length; i++) {
      if (!closureHint.test(lines[i])) continue;
      const block = [lines[i - 1], lines[i], lines[i + 1]].filter(Boolean).join(" ");
      const ids = bestEffortEvidenceIdsFromText({ text: block || lines[i], evidenceCandidates: args.evidenceCandidates, limit: 2 });
      push(block || lines[i], ids);
    }
  }

  return out.slice(0, 24);
}

function detectExplicitClosureSignal(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): ExplicitClosureSignal | null {
  const context = String.raw`(?:tender|procurement|competition|framework|opportunity|bid process|bid|itt|invitation to tender|lot|gara|ausschreibung|vergabe|vergabeverfahren|appel d['’]offres|march[ée] public|licitaci[oó]n|licitacion|procedimiento|gara|procedura|lotto)`;
  const closure = String.raw`(?:cancelled|canceled|withdrawn|discontinued|terminated|abandoned|closed|suspended|aufgehoben|eingestellt|widerrufen|zur(?:ü|ue)ckgezogen|annullat\w*|revocat\w*|ritirat\w*|chius\w*|abbandon\w*|annul\w*|abandonn\w*|cl[ôo]tur\w*|retir\w*|cancelad\w*|anulad\w*|cerrad\w*|suspendid\w*)`;
  const patterns = [
    new RegExp(`\\b${context}\\b[^.!?\\n]{0,100}\\b${closure}\\b`, "i"),
    new RegExp(`\\b${closure}\\b[^.!?\\n]{0,100}\\b${context}\\b`, "i"),
    /\bno further submissions will be accepted\b/i,
    /\bsubmissions? (?:are|is) no longer being accepted\b/i,
  ];

  const snippets = collectRuleScanSnippets(args);
  for (const snippet of snippets) {
    for (const pattern of patterns) {
      const match = snippet.text.match(pattern);
      if (!match) continue;
      const matchedText = String(match[0] ?? snippet.text).replace(/\s+/g, " ").trim();
      const evidenceIds = snippet.evidence_ids.length
        ? snippet.evidence_ids
        : bestEffortEvidenceIdsFromText({ text: matchedText || snippet.text, evidenceCandidates: args.evidenceCandidates, limit: 2 });
      return {
        title: "Tender explicitly cancelled or closed",
        detail: normalizeAiTextValue(`The provided documents indicate that the tender or procurement process is cancelled, withdrawn, closed, suspended, or otherwise ended: ${matchedText}.`, 260),
        reason: "Tender explicitly cancelled, withdrawn, closed, suspended, or otherwise ended",
        evidence_ids: evidenceIds,
        matchedText,
      };
    }
  }

  return null;
}

function applyDecisionConsistencyChecks(args: { aiOut: AiOutput }): AiOutput {
  const executive = args.aiOut?.executive_summary ?? ({} as AiOutput["executive_summary"]);
  const startingDecision = executive?.finalDecisionBadge ?? executive?.decisionBadge;
  let finalDecisionBadge: DecisionBadge = startingDecision === "Go" || startingDecision === "Hold" || startingDecision === "No-Go"
    ? startingDecision
    : "Hold";
  let decisionSource: DecisionSource = normalizeDecisionSourceValue(executive?.decisionSource);
  let decisionLine = normalizeAiTextValue(executive?.decisionLine, 220);
  let keyFindings = normalizeAiTextList(executive?.keyFindings, 6, 220);
  let nextActions = normalizeAiTextList(executive?.nextActions, 4, 220);
  let hardStopReasons = Array.isArray(executive?.hardStopReasons)
    ? executive.hardStopReasons.map((item: any) => normalizeAiTextValue(item, 180)).filter(Boolean).slice(0, 4)
    : [];
  let hardBlockers = Array.isArray(executive?.hard_blockers) ? [...executive.hard_blockers] : [];
  let decisionReasons = Array.isArray(executive?.decision_reasons) ? [...executive.decision_reasons] : [];

  const blockingPolicyTriggers = (Array.isArray(args.aiOut?.policy_triggers) ? args.aiOut.policy_triggers : [])
    .filter((item: any) => String(item?.impact ?? "").trim() === "blocks");

  const unresolvedMustItems = (Array.isArray(args.aiOut?.checklist) ? args.aiOut.checklist : [])
    .filter((item: any) => String(item?.type ?? "").trim() === "MUST")
    .filter((item: any) => item?.needs_verification === true || !Array.isArray(item?.evidence_ids) || item.evidence_ids.length === 0);

  const deadlineSource = String(executive?.submissionDeadlineSource ?? "").trim();

  if (blockingPolicyTriggers.length) {
    const first = blockingPolicyTriggers[0];
    const note = normalizeAiTextValue(first?.note || first?.rule || first?.key, 180) || "Workspace playbook blocks this opportunity.";
    finalDecisionBadge = "No-Go";
    decisionSource = "policy_rule";

    if (!hardStopReasons.some((item) => item.toLowerCase() === note.toLowerCase())) {
      hardStopReasons.unshift(note);
    }

    if (!hardBlockers.some((item: any) => String(item?.title ?? "").toLowerCase().includes("workspace playbook block"))) {
      hardBlockers = [{
        title: "Workspace playbook block",
        detail: note,
        evidence_ids: [],
      }, ...hardBlockers].slice(0, 5);
    }

    if (!decisionReasons.some((item: any) => String(item?.reason ?? "").toLowerCase() === note.toLowerCase())) {
      decisionReasons = [{
        category: "playbook",
        reason: note,
        evidence_ids: [],
      }, ...decisionReasons].slice(0, 6);
    }

    if (!keyFindings.some((item) => item.toLowerCase().includes(note.toLowerCase()))) {
      keyFindings = [`Workspace playbook block: ${note}`, ...keyFindings].slice(0, 6);
    }

    const nextAction = "Do not pursue this tender unless the workspace playbook is updated or an internal exception is approved.";
    if (!nextActions.some((item) => item.toLowerCase().includes("workspace playbook"))) {
      nextActions = [nextAction, ...nextActions].slice(0, 4);
    }

    decisionLine = normalizeAiTextValue(`No Go because an internal workspace playbook rule blocks pursuit: ${note}.`, 220);
  } else if (finalDecisionBadge === "Go" && hardBlockers.length > 0) {
    finalDecisionBadge = "Hold";
    if (decisionSource !== "hard_rule" && decisionSource !== "policy_rule") decisionSource = "llm";
    const reasonText = "Open hard blockers remain unresolved in the current evidence pack";
    if (!hardStopReasons.some((item) => item.toLowerCase() === reasonText.toLowerCase())) {
      hardStopReasons.unshift(reasonText);
    }
    if (!decisionReasons.some((item: any) => String(item?.reason ?? "").toLowerCase() === reasonText.toLowerCase())) {
      decisionReasons = [{ category: "blocker", reason: reasonText, evidence_ids: [] }, ...decisionReasons].slice(0, 6);
    }
    if (!keyFindings.some((item) => item.toLowerCase().includes("hard blocker"))) {
      keyFindings = ["Open hard blockers still require resolution before a bid decision can move to Go", ...keyFindings].slice(0, 6);
    }
    const nextAction = "Resolve the current hard blockers and re-run the review before treating this opportunity as Go.";
    if (!nextActions.some((item) => item.toLowerCase().includes("hard blockers"))) {
      nextActions = [nextAction, ...nextActions].slice(0, 4);
    }
    decisionLine = normalizeAiTextValue("Hold because one or more hard blockers remain unresolved in the current evidence pack.", 220);
  } else if (finalDecisionBadge === "Go" && unresolvedMustItems.length > 0) {
    finalDecisionBadge = "Hold";
    if (decisionSource !== "hard_rule" && decisionSource !== "policy_rule") decisionSource = "llm";
    const firstMust = normalizeAiTextValue(unresolvedMustItems[0]?.text, 180) || "One or more MUST requirements";
    const reasonText = `Critical MUST requirements are not yet fully evidenced: ${firstMust}`;
    if (!decisionReasons.some((item: any) => String(item?.reason ?? "").toLowerCase() === reasonText.toLowerCase())) {
      decisionReasons = [{
        category: "uncertainty",
        reason: reasonText,
        evidence_ids: Array.isArray(unresolvedMustItems[0]?.evidence_ids) ? unresolvedMustItems[0].evidence_ids : [],
      }, ...decisionReasons].slice(0, 6);
    }
    if (!keyFindings.some((item) => item.toLowerCase().includes("must requirement"))) {
      keyFindings = ["One or more critical MUST requirements are not yet fully evidenced in the current run", ...keyFindings].slice(0, 6);
    }
    const nextAction = "Validate the unresolved MUST requirements with source evidence before upgrading this opportunity to Go.";
    if (!nextActions.some((item) => item.toLowerCase().includes("must requirements"))) {
      nextActions = [nextAction, ...nextActions].slice(0, 4);
    }
    decisionLine = normalizeAiTextValue("Hold because critical MUST requirements are not yet fully evidenced in the current run.", 220);
  } else if (finalDecisionBadge === "Go" && (deadlineSource === "not_found" || deadlineSource === "unparseable")) {
    finalDecisionBadge = "Hold";
    if (decisionSource !== "hard_rule" && decisionSource !== "policy_rule") decisionSource = "llm";
    const reasonText = "Submission deadline could not be reliably normalized from the current evidence pack";
    if (!decisionReasons.some((item: any) => String(item?.reason ?? "").toLowerCase() === reasonText.toLowerCase())) {
      decisionReasons = [{ category: "submission", reason: reasonText, evidence_ids: [] }, ...decisionReasons].slice(0, 6);
    }
    if (!keyFindings.some((item) => item.toLowerCase().includes("submission deadline could not"))) {
      keyFindings = ["Submission deadline could not be reliably normalized from the current evidence pack", ...keyFindings].slice(0, 6);
    }
    const nextAction = "Confirm the exact submission deadline and time zone before treating this tender as Go.";
    if (!nextActions.some((item) => item.toLowerCase().includes("exact submission deadline"))) {
      nextActions = [nextAction, ...nextActions].slice(0, 4);
    }
    decisionLine = normalizeAiTextValue("Hold because the submission deadline could not be reliably normalized from the current evidence pack.", 220);
  }

  return {
    ...args.aiOut,
    executive_summary: {
      ...executive,
      decisionBadge: finalDecisionBadge,
      finalDecisionBadge,
      decisionSource,
      hardStopReasons,
      hard_blockers: hardBlockers,
      decision_reasons: decisionReasons,
      decisionLine,
      keyFindings,
      nextActions,
    },
  };
}

function applyDecisionRules(args: {
  aiOut: AiOutput;
  evidenceCandidates: EvidenceCandidate[];
  extractedText?: string | null;
  nowIso?: string;
}): AiOutput {
  const nowIso = String(args.nowIso ?? new Date().toISOString());
  const executive = args.aiOut?.executive_summary ?? ({} as AiOutput["executive_summary"]);
  const llmDecisionBadge: DecisionBadge = executive?.decisionBadge === "Go" || executive?.decisionBadge === "Hold" || executive?.decisionBadge === "No-Go"
    ? executive.decisionBadge
    : "Hold";

  const deadline = resolveDeterministicSubmissionDeadline({
    rawInput: executive?.submissionDeadline,
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });
  const tenderStatus = deriveTenderStatus({ submissionDeadlineIso: deadline.iso, nowIso });
  const closureSignal = detectExplicitClosureSignal({
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });
  const hardStopReasons = Array.isArray(executive?.hardStopReasons)
    ? executive.hardStopReasons.map((item: any) => normalizeAiTextValue(item, 180)).filter(Boolean).slice(0, 4)
    : [];

  let finalDecisionBadge: DecisionBadge = llmDecisionBadge;
  let decisionSource: DecisionSource = normalizeDecisionSourceValue(executive?.decisionSource);
  let decisionLine = normalizeAiTextValue(executive?.decisionLine, 220);
  let keyFindings = normalizeAiTextList(executive?.keyFindings, 6, 220);
  let nextActions = normalizeAiTextList(executive?.nextActions, 4, 220);
  let hardBlockers = Array.isArray(executive?.hard_blockers) ? [...executive.hard_blockers] : [];
  let decisionReasons = Array.isArray(executive?.decision_reasons) ? [...executive.decision_reasons] : [];

  if (closureSignal) {
    finalDecisionBadge = "No-Go";
    decisionSource = "hard_rule";

    if (!hardStopReasons.some((item) => item.toLowerCase() === closureSignal.reason.toLowerCase())) {
      hardStopReasons.unshift(closureSignal.reason);
    }

    if (!hardBlockers.some((item: any) => String(item?.title ?? "").toLowerCase().includes("cancelled or closed"))) {
      hardBlockers = [{
        title: closureSignal.title,
        detail: closureSignal.detail,
        evidence_ids: closureSignal.evidence_ids,
      }, ...hardBlockers].slice(0, 5);
    }

    if (!decisionReasons.some((item: any) => String(item?.reason ?? "").toLowerCase() === closureSignal.reason.toLowerCase())) {
      decisionReasons = [{
        category: "submission",
        reason: closureSignal.reason,
        evidence_ids: closureSignal.evidence_ids,
      }, ...decisionReasons].slice(0, 6);
    }

    if (!keyFindings.some((item) => item.toLowerCase().includes("cancelled") || item.toLowerCase().includes("closed"))) {
      keyFindings = [closureSignal.title, ...keyFindings].slice(0, 6);
    }

    const nextAction = "Treat this tender as closed and do not allocate further bid effort unless the buyer formally reopens it.";
    if (!nextActions.some((item) => item.toLowerCase().includes("formally reopens"))) {
      nextActions = [nextAction, ...nextActions].slice(0, 4);
    }

    decisionLine = normalizeAiTextValue("No Go because the provided documents indicate that the tender is cancelled, withdrawn, closed, suspended, or otherwise ended.", 220);
  }

  if (tenderStatus === "expired") {
    finalDecisionBadge = "No-Go";
    decisionSource = "hard_rule";

    const reasonText = "Tender deadline already expired";
    if (!hardStopReasons.some((item) => item.toLowerCase() === reasonText.toLowerCase())) {
      hardStopReasons.unshift(reasonText);
    }

    const deadlineLabel = deadline.rawText && deadline.rawText !== DEADLINE_NOT_FOUND_TEXT
      ? deadline.rawText
      : deadline.iso
        ? deadline.iso
        : "the documented submission deadline";

    decisionLine = normalizeAiTextValue(`No Go because the submission deadline is already expired: ${deadlineLabel}.`, 220);

    const deadlineEvidenceIds = bestEffortEvidenceIdsFromText({
      text: `${deadline.rawText} submission deadline expired`,
      evidenceCandidates: args.evidenceCandidates,
      limit: 2,
    });

    if (!hardBlockers.some((item: any) => String(item?.title ?? "").toLowerCase().includes("deadline already expired"))) {
      hardBlockers = [{
        title: "Submission deadline already expired",
        detail: normalizeAiTextValue(`The tender submission deadline is in the past relative to processing time: ${deadlineLabel}.`, 260),
        evidence_ids: deadlineEvidenceIds,
      }, ...hardBlockers].slice(0, 5);
    }

    if (!decisionReasons.some((item: any) => String(item?.reason ?? "").toLowerCase().includes("deadline is already expired"))) {
      decisionReasons = [{
        category: "submission",
        reason: "The submission deadline is already expired, so the opportunity is no longer bid-ready.",
        evidence_ids: deadlineEvidenceIds,
      }, ...decisionReasons].slice(0, 6);
    }

    const deadlineFinding = `Submission deadline already expired: ${deadlineLabel}`;
    if (!keyFindings.some((item) => item.toLowerCase().includes("deadline already expired"))) {
      keyFindings = [deadlineFinding, ...keyFindings].slice(0, 6);
    }

    const nextAction = "Treat this tender as closed unless the buyer has formally extended or re-opened it.";
    if (!nextActions.some((item) => item.toLowerCase().includes("treat this tender as closed"))) {
      nextActions = [nextAction, ...nextActions].slice(0, 4);
    }
  } else if (decisionSource !== "policy_rule") {
    decisionSource = "llm";
  }

  return {
    ...args.aiOut,
    executive_summary: {
      ...executive,
      decisionBadge: finalDecisionBadge,
      llmDecisionBadge,
      finalDecisionBadge,
      decisionSource,
      hardStopReasons,
      submissionDeadline: deadline.rawText || DEADLINE_NOT_FOUND_TEXT,
      submissionDeadlineIso: deadline.iso,
      submissionTimezone: deadline.timezone,
      submissionDeadlineSource: deadline.source,
      tenderStatus,
      decisionLine,
      keyFindings,
      nextActions,
      hard_blockers: hardBlockers,
      decision_reasons: decisionReasons,
    },
  };
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
      decisionBadge: "Hold",
      decisionLine:
        "Hold until mandatory requirements and submission details are verified against the source tender.",
      decision_reasons: [
        {
          category: "uncertainty",
          reason: "This mock path does not verify whether all mandatory requirements are fully evidenced.",
          evidence_ids: [],
        },
        {
          category: "submission",
          reason: "Submission instructions appear present but should still be confirmed before bid commitment.",
          evidence_ids: [],
        },
      ],
      hard_blockers: [],
      evidence_coverage: {
        submission: "covered",
        eligibility: "partial",
        scope: "covered",
        commercial: "partial",
        evaluation: "not_found",
        contract_terms: "not_found",
        note: "Mock fixture only. Real coverage must be derived from extracted tender evidence.",
      },
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

  if (resp?.status === "incomplete") {
    const reason = resp?.incomplete_details?.reason ?? "unknown";
    const preview = typeof resp?.output_text === "string" ? resp.output_text.slice(0, 400) : "";
    throw new Error(`OpenAI response incomplete: ${reason}${preview ? ` | partial output: ${preview}` : ""}`);
  }

  const candidates: string[] = [];

  if (typeof resp?.output_text === "string") {
    candidates.push(resp.output_text.trim());
  }

  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of out) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string") {
        candidates.push(c.text.trim());
      }
    }
  }

  for (const text of candidates) {
    if (!text || !text.startsWith("{")) continue;
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(
        `OpenAI returned malformed JSON: ${
          (e as Error)?.message ?? String(e)
        } | preview: ${text.slice(0, 500)}`,
      );
    }
  }

  throw new Error("OpenAI response did not include parsable JSON output");
}

type WorkspacePlaybookInput = { playbook: any; version: number | null } | null | undefined;

function normalizeWorkspacePlaybook(workspacePlaybook: WorkspacePlaybookInput): { playbook: Record<string, any> | null; versionLabel: string } {
  const playbook = workspacePlaybook?.playbook && typeof workspacePlaybook.playbook === "object"
    ? workspacePlaybook.playbook as Record<string, any>
    : null;

  const versionLabel = workspacePlaybook?.version == null ? "none" : String(workspacePlaybook.version);
  return { playbook, versionLabel };
}

function normalizePlaybookList(input: unknown, limit = 8): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizePlaybookScalar(input: unknown, maxLen = 180): string {
  return String(input ?? "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function compactJson(value: unknown, maxLen = 700): string {
  try {
    const raw = JSON.stringify(value);
    return String(raw ?? "").slice(0, maxLen);
  } catch {
    return '{"error":"playbook_not_serializable"}';
  }
}

function buildAnalysisFingerprint(args: {
  model: string;
  targetLanguage: string;
  sourceLanguage: string;
  evidenceCandidates: EvidenceCandidate[];
  playbookVersion: number | null;
}) {
  const bucketCounts = Object.fromEntries(
    EVIDENCE_BUCKET_ORDER.map((bucket) => [bucket, args.evidenceCandidates.filter((item) => item.bucket === bucket).length]),
  );

  return {
    prompt_version: PROCESS_JOB_PROMPT_VERSION,
    schema_version: PROCESS_JOB_SCHEMA_VERSION,
    evidence_selection_version: EVIDENCE_SELECTION_VERSION,
    model: args.model,
    target_language: args.targetLanguage,
    source_language: args.sourceLanguage,
    playbook_version: args.playbookVersion,
    evidence_count: args.evidenceCandidates.length,
    evidence_ids: args.evidenceCandidates.slice(0, 80).map((item) => item.id),
    evidence_bucket_counts: bucketCounts,
  };
}

function buildPlaybookPromptSection(workspacePlaybook: WorkspacePlaybookInput): string {
  const normalized = normalizeWorkspacePlaybook(workspacePlaybook);
  if (!normalized.playbook) {
    return "Workspace Bid Playbook (policy constraints, NOT evidence)\nVersion: none\nStatus: not configured for this workspace.";
  }

  const pb = normalized.playbook;
  const knownKeys = new Set([
    "industry_tags",
    "offerings_summary",
    "delivery_geographies",
    "languages_supported",
    "delivery_modes",
    "capacity_band",
    "typical_lead_time_weeks",
    "certifications",
    "non_negotiables",
  ]);

  const lines: string[] = [
    "Workspace Bid Playbook (policy constraints, NOT evidence)",
    `Version: ${normalized.versionLabel}`,
    "Apply this as internal company-fit policy. Never cite it as tender evidence.",
  ];

  const offeringsSummary = normalizePlaybookScalar(pb.offerings_summary, 240);
  if (offeringsSummary) lines.push(`Offerings summary: ${offeringsSummary}`);

  const industryTags = normalizePlaybookList(pb.industry_tags);
  if (industryTags.length) lines.push(`Industry fit: ${industryTags.join('; ')}`);

  const geographies = normalizePlaybookList(pb.delivery_geographies);
  if (geographies.length) lines.push(`Delivery geographies: ${geographies.join('; ')}`);

  const languages = normalizePlaybookList(pb.languages_supported);
  if (languages.length) lines.push(`Languages supported: ${languages.join('; ')}`);

  const deliveryModes = normalizePlaybookList(pb.delivery_modes);
  if (deliveryModes.length) lines.push(`Delivery modes: ${deliveryModes.join('; ')}`);

  const capacityBand = normalizePlaybookScalar(pb.capacity_band, 40);
  if (capacityBand) lines.push(`Capacity band: ${capacityBand}`);

  const leadTime = pb.typical_lead_time_weeks;
  if (typeof leadTime === "number" && Number.isFinite(leadTime) && leadTime > 0) {
    lines.push(`Typical lead time weeks: ${Math.round(leadTime)}`);
  }

  const certifications = normalizePlaybookList(pb.certifications);
  if (certifications.length) lines.push(`Preferred certifications: ${certifications.join('; ')}`);

  const nonNegotiables = normalizePlaybookList(pb.non_negotiables, 12);
  if (nonNegotiables.length) {
    lines.push("Non-negotiables:");
    for (const item of nonNegotiables) lines.push(`- ${item}`);
  }

  const extraEntries = Object.entries(pb).filter(([key, value]) => {
    if (knownKeys.has(key)) return false;
    if (value == null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (!Array.isArray(value) && typeof value === "string" && !value.trim()) return false;
    return true;
  });

  if (extraEntries.length) {
    lines.push(`Additional raw playbook fields: ${compactJson(Object.fromEntries(extraEntries))}`);
  }

  return lines.join("\n");
}

function buildEvidenceList(evidenceCandidates: EvidenceCandidate[]): string {
  const labelByBucket: Record<EvidenceBucket, string> = {
    submission: "Submission and deadlines",
    eligibility: "Eligibility and mandatory requirements",
    commercial: "Commercial terms",
    evaluation: "Evaluation criteria",
    contract_terms: "Contract terms",
    general: "General supporting evidence",
  };

  const groups = new Map<EvidenceBucket, EvidenceCandidate[]>();
  for (const bucket of EVIDENCE_BUCKET_ORDER) groups.set(bucket, []);
  for (const item of evidenceCandidates ?? []) {
    const bucket = item.bucket ?? "general";
    groups.get(bucket)?.push(item);
  }

  const sections: string[] = [];
  for (const bucket of EVIDENCE_BUCKET_ORDER) {
    const items = groups.get(bucket) ?? [];
    if (!items.length) continue;

    sections.push(`## ${labelByBucket[bucket]}`);
    sections.push(
      items
        .map((item) => {
          const pageLabel = item.page == null ? "page unknown" : `page ${item.page}`;
          const anchorLabel = item.anchor ? ` | anchor: ${String(item.anchor).replace(/\s+/g, " ").trim()}` : "";
          const excerpt = String(item.excerpt ?? "").replace(/\s+/g, " ").trim();
          return `[${item.id}] ${pageLabel} | kind: ${item.kind}${anchorLabel}\n${excerpt}`;
        })
        .join("\n\n"),
    );
  }

  return sections.join("\n\n") || "(No evidence snippets were extracted for this run.)";
}

function trimFactValue(raw: unknown, maxLen = 220): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, maxLen).trim();
}

type FactScanLine = { text: string; evidence_ids: string[]; source: "evidence" | "text_fallback" };

function collectFactScanLines(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): FactScanLine[] {
  const out: FactScanLine[] = [];
  const seen = new Set<string>();

  const push = (value: unknown, evidenceIds: string[] = [], source: "evidence" | "text_fallback" = "text_fallback") => {
    const text = trimFactValue(value, 320);
    if (!text) return;
    const key = `${source}::${text.toLowerCase()}::${evidenceIds.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, evidence_ids: evidenceIds.filter(Boolean).slice(0, 3), source });
  };

  for (const candidate of args.evidenceCandidates ?? []) {
    const evidenceIds = String(candidate?.id ?? "").trim() ? [String(candidate.id).trim()] : [];
    push(candidate?.excerpt, evidenceIds, "evidence");
    push(candidate?.anchor, evidenceIds, "evidence");
  }

  const extractedText = String(args.extractedText ?? "");
  if (extractedText) {
    const lines = extractedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      push(line, [], "text_fallback");
      const joined = [lines[i - 1], line, lines[i + 1]].filter(Boolean).join(" ");
      if (joined && joined !== line) push(joined, [], "text_fallback");
    }
  }

  return out;
}

function extractFocusedSnippet(text: string, pattern: RegExp, radius = 120): string {
  const source = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!source) return "";
  const match = source.match(pattern);
  if (!match || typeof match.index !== "number") {
    return source.slice(0, Math.min(source.length, radius * 2)).trim();
  }
  const start = Math.max(0, match.index - radius);
  const end = Math.min(source.length, match.index + String(match[0] ?? "").length + radius);
  let out = source.slice(start, end).trim();
  if (start > 0) out = `… ${out}`;
  if (end < source.length) out = `${out} …`;
  return out;
}

function pickBestDeterministicFact(lines: FactScanLine[], pattern: RegExp, labelBias: string[] = []): DeterministicTenderFact | null {
  const scored = lines
    .map((line, index) => {
      const regex = new RegExp(pattern.source, pattern.flags);
      if (!regex.test(line.text)) return null;
      let score = line.source === "evidence" ? 5 : 2;
      if (line.evidence_ids.length) score += 2;
      const lower = line.text.toLowerCase();
      for (const token of labelBias) {
        if (token && lower.includes(token.toLowerCase())) score += 1;
      }
      if (line.text.length <= 220) score += 1;
      return {
        line,
        score,
        index,
        value: trimFactValue(extractFocusedSnippet(line.text, regex), 220),
      };
    })
    .filter(Boolean) as Array<{ line: FactScanLine; score: number; index: number; value: string }>;

  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  const best = scored[0];
  if (!best || !best.value) return null;
  return {
    value: best.value,
    evidence_ids: best.line.evidence_ids.slice(0, 3),
    source: best.line.source,
    confidence: best.line.source === "evidence" ? "high" : "medium",
  };
}

function extractNamedTenderReferences(lines: FactScanLine[], kind: "attachment" | "schedule") {
  const out: Array<{ value: string; evidence_ids: string[] }> = [];
  const seen = new Set<string>();
  const regex = kind === "attachment"
    ? /\b(?:Attachment|Attachments|Annex|Annexe|Appendix|Appendice|Allegato|Allegati|Annesso|Anlage|Anlagen|Anexo|Anexos|Ap[eé]ndice|Pi[eè]ce)\s*(?:No\.?|n\.?|nr\.?|nº|num\.?)?\s*[A-Za-z0-9.-]+(?:\s*[-–:]\s*[^;,.\n]{1,80})?/ig
    : /\b(?:Schedule|Schedules|Framework Schedule|Pricing Schedule|Technical Schedule|Service Schedule|Annexe technique|Anlage|Anlagen|Cronoprogramma|Calendrier|Calendario)\s*[A-Za-z0-9.-]*(?:\s*[-–:]\s*[^;,.\n]{1,80})?/ig;

  for (const line of lines) {
    const matches = line.text.match(regex) ?? [];
    for (const match of matches) {
      const value = trimFactValue(match, 140);
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value, evidence_ids: line.evidence_ids.slice(0, 2) });
      if (out.length >= 8) return out;
    }
  }

  return out;
}

function extractDeterministicTenderFacts(args: { evidenceCandidates: EvidenceCandidate[]; extractedText?: string | null }): PreExtractedTenderFacts {
  const lines = collectFactScanLines(args);
  const deadline = resolveDeterministicSubmissionDeadline({
    rawInput: null,
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });
  const clarificationDeadline = resolveDeterministicClarificationDeadline({
    evidenceCandidates: args.evidenceCandidates,
    extractedText: args.extractedText,
  });

  const submissionChannel = pickBestDeterministicFact(
    lines,
    /\b(e-?sourcing|procurement portal|portal(?:e)? telematic[oa]?|piattaforma telematica|tramite il portale|through the portal|via the portal|suite|sistema telematico|pec|email|upload|caricare|presentare .* portale|plateforme|portail|portail d'achat|via il portale|durch das portal|vergabeportal|e-?vergabe|über das portal|uber das portal|plataforma|portal de compras|a trav[eé]s del portal|mediante el portal)\b/i,
    ["submit", "submission", "presentazione", "offerta", "portal", "portale", "suite", "soumission", "offre", "angebot", "einreich", "presentación"],
  );

  const procurementProcedure = pickBestDeterministicFact(
    lines,
    /\b(open procedure|restricted procedure|competitive procedure|negotiated procedure|framework agreement|dynamic purchasing system|invitation to tender|procedura aperta|procedura ristretta|procedura negoziata|accordo quadro|sistema dinamico di acquisizione|gara europea|disciplinare di gara|proc[eé]dure ouverte|proc[eé]dure restreinte|proc[eé]dure n[eé]goci[eé]e|accord-cadre|syst[eè]me dynamique d'acquisition|offenes verfahren|nichtoffenes verfahren|verhandlungsverfahren|rahmenvereinbarung|dynamisches beschaffungssystem|procedimiento abierto|procedimiento restringido|procedimiento negociado|acuerdo marco|sistema din[aá]mico de adquisici[oó]n)\b/i,
    ["procedure", "procedura", "framework", "tender", "gara", "procédure", "verfahren", "procedimiento"],
  );

  const validityPeriod = pickBestDeterministicFact(
    lines,
    /\b(validity period|remain valid|valid for \d+ days|\d+ days following|\d+ giorni|validit[aà] dell'offerta|vincolat\w*|offerta .* valid|remain capable of acceptance|dur[eé]e de validit[eé]|offre .* valable|g[üu]ltig(?:keit)?|bindefrist|plazo de validez|validez de la oferta|oferta .* v[aá]lida)\b/i,
    ["valid", "giorni", "days", "offerta", "offer", "validité", "gültig", "bindefrist", "validez"],
  );

  const contractTerm = pickBestDeterministicFact(
    lines,
    /\b(contract term|contract duration|duration of the contract|durata del contratto|durata dell'appalto|durata .* mesi|durata .* anni|term of this framework|months? from|years? from|renewal|extension|prorog\w*|dur[eé]e du contrat|dur[eé]e du march[eé]|dur[eé]e .* mois|dur[eé]e .* ans|vertragslaufzeit|vertragsdauer|laufzeit .* monate|laufzeit .* jahre|duraci[oó]n del contrato|duraci[oó]n .* meses|duraci[oó]n .* años|pr[oó]rroga)\b/i,
    ["contract", "durata", "months", "years", "renewal", "extension", "contrat", "vertrag", "contrato"],
  );

  const lotStructure = pickBestDeterministicFact(
    lines,
    /\b(lot(?:s)?|single lot|multi-?lot|lotti?|lotto unico|suddivis\w* in lotti|allotissement|lots?|los(?:e)?|einzellose?|mehrere lose|dividido en lotes|lote[s]?)\b/i,
    ["lot", "lotti", "lotto", "lots", "lose", "lotes"],
  );

  return {
    submissionDeadline: {
      text: deadline.rawText || DEADLINE_NOT_FOUND_TEXT,
      iso: deadline.iso,
      timezone: deadline.timezone,
      source: deadline.source === "evidence_fallback"
        ? "parsed_from_evidence"
        : deadline.source === "not_found"
          ? "not_found"
          : deadline.source === "unparseable"
            ? "unparseable"
            : "parsed_from_evidence",
    },
    clarificationDeadline,
    submissionChannel,
    procurementProcedure,
    validityPeriod,
    contractTerm,
    lotStructure,
    attachmentMentions: extractNamedTenderReferences(lines, "attachment"),
    scheduleMentions: extractNamedTenderReferences(lines, "schedule"),
  };
}

function buildPreExtractedFactsSection(facts: PreExtractedTenderFacts): string {
  const lines: string[] = [];
  lines.push("Deterministic pre-extracted tender facts (non-exhaustive; use these as prioritization hints, but still cite only evidence_ids from the evidence snippets section):");

  const deadlineBits = [facts.submissionDeadline.text || DEADLINE_NOT_FOUND_TEXT];
  if (facts.submissionDeadline.iso) deadlineBits.push(`ISO ${facts.submissionDeadline.iso}`);
  if (facts.submissionDeadline.timezone) deadlineBits.push(`timezone ${facts.submissionDeadline.timezone}`);
  deadlineBits.push(`source ${facts.submissionDeadline.source}`);
  lines.push(`- Submission deadline: ${deadlineBits.join(" | ")}`);

  const clarificationBits = [facts.clarificationDeadline.text || DEADLINE_NOT_FOUND_TEXT];
  if (facts.clarificationDeadline.iso) clarificationBits.push(`ISO ${facts.clarificationDeadline.iso}`);
  if (facts.clarificationDeadline.timezone) clarificationBits.push(`timezone ${facts.clarificationDeadline.timezone}`);
  clarificationBits.push(`source ${facts.clarificationDeadline.source}`);
  lines.push(`- Clarification deadline: ${clarificationBits.join(" | ")}`);

  const pushFact = (label: string, fact: DeterministicTenderFact | null) => {
    if (!fact) {
      lines.push(`- ${label}: not confidently pre-extracted`);
      return;
    }
    const ids = fact.evidence_ids.length ? ` | evidence_ids: ${fact.evidence_ids.join(", ")}` : " | evidence_ids: []";
    lines.push(`- ${label}: ${fact.value} | source: ${fact.source} | confidence: ${fact.confidence}${ids}`);
  };

  pushFact("Submission channel", facts.submissionChannel);
  pushFact("Procurement procedure", facts.procurementProcedure);
  pushFact("Tender validity period", facts.validityPeriod);
  pushFact("Contract term", facts.contractTerm);
  pushFact("Lot structure", facts.lotStructure);

  const attachmentSummary = facts.attachmentMentions.length
    ? facts.attachmentMentions.map((item) => `${item.value}${item.evidence_ids.length ? ` [${item.evidence_ids.join(", ")}]` : ""}`).join("; ")
    : "none confidently pre-extracted";
  const scheduleSummary = facts.scheduleMentions.length
    ? facts.scheduleMentions.map((item) => `${item.value}${item.evidence_ids.length ? ` [${item.evidence_ids.join(", ")}]` : ""}`).join("; ")
    : "none confidently pre-extracted";

  lines.push(`- Named attachments: ${attachmentSummary}`);
  lines.push(`- Named schedules: ${scheduleSummary}`);
  return lines.join("\n");
}

function buildTenderReviewPrompt(args: {
  sourceLanguageName: string;
  playbookSection: string;
  preExtractedFactsSection: string;
  evidenceList: string;
  currentUtcIso: string;
}): string {
  return `Task
Review the tender evidence pack and produce a decision-first bid kit with stable, evidence-led judgment.

${args.playbookSection}

${args.preExtractedFactsSection}

Strict rules
1. Grounding. Use only the evidence snippets provided below as the citable basis for this run. They are curated evidence candidates and may be incomplete. Do not rely on hidden assumptions or uncited source text.
2. Decision policy (STRICT).
   - Choose decisionBadge exactly as one of: Go, Hold, No-Go.
   - Choose No-Go when the evidence shows an explicit blocker, disqualifier, impossible requirement, hard playbook conflict, non-recoverable eligibility gap, or a clearly expired submission deadline.
   - Choose Hold when decision-critical information is missing, clarification is required, evidence coverage is too thin for a reliable bid decision, or material uncertainty remains.
   - Choose Go only when no blocker is evidenced, no hard playbook conflict is present, and remaining risks appear manageable.
   - Provide decisionLine as one clear sentence.
3. Submission deadline and current date. The current UTC time for this run is ${args.currentUtcIso}. If an explicit deadline date or time is present in the evidence, copy it verbatim into submissionDeadline. If that copied deadline is clearly in the past relative to the current UTC time, you MUST set decisionBadge to No-Go, make the first hard_blocker about the expired deadline, and make the first keyFinding say the submission deadline has already expired. Otherwise set submissionDeadline to: Not found in extracted text.
4. Deterministic fact pack. A pre-extracted fact pack is provided above. Treat it as a prioritization hint and cross-check aid. It is non-exhaustive. Use it to surface submission channel, procedure, validity period, lot structure, contract term, and named attachments or schedules more reliably, but never cite the fact pack itself as evidence.
5. Checklist. MUST means mandatory or disqualifying if missed. SHOULD means preferred, scored, or commercially important. INFO is context. Keep items atomic. Prefer one obligation per item whenever possible.
6. Evidence (STRICT). You MUST cite evidence_ids:
   - For every MUST checklist item: include at least one evidence id that directly supports it.
   - For every risk: include at least one evidence id that directly supports it.
   - For every hard_blocker and every decision_reason where evidence exists: include supporting evidence_ids.
   - Do not invent clause numbers, section numbers, or cross-references. Cite only evidence ids.
   - If you cannot support a MUST, risk, blocker, or reason with evidence, either omit it or keep the wording explicitly cautious and return evidence_ids as [].
7. Executive summary (STRICT).
   - keyFindings must reflect evidence-backed facts or clearly framed absences from evidence.
   - nextActions should be operational and tied to what is missing, risky, or urgent in the evidence.
   - topRisks must stay aligned with the risks array. Do not introduce unsupported new risks here.
   - decision_reasons must explain why the decision was chosen, not restate the badge.
   - hard_blockers must contain only concrete blockers, not generic concerns.
   - evidence_coverage must assess whether the current evidence pack visibly covers submission, eligibility, scope, commercial, evaluation, and contract_terms.
8. Playbook (STRICT). The playbook is policy, not evidence:
   - Never cite the playbook as evidence.
   - If the playbook influences decision, prioritization, or required actions, add entries to policy_triggers.
   - When you claim a conflict with the playbook, rely on evidence ids that support the tender-side requirement driving the conflict.
9. Policy triggers output (REQUIRED).
   - policy_triggers must be an array. If no playbook constraints apply, return [].
   - Each trigger must be short, auditable, and map to exactly one playbook key.
10. Missing info. Put unresolved ambiguities, unanswered buyer-side questions, or evidence gaps into buyer_questions.
11. Writing style. Use plain business language. Avoid em dashes, en dashes, hype, filler, and legal-sounding padding. Keep sentences direct and natural. Prefer concrete tender obligations over abstract summaries.
12. Language handling. The source tender text is in ${args.sourceLanguageName}. Analyse obligations, exclusions, submission instructions, qualifications, deadlines, commercial terms, evaluation criteria, and contract clauses in that source language. Keep evidence verbatim in the source language and cite only evidence_ids.
13. Proposal draft. Keep proposal_draft skeletal and lightweight: maximum 8 short sections, under 900 words, outline quality only. Do not spend output budget on polished prose.
14. Priority. Prefer precision over coverage. If the evidence pack does not prove something, do not state it as fact. If a reliable decision cannot be made from the curated evidence, prefer Hold over false confidence. Keep blockers and MUST items close to the tender wording, not generalized reformulations.
15. Hard-stop ordering. When an expired deadline, explicit closure, cancellation, or another hard stop is evidenced, surface that first in decisionLine, keyFindings, hard_blockers, and nextActions. Do not bury hard stops behind fixable checklist items.
16. Bidder vs tender separation. Keep tender-side facts, missing attachments, and bidder-side unknowns clearly separate. Missing bidder information is not proof of tender non-compliance.
17. Explicit closure and cancellation. If the evidence states the tender, procurement, competition, or opportunity has been cancelled, withdrawn, closed, suspended, discontinued, or otherwise ended, recommend No-Go and surface that as a hard blocker first.
18. Decision consistency. Do not return Go if hard_blockers remain unresolved, if critical MUST requirements are not fully evidenced in the current run, if the submission deadline is missing or unparseable, or if a workspace playbook trigger blocks pursuit. Use Hold for fixable evidence gaps and No-Go for hard stops.

Evidence snippets (the ONLY citable basis for this run; cite their ids in evidence_ids):
${args.evidenceList}`;
}

function validateRunLlmArgs(args: {
  model: string;
  targetLanguage: string;
  extractedText: string;
  evidenceCandidates: EvidenceCandidate[];
}) {
  if (!String(args.model ?? "").trim()) throw new Error("runLlm missing model");
  if (!String(args.targetLanguage ?? "").trim()) throw new Error("runLlm missing targetLanguage");
  if (!String(args.extractedText ?? "").trim()) throw new Error("runLlm missing extractedText");
  if (!Array.isArray(args.evidenceCandidates)) throw new Error("runLlm evidenceCandidates must be an array");
}

function buildTenderReviewJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      executive_summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          decisionBadge: { type: "string", enum: ["Go", "Hold", "No-Go"] },
          decisionLine: { type: "string", maxLength: 220 },
          decision_reasons: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                category: { type: "string", enum: ["blocker", "eligibility", "submission", "commercial", "technical", "playbook", "uncertainty", "fit"] },
                reason: { type: "string", maxLength: 260 },
                evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["category", "reason", "evidence_ids"],
            },
          },
          hard_blockers: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string", maxLength: 140 },
                detail: { type: "string", maxLength: 260 },
                evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["title", "detail", "evidence_ids"],
            },
          },
          evidence_coverage: {
            type: "object",
            additionalProperties: false,
            properties: {
              submission: { type: "string", enum: ["covered", "partial", "not_found"] },
              eligibility: { type: "string", enum: ["covered", "partial", "not_found"] },
              scope: { type: "string", enum: ["covered", "partial", "not_found"] },
              commercial: { type: "string", enum: ["covered", "partial", "not_found"] },
              evaluation: { type: "string", enum: ["covered", "partial", "not_found"] },
              contract_terms: { type: "string", enum: ["covered", "partial", "not_found"] },
              note: { type: "string", maxLength: 220 },
            },
            required: ["submission", "eligibility", "scope", "commercial", "evaluation", "contract_terms", "note"],
          },
          keyFindings: { type: "array", items: { type: "string" }, maxItems: 6 },
          nextActions: { type: "array", items: { type: "string" }, maxItems: 4 },
          topRisks: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string", maxLength: 140 },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                detail: { type: "string", maxLength: 260 },
              },
              required: ["title", "severity", "detail"],
            },
          },
          submissionDeadline: { type: "string", maxLength: 120 },
        },
        required: ["decisionBadge", "decisionLine", "decision_reasons", "hard_blockers", "evidence_coverage", "keyFindings", "nextActions", "topRisks", "submissionDeadline"],
      },
      checklist: {
        type: "array",
        maxItems: 18,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["MUST", "SHOULD", "INFO"] },
            text: { type: "string", maxLength: 260 },
            evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["type", "text", "evidence_ids"],
        },
      },
      risks: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 140 },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            detail: { type: "string", maxLength: 260 },
            evidence_ids: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["title", "severity", "detail", "evidence_ids"],
        },
      },
      buyer_questions: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 8 },
      proposal_draft: { type: "string", maxLength: 3200 },
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
            note: { type: "string", maxLength: 220 },
            rule: { type: ["string", "null"] },
          },
          required: ["key", "impact", "note", "rule"],
        },
      },
    },
    required: ["executive_summary", "checklist", "risks", "buyer_questions", "proposal_draft", "policy_triggers"],
  };
}

function buildTenderReviewRequestParts(args: {
  targetLanguage: string;
  sourceLanguage: LangCode;
  extractedText: string;
  evidenceCandidates: EvidenceCandidate[];
  workspacePlaybook?: { playbook: any; version: number | null } | null;
  preExtractedFacts?: PreExtractedTenderFacts | null;
}) {
  const sourceLanguageName = langName(args.sourceLanguage);
  const playbookSection = buildPlaybookPromptSection(args.workspacePlaybook);
  const evidenceList = buildEvidenceList(args.evidenceCandidates);
  const preExtractedFacts = args.preExtractedFacts ?? extractDeterministicTenderFacts({ evidenceCandidates: args.evidenceCandidates, extractedText: args.extractedText });
  const preExtractedFactsSection = buildPreExtractedFactsSection(preExtractedFacts);
  const currentUtcIso = new Date().toISOString();

  const instructions =
    "You are TenderPilot. Drafting support only. Not legal advice. Not procurement advice. " +
    "Use executive, compliance-grade language with a cautious tone. No AI meta commentary. Avoid em dashes and avoid padded AI-style phrasing. " +
    `The tender source language is ${sourceLanguageName}. ` +
    `Write all narrative content in ${args.targetLanguage}. ` +
    "Keep decisionBadge exactly as Go, Hold, or No-Go. " +
    "Do not translate, rewrite, paraphrase, or normalize source evidence; you do not output excerpts, only evidence_ids. " +
    "Interpret procurement wording in the source language accurately, including legal or disqualifying phrasing. " +
    "If evidence is incomplete, say so clearly and push uncertainty into buyer_questions. " +
    "If the evidence shows an expired submission deadline or another hard stop, surface that first and do not soften it with a Hold recommendation.";

  const userPrompt = buildTenderReviewPrompt({
    sourceLanguageName,
    playbookSection,
    preExtractedFactsSection,
    evidenceList,
    currentUtcIso,
  });

  return { instructions, userPrompt, preExtractedFacts };
}

function cleanStructuredJsonText(raw: string): string {
  let text = String(raw ?? "").trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  return text;
}

function buildGeminiJsonOutputInstructions(): string {
  return [
    "Return exactly one valid JSON object and nothing else.",
    "Do not use markdown fences.",
    "Use double quotes for all keys and string values.",
    "Do not leave strings unterminated.",
    "Do not use trailing commas.",
    'The top-level JSON object must contain exactly these keys: "executive_summary", "checklist", "risks", "buyer_questions", "proposal_draft", and "policy_triggers".',
    'If a field is unknown, still include it with a conservative empty value such as "", [], or null as appropriate.',
  ].join(" ");
}

function getGeminiTextFromResponse(responseJson: any): string {
  const candidates = Array.isArray(responseJson?.candidates) ? responseJson.candidates : [];
  const firstCandidate = candidates[0] ?? null;
  const parts = Array.isArray(firstCandidate?.content?.parts) ? firstCandidate.content.parts : [];
  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function parseGeminiJsonFromResponse(responseJson: any): AiOutput {
  const candidates = Array.isArray(responseJson?.candidates) ? responseJson.candidates : [];
  const firstCandidate = candidates[0] ?? null;
  const finishReason = String(firstCandidate?.finishReason ?? "").trim();
  const text = getGeminiTextFromResponse(responseJson);

  if (!text) {
    throw new Error(`Gemini response did not include parsable JSON output${finishReason ? ` (finish_reason=${finishReason})` : ""}`);
  }

  try {
    return JSON.parse(cleanStructuredJsonText(text)) as AiOutput;
  } catch (error) {
    const cleaned = cleanStructuredJsonText(text);
    const preview = cleaned.slice(0, 400).replace(/\s+/g, " ");
    throw new Error(
      `Gemini returned malformed JSON: ${String((error as Error)?.message ?? error)}${finishReason ? ` (finish_reason=${finishReason})` : ""}; preview=${preview}`
    );
  }
}

async function runOpenAi(args: {
  apiKey: string;
  model: string;
  targetLanguage: string;
  sourceLanguage: LangCode;
  extractedText: string;
  evidenceCandidates: EvidenceCandidate[];
  maxOutputTokens: number;
  timeoutMs?: number;
  workspacePlaybook?: { playbook: any; version: number | null } | null;
  preExtractedFacts?: PreExtractedTenderFacts | null;
}): Promise<AiOutput> {
  const { apiKey, model, targetLanguage, sourceLanguage, extractedText, evidenceCandidates, maxOutputTokens, timeoutMs, workspacePlaybook, preExtractedFacts } = args;

  validateRunLlmArgs({ model, targetLanguage, extractedText, evidenceCandidates });

  const schema = buildTenderReviewJsonSchema();
  const { instructions, userPrompt } = buildTenderReviewRequestParts({
    targetLanguage,
    sourceLanguage,
    extractedText,
    evidenceCandidates,
    workspacePlaybook,
    preExtractedFacts,
  });

  const buildBody = (tokenBudget: number) => {
    const body: Record<string, unknown> = {
      model,
      instructions,
      input: [{ role: "user", content: userPrompt }],
      max_output_tokens: tokenBudget,
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "TenderPilot_review",
          schema,
        },
      },
    };

    if (modelSupportsTemperature(model)) {
      body.temperature = OPENAI_TEMPERATURE;
    }

    return body;
  };

  const reqTimeoutMs = Math.max(3_000, Math.min(timeoutMs ?? 60_000, 90_000));

  const postResponse = async (tokenBudget: number, repairMode = false, invalidJsonText?: string): Promise<any> => {
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
        body: JSON.stringify(buildBody(tokenBudget, repairMode, invalidJsonText)),
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

    return await res.json();
  };

  const initialJson = await postResponse(maxOutputTokens);
  try {
    return parseOpenAiJsonFromResponse(initialJson) as AiOutput;
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    const shouldRetry =
      msg.includes("OpenAI response incomplete: max_output_tokens") ||
      (initialJson?.status === "incomplete" && initialJson?.incomplete_details?.reason === "max_output_tokens");

    if (!shouldRetry) throw e;

    const retryBudget = Math.min(Math.max(maxOutputTokens + 1200, Math.round(maxOutputTokens * 1.5)), 5200);
    const retryJson = await postResponse(retryBudget);
    return parseOpenAiJsonFromResponse(retryJson) as AiOutput;
  }
}

async function runGemini(args: {
  apiKey: string;
  model: string;
  targetLanguage: string;
  sourceLanguage: LangCode;
  extractedText: string;
  evidenceCandidates: EvidenceCandidate[];
  maxOutputTokens: number;
  timeoutMs?: number;
  workspacePlaybook?: { playbook: any; version: number | null } | null;
  preExtractedFacts?: PreExtractedTenderFacts | null;
}): Promise<AiOutput> {
  const { apiKey, model, targetLanguage, sourceLanguage, extractedText, evidenceCandidates, maxOutputTokens, timeoutMs, workspacePlaybook, preExtractedFacts } = args;

  validateRunLlmArgs({ model, targetLanguage, extractedText, evidenceCandidates });

  const { instructions, userPrompt } = buildTenderReviewRequestParts({
    targetLanguage,
    sourceLanguage,
    extractedText,
    evidenceCandidates,
    workspacePlaybook,
    preExtractedFacts,
  });
  const geminiJsonInstructions = buildGeminiJsonOutputInstructions();
  const geminiThinkingBudget = parseNumberEnv("TP_GEMINI_THINKING_BUDGET", 0);
  const geminiThinkingConfig = model.startsWith("gemini-2.5")
    ? { thinkingBudget: geminiThinkingBudget }
    : undefined;

  const buildBody = (tokenBudget: number, repairMode = false, invalidJsonText?: string) => ({
    systemInstruction: {
      parts: [{
        text: repairMode
          ? [
              "Repair invalid TenderPilot JSON.",
              "Return exactly one valid JSON object and nothing else.",
              "Do not use markdown fences.",
              'The top-level JSON object must contain exactly these keys: "executive_summary", "checklist", "risks", "buyer_questions", "proposal_draft", and "policy_triggers".',
            ].join(" ")
          : `${instructions} ${geminiJsonInstructions}`,
      }],
    },
    contents: [
      {
        role: "user",
        parts: [{
          text: repairMode
            ? invalidJsonText
              ? `Repair this invalid JSON and return one valid JSON object only. Preserve the same meaning as much as possible. Do not use markdown fences. Do not add commentary.

INVALID JSON TO REPAIR:
${invalidJsonText}`
              : `Return the answer again as one valid JSON object only. Do not use markdown fences. Do not add any commentary before or after the JSON.`
            : userPrompt,
        }],
      },
    ],
    generationConfig: {
      candidateCount: 1,
      temperature: GEMINI_TEMPERATURE,
      maxOutputTokens: tokenBudget,
      responseMimeType: "application/json",
      ...(geminiThinkingConfig ? { thinkingConfig: geminiThinkingConfig } : {}),
    },
  });

  const reqTimeoutMs = Math.max(3_000, Math.min(timeoutMs ?? 60_000, 90_000));

  const postResponse = async (tokenBudget: number, repairMode = false, invalidJsonText?: string): Promise<any> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), reqTimeoutMs);

    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(buildBody(tokenBudget, repairMode, invalidJsonText)),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (String(e).toLowerCase().includes("abort")) {
        throw new Error(`Gemini request timed out after ${reqTimeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini error ${res.status}: ${text.slice(0, 500)}`);
    }

    return await res.json();
  };

  const geminiRetryMaxOutputTokens = parseNumberEnv(
    "TP_GEMINI_MAX_OUTPUT_TOKENS",
    Math.max(maxOutputTokens, 8192)
  );

  const initialJson = await postResponse(maxOutputTokens);
  try {
    return parseGeminiJsonFromResponse(initialJson);
  } catch (e) {
    const finishReason = String(initialJson?.candidates?.[0]?.finishReason ?? "").toUpperCase();
    const retryBudget = Math.min(
      Math.max(maxOutputTokens + 1600, Math.round(maxOutputTokens * 1.75)),
      geminiRetryMaxOutputTokens
    );

    if (finishReason === "MAX_TOKENS" && retryBudget > maxOutputTokens) {
      const retryJson = await postResponse(retryBudget);
      try {
        return parseGeminiJsonFromResponse(retryJson);
      } catch (retryError) {
        const retryFinishReason = String(retryJson?.candidates?.[0]?.finishReason ?? "").toUpperCase();
        if (retryFinishReason === "MAX_TOKENS" && geminiRetryMaxOutputTokens > retryBudget) {
          const finalBudget = geminiRetryMaxOutputTokens;
          const finalJson = await postResponse(finalBudget);
          return parseGeminiJsonFromResponse(finalJson);
        }
        throw retryError;
      }
    }

    const invalidJsonText = cleanStructuredJsonText(getGeminiTextFromResponse(initialJson));
    const repairJson = await postResponse(retryBudget, true, invalidJsonText);
    try {
      return parseGeminiJsonFromResponse(repairJson);
    } catch (repairError) {
      const repairFinishReason = String(repairJson?.candidates?.[0]?.finishReason ?? "").toUpperCase();
      if (repairFinishReason === "MAX_TOKENS" && geminiRetryMaxOutputTokens > retryBudget) {
        const finalBudget = geminiRetryMaxOutputTokens;
        const finalJson = await postResponse(finalBudget, true, invalidJsonText);
        return parseGeminiJsonFromResponse(finalJson);
      }
      throw repairError;
    }
  }
}

async function runLlm(args: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  targetLanguage: string;
  sourceLanguage: LangCode;
  extractedText: string;
  evidenceCandidates: EvidenceCandidate[];
  maxOutputTokens: number;
  timeoutMs?: number;
  workspacePlaybook?: { playbook: any; version: number | null } | null;
  preExtractedFacts?: PreExtractedTenderFacts | null;
}): Promise<AiOutput> {
  if (args.provider === "google") {
    return await runGemini(args);
  }

  return await runOpenAi(args);
}


function buildEvidenceCandidates(extractedText: string): EvidenceCandidate[] {
  const raw = String(extractedText ?? "");
  const sourceLanguage = detectSourceLanguage(raw);
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  type CandidateWithMeta = EvidenceCandidate & {
    bucket: EvidenceBucket;
    lineIndex: number;
  };

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

  const activeLanguages = Array.from(new Set<LangCode>([sourceLanguage, "en"]));
  const patternSets = activeLanguages.map((lang) => LANGUAGE_EVIDENCE_PATTERNS[lang]);
  const matchesAny = (line: string, picker: (patterns: EvidenceRegexSet) => RegExp): boolean =>
    patternSets.some((patterns) => picker(patterns).test(line));

  const isTocLike = (s: string): boolean => /\.{4,}/.test(s) || s.toLowerCase().includes("table of contents");
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

    const hasVerb = matchesAny(t, (patterns) => patterns.normative);
    if (!hasVerb && t === t.toUpperCase() && t.length < 140) return true;

    return false;
  };

  const getSignals = (l: string) => {
    const submission = matchesAny(l, (patterns) => patterns.deadline) || matchesAny(l, (patterns) => patterns.submission);
    const eligibility =
      matchesAny(l, (patterns) => patterns.qualification) ||
      matchesAny(l, (patterns) => patterns.security) ||
      matchesAny(l, (patterns) => patterns.prohibition) ||
      matchesAny(l, (patterns) => patterns.normative);
    const commercial = matchesAny(l, (patterns) => patterns.commercial);
    const evaluation = matchesAny(l, (patterns) => patterns.evaluation);
    const contractTerms = matchesAny(l, (patterns) => patterns.contract_terms);
    return { submission, eligibility, commercial, evaluation, contractTerms };
  };

  const pickBucket = (l: string): EvidenceBucket => {
    const signals = getSignals(l);
    if (signals.evaluation) return "evaluation";
    if (signals.contractTerms) return "contract_terms";
    if (signals.commercial) return "commercial";
    if (signals.submission) return "submission";
    if (signals.eligibility) return "eligibility";
    return "general";
  };

  const candidates: CandidateWithMeta[] = [];
  const seen = new Set<string>();

  const getAnchor = (i: number): string | null => {
    for (let j = i; j >= 0 && j >= i - 8; j--) {
      const l = lines[j];
      if (/^\[page\s+\d+\]/i.test(l)) continue;
      if (/^(section|annex|appendix|part|kapitel|abschnitt|annexe|lotto|lote)\b/i.test(l)) return l;
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
    if (matchesAny(l, (patterns) => patterns.normative)) score += 6;
    if (matchesAny(l, (patterns) => patterns.deadline)) score += 3;
    if (COMMON_DATE_RE.test(l) || COMMON_TIME_RE.test(l)) score += 3;
    if (matchesAny(l, (patterns) => patterns.submission)) score += 2;
    if (matchesAny(l, (patterns) => patterns.security)) score += 2;
    if (matchesAny(l, (patterns) => patterns.qualification)) score += 2;
    if (matchesAny(l, (patterns) => patterns.prohibition)) score += 2;
    if (matchesAny(l, (patterns) => patterns.commercial)) score += 3;
    if (matchesAny(l, (patterns) => patterns.evaluation)) score += 4;
    if (matchesAny(l, (patterns) => patterns.contract_terms)) score += 4;
    if (COMMON_MONEY_RE.test(l)) score += 1;
    return score;
  };

  const makeExcerpt = (i: number, radius = 1): string => {
    const parts: string[] = [];
    const anchor = getAnchor(i);
    if (anchor && !isTitleLike(anchor) && !isTocLike(anchor)) parts.push(anchor);

    for (let k = i - radius; k <= i + radius; k++) {
      if (k >= 0 && k < lines.length) {
        const v = lines[k];
        if (!isTocLike(v) && !isTitleLike(v)) parts.push(v);
      }
    }

    let excerpt = parts.join(" ").replace(/\s+/g, " ").trim();
    if (excerpt.length > 560) excerpt = excerpt.slice(0, 560).trim();
    return excerpt;
  };

  let idCounter = 1;
  for (let i = titleSkipUntil; i < lines.length; i++) {
    const l = lines[i];
    if (isTocLike(l) || isTitleLike(l)) continue;

    const signals = getSignals(l);
    const score = scoreLine(l);
    const threshold = signals.evaluation || signals.contractTerms || signals.commercial || signals.submission ? 3 : 4;
    if (score < threshold) continue;

    const radius = signals.evaluation || signals.contractTerms || signals.commercial ? 2 : 1;
    const excerpt = makeExcerpt(i, radius);
    if (!excerpt || excerpt.length < 30) continue;
    if (isTocLike(excerpt) || isTitleLike(excerpt)) continue;

    const key = excerpt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const kind: EvidenceCandidate["kind"] =
      /^[•\-]\s+/.test(l) ? "bullet" : /\btable\b|\btabella\b|\btableau\b|\btabla\b/i.test(l) ? "table_row" : "clause";

    candidates.push({
      id: `E${String(idCounter++).padStart(3, "0")}`,
      excerpt,
      page: getPage(i),
      anchor: getAnchor(i),
      kind,
      score,
      bucket: pickBucket(l),
      lineIndex: i,
    });

    if (candidates.length >= 280) break;
  }

  const sorted = candidates
    .sort((a, b) => (b.score - a.score) || (a.lineIndex - b.lineIndex) || (a.excerpt.length - b.excerpt.length));

  const selected: CandidateWithMeta[] = [];
  const selectedIds = new Set<string>();
  const bucketCaps: Record<EvidenceBucket, number> = {
    submission: 14,
    eligibility: 14,
    commercial: 10,
    evaluation: 10,
    contract_terms: 10,
    general: 22,
  };

  for (const bucket of EVIDENCE_BUCKET_ORDER) {
    let taken = 0;
    for (const cand of sorted) {
      if (cand.bucket !== bucket || selectedIds.has(cand.id)) continue;
      selected.push(cand);
      selectedIds.add(cand.id);
      taken += 1;
      if (taken >= bucketCaps[bucket]) break;
    }
  }

  for (const cand of sorted) {
    if (selectedIds.has(cand.id)) continue;
    selected.push(cand);
    selectedIds.add(cand.id);
    if (selected.length >= 140) break;
  }

  const ordered = selected
    .slice(0, 140)
    .sort((a, b) => {
      const bucketDiff = EVIDENCE_BUCKET_ORDER.indexOf(a.bucket) - EVIDENCE_BUCKET_ORDER.indexOf(b.bucket);
      if (bucketDiff !== 0) return bucketDiff;
      const pageA = a.page ?? Number.MAX_SAFE_INTEGER;
      const pageB = b.page ?? Number.MAX_SAFE_INTEGER;
      if (pageA !== pageB) return pageA - pageB;
      if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

  return ordered.map(({ lineIndex: _lineIndex, ...cand }) => cand);
}


function normalizeEvidenceLookupText(input: string): string {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeEvidenceLookup(input: string): string[] {
  const STOP = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "must", "shall", "will",
    "der", "die", "das", "und", "mit", "den", "dem", "ein", "eine", "muss",
    "del", "della", "delle", "degli", "dei", "con", "per", "che", "sono", "deve", "devono",
    "des", "les", "pour", "avec", "dans", "une", "être", "etre", "doit", "doivent",
    "los", "las", "con", "para", "una", "debe", "deben",
  ]);

  return normalizeEvidenceLookupText(input)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

function bestEffortEvidenceIdsFromText(args: {
  text: string;
  evidenceCandidates: EvidenceCandidate[];
  limit?: number;
}): string[] {
  const query = String(args.text ?? "").trim();
  if (!query) return [];

  const normQuery = normalizeEvidenceLookupText(query);
  if (!normQuery || normQuery.length < 12) return [];

  const queryTokens = Array.from(new Set(tokenizeEvidenceLookup(query))).slice(0, 14);
  if (queryTokens.length === 0) return [];

  const scored = (args.evidenceCandidates ?? [])
    .map((cand) => {
      const excerpt = String(cand?.excerpt ?? "").trim();
      if (!excerpt) return null;

      const normExcerpt = normalizeEvidenceLookupText(excerpt);
      if (!normExcerpt) return null;

      let score = 0;

      if (normExcerpt.includes(normQuery)) score += 12;
      if (normQuery.includes(normExcerpt) && normExcerpt.length >= 40) score += 8;

      const excerptTokens = new Set(tokenizeEvidenceLookup(excerpt));
      let overlap = 0;
      for (const tok of queryTokens) {
        if (excerptTokens.has(tok)) overlap += 1;
      }

      const overlapRatio = overlap / Math.max(queryTokens.length, 1);
      if (overlap >= 3) score += overlap * 2;
      if (overlapRatio >= 0.5) score += 5;
      else if (overlapRatio >= 0.35) score += 3;

      const anchor = normalizeEvidenceLookupText(String(cand?.anchor ?? ""));
      if (anchor) {
        for (const tok of queryTokens.slice(0, 6)) {
          if (anchor.includes(tok)) score += 0.5;
        }
      }

      if (score < 8) return null;
      return { id: String(cand.id), score };
    })
    .filter(Boolean) as Array<{ id: string; score: number }>;

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(args.limit ?? 2, 3)))
    .map((x) => x.id);
}

	const corsHeaders = {
	  "Access-Control-Allow-Origin": "*",
	  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenderpilot-secret",
	  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

    // Shared-secret gate (recommended for pg_net/cron callers)
    const expectedSecret = String(
      Deno.env.get("TP_CRON_SECRET") ?? Deno.env.get("TP_SECRET") ?? ""
    ).trim();

    if (expectedSecret) {
      const headerSecret = String(req.headers.get("x-tenderpilot-secret") ?? "").trim();
      const querySecret = String(url.searchParams.get("tp_secret") ?? "").trim();
      const provided = headerSecret || querySecret;

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

      const pipelineResult = await mergeJobPipeline(supabaseAdmin, job, {
        evidence: {
          version: 1,
          generated_at: new Date().toISOString(),
          candidates: bounded,
        },
      });

      if (!pipelineResult.ok) {
        await logEvent(supabaseAdmin, job, "warn", "Pipeline evidence save failed", { error: pipelineResult.error?.message ?? String(pipelineResult.error) });
      } else {
        await logEvent(supabaseAdmin, job, "info", "Pipeline evidence saved", { candidates: bounded.length });
      }
    } catch (e) {
      await logEvent(supabaseAdmin, job, "warn", "Pipeline evidence save threw", { error: (e as Error)?.message ?? String(e) });
    }

    // AI analysis
    const maxInputChars = parseNumberEnv("TP_MAX_INPUT_CHARS", 120_000);
    const maxOutputTokens = parseNumberEnv("TP_MAX_OUTPUT_TOKENS", 3200);
    const maxUsdPerJob = parseNumberEnv("TP_MAX_USD_PER_JOB", 0.05);
    const modelSelection = resolveLlmSelection(job);

    let aiOut: AiOutput;
    let playbookVersion: number | null = null;
    let preExtractedFacts = extractDeterministicTenderFacts({ evidenceCandidates: [], extractedText: "" });

    if (useMockAi) {
      aiOut = mockAiFixture(extractedText);
      await logEvent(supabaseAdmin, job, "info", "Mock AI enabled", {
        provider: modelSelection.entry.provider,
        resolved_model: modelSelection.resolvedModel,
      });
    } else {
      const provider = modelSelection.entry.provider;
      const providerModel = modelSelection.entry.providerModel;
      const resolvedModel = modelSelection.resolvedModel;
      const requestedModel = modelSelection.requestedModel;
      const selectionSource = modelSelection.selectionSource;
      const apiKey = firstApiKeyForModel(modelSelection.entry);

      if (requestedModel && modelSelection.resolutionReason !== "requested_allowed") {
        await logEvent(supabaseAdmin, job, "warn", "Requested model override not applied", {
          requested_model: requestedModel,
          resolved_model: resolvedModel,
          default_model: modelSelection.defaultModel,
          selection_source: selectionSource,
          resolution_reason: modelSelection.resolutionReason,
          allowed_models: modelSelection.allowedModels,
        });
      }

      const { text: clipped, truncated } = clampText(extractedText, maxInputChars);
      if (truncated) {
        await logEvent(supabaseAdmin, job, "warn", "Source text truncated for AI", { maxChars: maxInputChars });
      }

      const inputTokensEst = estimateTokensFromChars(clipped.length);
      const usdEst = estimateUsd({ modelKey: resolvedModel, inputTokens: inputTokensEst, outputTokens: maxOutputTokens });

      if (usdEst !== null && usdEst > maxUsdPerJob) {
        await logEvent(supabaseAdmin, job, "warn", "Job exceeds cost cap, reduce input or limits", {
          model: resolvedModel,
          provider,
          provider_model: providerModel,
          maxUsdPerJob,
          usdEst,
          inputChars: clipped.length,
          inputTokensEst,
          maxOutputTokens,
        });

        await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
        return new Response("Job exceeds cost cap", { status: 413 });
      }

      if (usdEst === null) {
        await logEvent(supabaseAdmin, job, "info", "LLM cost estimate unavailable for resolved model", {
          model: resolvedModel,
          provider,
          provider_model: providerModel,
        });
      }

      const remaining = remainingRuntimeMs(startMs);

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

      const { output: outputLang } = await loadUserLanguagesAdmin(supabaseAdmin, job.user_id);
      const targetLanguage = langName(outputLang);
      const sourceLanguage = detectSourceLanguage(extractedText);
      preExtractedFacts = extractDeterministicTenderFacts({ evidenceCandidates, extractedText });

      const aiPipelineResult = await mergeJobPipeline(supabaseAdmin, job, {
        ai: {
          requested_model: requestedModel,
          selection_source: selectionSource,
          default_model: modelSelection.defaultModel,
          resolved_model: resolvedModel,
          provider,
          provider_model: providerModel,
          resolution_reason: modelSelection.resolutionReason,
          allowed_models: modelSelection.allowedModels,
          prompt_version: PROCESS_JOB_PROMPT_VERSION,
          schema_version: PROCESS_JOB_SCHEMA_VERSION,
          evidence_selection_version: EVIDENCE_SELECTION_VERSION,
          playbook_version: workspacePlaybook.version,
          target_language: targetLanguage,
          source_language: sourceLanguage,
          status: "starting",
        },
      });

      if (!aiPipelineResult.ok) {
        await logEvent(supabaseAdmin, job, "warn", "Pipeline AI metadata save failed", {
          error: aiPipelineResult.error?.message ?? String(aiPipelineResult.error),
        });
      }

      await logEvent(supabaseAdmin, job, "info", "LLM prompt prepared", {
        requested_model: requestedModel,
        resolved_model: resolvedModel,
        provider,
        provider_model: providerModel,
        selection_source: selectionSource,
        resolution_reason: modelSelection.resolutionReason,
        target_language: targetLanguage,
        source_language: sourceLanguage,
        extracted_chars: clipped.length,
        evidence_candidates: evidenceCandidates.length,
        playbook_present: Boolean(workspacePlaybook.playbook),
        playbook_version: workspacePlaybook.version,
        pre_extracted_deadline_source: preExtractedFacts.submissionDeadline.source,
        pre_extracted_deadline_iso: preExtractedFacts.submissionDeadline.iso,
        pre_extracted_submission_channel: preExtractedFacts.submissionChannel?.value ?? null,
        pre_extracted_procurement_procedure: preExtractedFacts.procurementProcedure?.value ?? null,
        pre_extracted_clarification_deadline_iso: preExtractedFacts.clarificationDeadline.iso,
      });

      const analysisFingerprint = buildAnalysisFingerprint({
        model: resolvedModel,
        targetLanguage,
        sourceLanguage,
        evidenceCandidates,
        playbookVersion: workspacePlaybook.version,
      });
      await logEvent(supabaseAdmin, job, "info", "Analysis fingerprint", {
        ...analysisFingerprint,
        provider,
        provider_model: providerModel,
        requested_model: requestedModel,
        resolution_reason: modelSelection.resolutionReason,
      });

      const timeoutCap = parseNumberEnv(modelSelection.entry.timeoutEnvName, modelSelection.entry.defaultTimeoutMs);

      await logEvent(supabaseAdmin, job, "info", "LLM started", {
        requested_model: requestedModel,
        resolved_model: resolvedModel,
        provider,
        provider_model: providerModel,
        maxOutputTokens,
        remaining_ms: remaining,
        timeout_cap_ms: timeoutCap,
        temperature: provider === "openai"
          ? (modelSupportsTemperature(providerModel) ? OPENAI_TEMPERATURE : null)
          : GEMINI_TEMPERATURE,
        temperature_omitted: provider === "openai" ? !modelSupportsTemperature(providerModel) : false,
      });

      const timeoutMs = Math.max(
        3_000,
        Math.min(
          remaining - RUNTIME_SAFETY_MS,
          Math.max(5_000, timeoutCap),
        ),
      );

      aiOut = await runLlm({
        provider,
        apiKey,
        model: providerModel,
        targetLanguage,
        sourceLanguage,
        extractedText: clipped,
        evidenceCandidates,
        maxOutputTokens,
        timeoutMs,
        workspacePlaybook,
        preExtractedFacts,
      });
      await logEvent(supabaseAdmin, job, "info", "LLM completed", {
        requested_model: requestedModel,
        resolved_model: resolvedModel,
        provider,
        provider_model: providerModel,
        maxOutputTokens,
      });

      const completedPipelineResult = await mergeJobPipeline(supabaseAdmin, job, {
        ai: {
          executed_model: resolvedModel,
          executed_provider: provider,
          executed_provider_model: providerModel,
          completed_at: new Date().toISOString(),
          status: "completed",
        },
      });

      if (!completedPipelineResult.ok) {
        await logEvent(supabaseAdmin, job, "warn", "Pipeline AI completion metadata save failed", {
          error: completedPipelineResult.error?.message ?? String(completedPipelineResult.error),
        });
      }
    }

    aiOut = normalizeAiOutputForUi(aiOut);
    aiOut = applyDecisionRules({
      aiOut,
      evidenceCandidates,
      extractedText,
      nowIso: new Date().toISOString(),
    });

    // Evidence-first normalization (product-grade):
    // - AI should cite evidence_ids for MUST checklist items and for risks.
    // - Backend backfills `source` (UI compatibility) from the referenced evidence excerpt(s).
    // - If evidence_ids are missing or unresolvable, we flag `needs_verification` instead of silently inventing support.
    {
      const evidenceById = new Map<string, EvidenceCandidate>();
      const evidenceOrder = new Map<string, number>();
      for (let i = 0; i < evidenceCandidates.length; i++) {
        const e = evidenceCandidates[i];
        evidenceById.set(e.id, e);
        evidenceOrder.set(e.id, i);
      }

      const resolveSource = (args: { ids?: string[]; text?: string; extraText?: string }): { ids: string[]; source: string | null; recovered: boolean } => {
        const valid = (args.ids ?? []).filter((id) => evidenceById.has(id));
        if (valid.length > 0) {
          const first = evidenceById.get(valid[0])!;
          return { ids: valid, source: first.excerpt, recovered: false };
        }

        const fallbackText = [String(args.text ?? "").trim(), String(args.extraText ?? "").trim()].filter(Boolean).join(": ");
        if (!fallbackText) return { ids: [], source: null, recovered: false };

        const recoveredIds = bestEffortEvidenceIdsFromText({
          text: fallbackText,
          evidenceCandidates,
          limit: 2,
        }).filter((id) => evidenceById.has(id));

        if (recoveredIds.length === 0) return { ids: [], source: null, recovered: false };

        const first = evidenceById.get(recoveredIds[0])!;
        return { ids: recoveredIds, source: first.excerpt, recovered: true };
      };

      const missingEvidenceReason = "No resolvable evidence_id (candidate not present or not selected in this run).";
      const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
      const checklistTypeRank: Record<"MUST" | "SHOULD" | "INFO", number> = { MUST: 0, SHOULD: 1, INFO: 2 };
      const firstEvidencePosition = (ids?: string[]) => {
        const positions = (ids ?? []).map((id) => evidenceOrder.get(id)).filter((v): v is number => Number.isFinite(v));
        return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
      };

      const checklist: AiOutput["checklist"] = (Array.isArray(aiOut.checklist) ? aiOut.checklist : []).map((it) => {
        const t = (it as any).type as "MUST" | "SHOULD" | "INFO";
        const textValue = String((it as any)?.text ?? "").trim();
        const { ids, source, recovered } = resolveSource({ ids: it.evidence_ids, text: textValue });

        const base: any = {
          ...(it as any),
          type: t,
          evidence_ids: ids,
        };

        if (source) base.source = source;
        if (recovered) base.evidence_backfilled = true;

        if (t === "MUST" && ids.length === 0) {
          base.needs_verification = true;
          base.verification_reason = missingEvidenceReason;
        }

        return base;
      }).sort((a, b) => {
        const typeDiff = checklistTypeRank[a.type] - checklistTypeRank[b.type];
        if (typeDiff !== 0) return typeDiff;
        const evidenceDiff = firstEvidencePosition(a.evidence_ids) - firstEvidencePosition(b.evidence_ids);
        if (evidenceDiff !== 0) return evidenceDiff;
        return String(a.text ?? "").localeCompare(String(b.text ?? ""));
      });

      const risks: AiOutput["risks"] = (Array.isArray(aiOut.risks) ? aiOut.risks : []).map((r) => {
        const titleValue = String((r as any)?.title ?? "").trim();
        const detailValue = String((r as any)?.detail ?? "").trim();
        const { ids, source, recovered } = resolveSource({ ids: r.evidence_ids, text: titleValue, extraText: detailValue });
        const out: any = { ...r, evidence_ids: ids };
        if (source) out.source = source;
        if (recovered) out.evidence_backfilled = true;
        if (ids.length === 0) {
          out.needs_verification = true;
          out.verification_reason = missingEvidenceReason;
        }
        return out;
      }).sort((a, b) => {
        const severityDiff = severityRank[a.severity] - severityRank[b.severity];
        if (severityDiff !== 0) return severityDiff;
        const evidenceDiff = firstEvidencePosition(a.evidence_ids) - firstEvidencePosition(b.evidence_ids);
        if (evidenceDiff !== 0) return evidenceDiff;
        return String(a.title ?? "").localeCompare(String(b.title ?? ""));
      });

      const executive = aiOut.executive_summary ?? ({} as AiOutput["executive_summary"]);
      const hardBlockers = (Array.isArray(executive.hard_blockers) ? executive.hard_blockers : []).map((item: any) => {
        const titleValue = String(item?.title ?? "").trim();
        const detailValue = String(item?.detail ?? "").trim();
        const { ids, recovered } = resolveSource({ ids: item?.evidence_ids, text: titleValue, extraText: detailValue });
        return {
          ...item,
          evidence_ids: ids,
          ...(recovered ? { evidence_backfilled: true } : {}),
        };
      }).filter((item: any) => item.title || item.detail);

      const decisionReasons = (Array.isArray(executive.decision_reasons) ? executive.decision_reasons : []).map((item: any) => {
        const reasonValue = String(item?.reason ?? "").trim();
        const { ids, recovered } = resolveSource({ ids: item?.evidence_ids, text: reasonValue });
        return {
          ...item,
          evidence_ids: ids,
          ...(recovered ? { evidence_backfilled: true } : {}),
        };
      }).filter((item: any) => item.reason);

      const topRisks = risks.slice(0, 3).map((item) => ({
        title: item.title,
        severity: item.severity,
        detail: item.detail,
      }));

      aiOut = {
        ...aiOut,
        executive_summary: {
          ...executive,
          hard_blockers: hardBlockers,
          decision_reasons: decisionReasons,
          topRisks: topRisks.length ? topRisks : executive.topRisks,
        },
        checklist,
        risks,
      };
    }

    aiOut = applyDecisionConsistencyChecks({ aiOut });

    const decisionMeta = (aiOut as any)?.executive_summary ?? {};
    const decisionPipelineResult = await mergeJobPipeline(supabaseAdmin, job, {
      ai: {
        llm_decision: decisionMeta?.llmDecisionBadge ?? decisionMeta?.decisionBadge ?? null,
        final_decision: decisionMeta?.finalDecisionBadge ?? decisionMeta?.decisionBadge ?? null,
        decision_source: decisionMeta?.decisionSource ?? null,
        tender_status: decisionMeta?.tenderStatus ?? null,
        hard_stop_reasons: Array.isArray(decisionMeta?.hardStopReasons) ? decisionMeta.hardStopReasons : [],
        submission_deadline_text: decisionMeta?.submissionDeadline ?? null,
        submission_deadline_iso: decisionMeta?.submissionDeadlineIso ?? null,
        submission_deadline_timezone: decisionMeta?.submissionTimezone ?? null,
        submission_deadline_source: decisionMeta?.submissionDeadlineSource ?? null,
        pre_extracted_facts: {
          submission_deadline: preExtractedFacts.submissionDeadline,
          clarification_deadline: preExtractedFacts.clarificationDeadline,
          submission_channel: preExtractedFacts.submissionChannel,
          procurement_procedure: preExtractedFacts.procurementProcedure,
          validity_period: preExtractedFacts.validityPeriod,
          contract_term: preExtractedFacts.contractTerm,
          lot_structure: preExtractedFacts.lotStructure,
          attachment_mentions: preExtractedFacts.attachmentMentions,
          schedule_mentions: preExtractedFacts.scheduleMentions,
        },
        decision_evaluated_at: new Date().toISOString(),
      },
    });

    if (!decisionPipelineResult.ok) {
      await logEvent(supabaseAdmin, job, "warn", "Pipeline decision metadata save failed", {
        error: decisionPipelineResult.error?.message ?? String(decisionPipelineResult.error),
      });
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
    const normalizedError = normalizeThrownError(e);
    const isOpenAiTimeout =
      typeof msg === "string" &&
      msg.toLowerCase().includes("openai request timed out");

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

        const { data: jobForLog } = await supabaseAdmin
          .from("jobs")
          .select("id,user_id")
          .eq("id", jobIdForCleanup)
          .maybeSingle();

        if (jobForLog?.id && jobForLog?.user_id) {
          await supabaseAdmin.from("job_events").insert({
            job_id: jobForLog.id,
            user_id: jobForLog.user_id,
            level: isOpenAiTimeout ? "warn" : "error",
            message: isOpenAiTimeout ? "OpenAI request timed out" : "Processing crashed",
            meta: {
              error: normalizedError,
              active_job_id: activeJobId,
            },
          });
        }

        if (isOpenAiTimeout) {
          await makeJobReclaimableNow(supabaseAdmin, jobIdForCleanup);
        } else {
          await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", jobIdForCleanup);
        }
      }
    } catch {
      // ignore
    }

    if (isOpenAiTimeout) {
      return corsJson({ ok: true, status: "transient_openai_timeout_retryable" }, { status: 200 });
    }

    return corsJson({ ok: false, error: normalizedError }, { status: 500 });
  } finally {
    try {
      stopHeartbeat?.();
    } catch {
      // ignore
    }
  }
});