"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { stableRefKey } from "@/lib/bid-workflow/keys";
import {
  canonicalizeWorkStatus,
  isBlockedWorkStatus,
  isDoneWorkStatus,
  isWorkStatusRetryableError,
  workStatusWriteCandidates,
} from "@/lib/bid-workflow/work-status";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useAppI18n } from "@/app/app/_components/app-i18n-provider";
import { saveToAnswerLibrary } from "@/app/actions/knowledge-base";

type WorkItemType = "requirement" | "risk" | "clarification" | "outline" | "deadline" | "submission" | "admin";

type EvidenceCandidateUi = {
  id: string;
  excerpt?: string | null;
  page?: number | null;
  anchor?: string | null;
};

type WorkBaseRow = {
  type: WorkItemType;
  ref_key: string;
  title: string;
  meta?: string;
  evidenceIds?: string[];
  defaultStatus?: "todo" | "doing" | "blocked" | "done";
  defaultDueAt?: string | null;
};

type TenderFactValue = {
  value: string;
  evidenceIds: string[];
  source: string | null;
  confidence: string | null;
};

type TenderDeadlineFact = {
  text: string;
  iso: string | null;
  timezone: string | null;
  source: string | null;
};

import { getEffectiveReviewState } from "@/lib/review-state";

type BidRoomTenderFacts = {
  reviewState: ReturnType<typeof getEffectiveReviewState>;
  clarificationDeadline: TenderDeadlineFact | null;
  submissionChannel: TenderFactValue | null;
  procurementProcedure: TenderFactValue | null;
  validityPeriod: TenderFactValue | null;
  contractTerm: TenderFactValue | null;
  lotStructure: TenderFactValue | null;
  portalUrl: string | null;
};

function mergeUniqueEvidenceIds(...groups: Array<string[] | undefined>): string[] | undefined {
  const merged = groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);

  if (!merged.length) return undefined;
  return Array.from(new Set(merged));
}

function dedupeWorkBaseRows(rows: WorkBaseRow[]): WorkBaseRow[] {
  const byKey = new Map<string, WorkBaseRow>();

  for (const row of rows) {
    const key = `${row.type}:${row.ref_key}`;
    const prev = byKey.get(key);

    if (!prev) {
      byKey.set(key, row);
      continue;
    }

    byKey.set(key, {
      ...prev,
      title: prev.title || row.title,
      meta: prev.meta || row.meta,
      evidenceIds: mergeUniqueEvidenceIds(prev.evidenceIds, row.evidenceIds),
    });
  }

  return Array.from(byKey.values());
}

type EvidenceFocus = {
  id: string;
  excerpt: string;
  page: number | null;
  anchor: string | null;
  note: string | null;
  allIds: string[] | null;
};

export function BidRoomPanel(props: {
  jobId: string;
  jobFilePath?: string | null;
  evidenceCandidates?: any[];
  checklist: any[];
  risks: any[];
  questions: string[];
  outlineSections: Array<{ title: string; bullets?: string[] }>;
  canDownload: boolean;
  tenderFacts?: BidRoomTenderFacts | null;
  className?: string;
  showHeader?: boolean;
  showExport?: boolean;
  onExportError?: (msg: string) => void;
}) {
  const { jobId, checklist, risks, questions, outlineSections, canDownload, tenderFacts } = props;

  const { t } = useAppI18n();
  const tx = (key: string, fallback: string, vars?: Record<string, string | number>) => {
    const value = t(key as any, vars as any);
    return value === key ? fallback : value;
  };

  const [workItems, setWorkItems] = useState<any[]>([]);
  const [workError, setWorkError] = useState<string | null>(null);
  const [workSaving, setWorkSaving] = useState<string | null>(null);

  const [query, setQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | WorkItemType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "doing" | "blocked" | "done">("all");
  const [hideDone, setHideDone] = useState<boolean>(true);

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceFocus, setEvidenceFocus] = useState<EvidenceFocus | null>(null);
  const [notesOpen, setNotesOpen] = useState<Set<string>>(() => new Set());

  // --- NEW: Knowledge Base State ---
  const [savingKbIdx, setSavingKbIdx] = useState<string | null>(null);
  const [savedKbIdx, setSavedKbIdx] = useState<Record<string, boolean>>({});

  async function handleSaveToKb(key: string, questionText: string, answerText: string) {
    if (!answerText.trim()) return;
    setSavingKbIdx(key);
    try {
      const res = await saveToAnswerLibrary(questionText, answerText, ["clarification"]);
      if (res?.success) {
        setSavedKbIdx((prev) => ({ ...prev, [key]: true }));
        window.setTimeout(() => setSavedKbIdx((prev) => ({ ...prev, [key]: false })), 3000);
      } else {
        alert(res?.message || "Error saving answer.");
      }
    } catch (e) {
      alert("A network error occurred. Please try again.");
    } finally {
      setSavingKbIdx(null);
    }
  }
  // ----------------------------------

  const workWriteInFlightRef = useRef<Set<string>>(new Set());
  const workWritePendingRef = useRef<Map<string, any>>(new Map());

  const evidenceById = useMemo(() => {
    const map = new Map<string, EvidenceCandidateUi>();
    const candidates = Array.isArray(props.evidenceCandidates) ? props.evidenceCandidates : [];
    for (const c of candidates) {
      const id = String((c as any)?.id ?? "").trim();
      if (!id) continue;
      map.set(id, c as EvidenceCandidateUi);
    }
    return map;
  }, [props.evidenceCandidates]);

  function extractEvidenceIds(obj: any): string[] {
    const raw = (obj as any)?.evidence_ids ?? (obj as any)?.evidenceIds ?? (obj as any)?.evidence ?? null;
    return Array.isArray(raw) ? raw.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
  }

  function toDueDateValue(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function compactFactValue(value: string | null | undefined, max = 88): string {
    const s = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!s) return tx("app.common.unknown", "Unknown");
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1).trimEnd()}…`;
  }

  async function openPdfAt(args?: { page?: number | null }) {
    setWorkError(null);
    const filePath = String(props.jobFilePath ?? "").trim();
    if (!filePath) {
      setWorkError(t("app.bidroom.errors.noPdf"));
      return;
    }

    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.storage.from("uploads").createSignedUrl(filePath, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error(t("app.bidroom.errors.noSignedUrl"));
      const p = typeof args?.page === "number" && Number.isFinite(args.page) ? Math.max(1, Math.floor(args.page)) : null;
      const url = p ? `${data.signedUrl}#page=${p}` : data.signedUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.warn(e);
      setWorkError(t("app.bidroom.errors.openPdfFailed"));
    }
  }

  function showEvidenceByIds(evidenceIds: string[] | undefined) {
    const ids = Array.isArray(evidenceIds) ? evidenceIds.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
    const primary = ids.find((id) => evidenceById.has(id)) || ids[0] || "";
    const cand = primary ? evidenceById.get(primary) : null;

    if (cand) {
      setEvidenceFocus({
        id: String(cand.id),
        excerpt: String(cand.excerpt ?? "").trim(),
        page: typeof cand.page === "number" ? cand.page : null,
        anchor: cand.anchor ? String(cand.anchor) : null,
        note: null,
        allIds: ids.length ? ids : null,
      });
      setEvidenceOpen(true);
      return;
    }

    if (primary) {
      setEvidenceFocus({
        id: primary,
        excerpt: "",
        page: null,
        anchor: null,
        note:
          t("app.bidroom.evidence.notes.notFound"),
        allIds: ids.length ? ids : null,
      });
    } else {
      setEvidenceFocus({
        id: "",
        excerpt: "",
        page: null,
        anchor: null,
        note: t("app.bidroom.evidence.notes.none"),
        allIds: null,
      });
    }
    setEvidenceOpen(true);
  }

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;

    async function loadWork() {
      setWorkError(null);
      const { data, error } = await supabase
        .from("job_work_items")
        .select("*")
        .eq("job_id", jobId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn("Failed to load work items", error);
        setWorkError(t("app.bidroom.errors.loadWorkFailed"));
        setWorkItems([]);
        return;
      }
      setWorkItems((data as any[]) ?? []);
    }

    if (jobId) loadWork();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const factCards = useMemo(() => {
    const cards: Array<{ key: string; label: string; value: string; note?: string; evidenceIds?: string[]; kind: "fact" | "deadline" | "portal" | "decision"; isExpired?: boolean }> = [];

    const rs = tenderFacts?.reviewState;

    if (rs?.decisionText) {
      const isGo = rs.decision === "go";
      const isNoGo = rs.decision === "no-go";
      const isHold = rs.decision === "hold";
      cards.push({
        key: "decision",
        label: tx("app.bidroom.facts.labels.decision", "Go/No-Go Decision"),
        value: rs.decisionText,
        note: isGo ? "Go" : isNoGo ? "No-Go" : isHold ? "Hold" : "Unknown",
        kind: "decision",
      });
    }

    if (rs?.submissionDeadlineText) {
      cards.push({
        key: "submission_deadline",
        label: t("app.bidroom.facts.labels.submissionDeadline"),
        value: rs.submissionDeadlineDisplayText || rs.submissionDeadlineText,
        note: rs.submissionDeadlineIso && new Date(rs.submissionDeadlineIso).getTime() < Date.now() ? t("app.bidroom.facts.status.expired") : t("app.bidroom.facts.status.track"),
        kind: "deadline",
        isExpired: rs.submissionDeadlineIso ? new Date(rs.submissionDeadlineIso).getTime() < Date.now() : false,
      });
    }

    if (tenderFacts?.clarificationDeadline && tenderFacts.clarificationDeadline.text !== "not found in extracted text" && tenderFacts.clarificationDeadline.text !== "unknown") {
      const iso = tenderFacts.clarificationDeadline.iso;
      const isExpired = iso ? new Date(iso).getTime() < Date.now() : false;
      
      const d = iso ? new Date(iso) : null;
      const pad = (n: number) => String(n).padStart(2, "0");
      const display = d && !Number.isNaN(d.getTime()) 
        ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`
        : tenderFacts.clarificationDeadline.text;

      cards.push({
        key: "clarification_deadline",
        label: t("app.bidroom.facts.labels.clarificationDeadline"),
        value: display,
        note: isExpired ? t("app.bidroom.facts.status.expired") : t("app.bidroom.facts.status.track"),
        kind: "deadline",
        isExpired,
      });
    }

    if (tenderFacts?.submissionChannel?.value) {
      cards.push({
        key: "submission_channel",
        label: t("app.bidroom.facts.labels.submissionChannel"),
        value: compactFactValue(tenderFacts.submissionChannel.value, 72),
        evidenceIds: tenderFacts.submissionChannel.evidenceIds,
        kind: "fact",
      });
    }

    if (tenderFacts?.procurementProcedure?.value) {
      cards.push({
        key: "procedure",
        label: t("app.bidroom.facts.labels.procedure"),
        value: compactFactValue(tenderFacts.procurementProcedure.value, 72),
        evidenceIds: tenderFacts.procurementProcedure.evidenceIds,
        kind: "fact",
      });
    }

    if (tenderFacts?.validityPeriod?.value) {
      cards.push({
        key: "validity_period",
        label: tx("app.bidroom.facts.labels.validityPeriod", "Validity period"),
        value: compactFactValue(tenderFacts.validityPeriod.value, 72),
        evidenceIds: tenderFacts.validityPeriod.evidenceIds,
        kind: "fact",
      });
    }

    if (tenderFacts?.contractTerm?.value) {
      cards.push({
        key: "contract_term",
        label: tx("app.bidroom.facts.labels.contractTerm", "Contract term"),
        value: compactFactValue(tenderFacts.contractTerm.value, 72),
        evidenceIds: tenderFacts.contractTerm.evidenceIds,
        kind: "fact",
      });
    }

    if (tenderFacts?.lotStructure?.value) {
      cards.push({
        key: "lot_structure",
        label: tx("app.bidroom.facts.labels.lotStructure", "Lot structure"),
        value: compactFactValue(tenderFacts.lotStructure.value, 72),
        evidenceIds: tenderFacts.lotStructure.evidenceIds,
        kind: "fact",
      });
    }

    if (tenderFacts?.portalUrl) {
      cards.push({
        key: "portal_url",
        label: t("app.bidroom.facts.labels.portal"),
        value: compactFactValue(tenderFacts.portalUrl, 72),
        kind: "portal",
      });
    }

    return cards;
  }, [t, tenderFacts]);

  const factWorkRows = useMemo(() => {
    const rows: WorkBaseRow[] = [];

    const rs = tenderFacts?.reviewState;
    if (rs?.submissionDeadlineText) {
      const display = rs.submissionDeadlineDisplayText || rs.submissionDeadlineText;
      const expired = rs.submissionDeadlineIso ? new Date(rs.submissionDeadlineIso).getTime() < Date.now() : false;
      const title = expired
        ? tx("app.bidroom.autogen.submissionDeadlineExpired", "Submission deadline already expired")
        : tx("app.bidroom.autogen.submissionDeadlineOpen", "Submit tender before {deadline}", { deadline: display });
      rows.push({
        type: "deadline",
        ref_key: stableRefKey({ jobId, type: "deadline", text: "submission_deadline", extra: display }),
        title,
        meta: t("app.bidroom.facts.labels.submissionDeadline"),
        defaultStatus: expired ? "blocked" : "todo",
        defaultDueAt: toDueDateValue(rs.submissionDeadlineIso),
      });
    }

    if (tenderFacts?.clarificationDeadline && tenderFacts.clarificationDeadline.text !== "not found in extracted text" && tenderFacts.clarificationDeadline.text !== "unknown") {
      const iso = tenderFacts.clarificationDeadline.iso;
      const expired = iso ? new Date(iso).getTime() < Date.now() : false;
      
      const d = iso ? new Date(iso) : null;
      const pad = (n: number) => String(n).padStart(2, "0");
      const display = d && !Number.isNaN(d.getTime()) 
        ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`
        : tenderFacts.clarificationDeadline.text;

      rows.push({
        type: "deadline",
        ref_key: stableRefKey({ jobId, type: "deadline", text: "clarification_deadline", extra: display }),
        title: expired
          ? tx("app.bidroom.autogen.clarificationDeadlineExpired", "Clarification deadline already passed")
          : tx("app.bidroom.autogen.clarificationDeadlineOpen", "Submit clarification questions before {deadline}", { deadline: display }),
        meta: t("app.bidroom.facts.labels.clarificationDeadline"),
        defaultStatus: expired ? "blocked" : "todo",
        defaultDueAt: toDueDateValue(iso),
      });
    }

    if (tenderFacts?.submissionChannel?.value) {
      rows.push({
        type: "submission",
        ref_key: stableRefKey({ jobId, type: "submission", text: "submission_channel", extra: tenderFacts.submissionChannel.value }),
        title: tx("app.bidroom.autogen.submissionChannel", "Confirm submission route: {value}", { value: compactFactValue(tenderFacts.submissionChannel.value, 80) }),
        meta: t("app.bidroom.facts.labels.submissionChannel"),
        evidenceIds: tenderFacts.submissionChannel.evidenceIds,
        defaultStatus: "todo",
      });
    }

    if (tenderFacts?.portalUrl) {
      rows.push({
        type: "submission",
        ref_key: stableRefKey({ jobId, type: "submission", text: "portal_access", extra: tenderFacts.portalUrl }),
        title: tx("app.bidroom.autogen.portalAccess", "Verify portal access and upload permissions"),
        meta: t("app.bidroom.facts.labels.portal"),
        defaultStatus: "todo",
      });
    }

    if (tenderFacts?.procurementProcedure?.value) {
      rows.push({
        type: "admin",
        ref_key: stableRefKey({ jobId, type: "admin", text: "procurement_procedure", extra: tenderFacts.procurementProcedure.value }),
        title: tx("app.bidroom.autogen.procedure", "Align response workflow with procedure: {value}", { value: compactFactValue(tenderFacts.procurementProcedure.value, 72) }),
        meta: t("app.bidroom.facts.labels.procedure"),
        evidenceIds: tenderFacts.procurementProcedure.evidenceIds,
        defaultStatus: "todo",
      });
    }

    if (tenderFacts?.validityPeriod?.value) {
      rows.push({
        type: "admin",
        ref_key: stableRefKey({ jobId, type: "admin", text: "validity_period", extra: tenderFacts.validityPeriod.value }),
        title: tx("app.bidroom.autogen.validityPeriod", "Confirm offer validity period: {value}", { value: compactFactValue(tenderFacts.validityPeriod.value, 72) }),
        meta: tx("app.bidroom.facts.labels.validityPeriod", "Validity period"),
        evidenceIds: tenderFacts.validityPeriod.evidenceIds,
        defaultStatus: "todo",
      });
    }

    if (tenderFacts?.contractTerm?.value) {
      rows.push({
        type: "admin",
        ref_key: stableRefKey({ jobId, type: "admin", text: "contract_term", extra: tenderFacts.contractTerm.value }),
        title: tx("app.bidroom.autogen.contractTerm", "Review contract term and delivery horizon: {value}", { value: compactFactValue(tenderFacts.contractTerm.value, 72) }),
        meta: tx("app.bidroom.facts.labels.contractTerm", "Contract term"),
        evidenceIds: tenderFacts.contractTerm.evidenceIds,
        defaultStatus: "todo",
      });
    }

    if (tenderFacts?.lotStructure?.value) {
      rows.push({
        type: "admin",
        ref_key: stableRefKey({ jobId, type: "admin", text: "lot_structure", extra: tenderFacts.lotStructure.value }),
        title: tx("app.bidroom.autogen.lotStructure", "Confirm bidding scope by lot: {value}", { value: compactFactValue(tenderFacts.lotStructure.value, 72) }),
        meta: tx("app.bidroom.facts.labels.lotStructure", "Lot structure"),
        evidenceIds: tenderFacts.lotStructure.evidenceIds,
        defaultStatus: "todo",
      });
    }

    return rows;
  }, [jobId, t, tenderFacts, tx]);

  const workBaseRows: WorkBaseRow[] = useMemo(() => {
    const rows: WorkBaseRow[] = [...factWorkRows];

    for (const it of checklist ?? []) {
      const kind = String((it as any)?.type ?? (it as any)?.level ?? (it as any)?.priority ?? "INFO").toUpperCase();
      const text = String((it as any)?.text ?? (it as any)?.requirement ?? "").trim();
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "requirement", text, extra: kind });
      rows.push({ type: "requirement", ref_key: ref, title: text, meta: kind, evidenceIds: extractEvidenceIds(it) });
    }

    for (const r of risks ?? []) {
      const title = String((r as any)?.title ?? (r as any)?.text ?? (r as any)?.risk ?? "").trim();
      const detail = String((r as any)?.detail ?? (r as any)?.description ?? (r as any)?.why ?? (r as any)?.impact ?? "").trim();
      const sev = String((r as any)?.severity ?? (r as any)?.level ?? "medium").toLowerCase();
      const text = title || detail;
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "risk", text, extra: sev });
      rows.push({ type: "risk", ref_key: ref, title: title || detail, meta: sev, evidenceIds: extractEvidenceIds(r) });
    }

    for (const q of questions ?? []) {
      const text = String(q ?? "").trim();
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "clarification", text });
      rows.push({ type: "clarification", ref_key: ref, title: text });
    }

    for (const s of outlineSections ?? []) {
      const title = String((s as any)?.title ?? "").trim();
      if (!title) continue;
      const ref = stableRefKey({ jobId, type: "outline", text: title });
      rows.push({ type: "outline", ref_key: ref, title });
    }

    return dedupeWorkBaseRows(rows);
  }, [factWorkRows, jobId, checklist, risks, questions, outlineSections]);

  const workByKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const w of workItems ?? []) {
      const k = `${String(w?.type ?? "")}:${String(w?.ref_key ?? "")}`;
      if (!k.includes(":")) continue;
      if (!m.has(k)) m.set(k, w);
    }
    return m;
  }, [workItems]);

  const workByKeyRef = useRef<Map<string, any>>(new Map());
  useEffect(() => {
    workByKeyRef.current = workByKey;
  }, [workByKey]);

  const filteredRows = useMemo(() => {
    const q = String(query ?? "").trim().toLowerCase();
    return (workBaseRows ?? []).filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      const key = `${r.type}:${r.ref_key}`;
      const w = workByKey.get(key);
      const st = canonicalizeWorkStatus(w?.status ?? r.defaultStatus ?? "todo");
      if (hideDone && isDoneWorkStatus(st)) return false;
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (q) {
        const hay = `${r.type} ${r.meta ?? ""} ${r.ref_key} ${r.title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [workBaseRows, workByKey, query, typeFilter, statusFilter, hideDone]);

  const groupedRows = useMemo(() => {
    const groups: Record<WorkItemType, WorkBaseRow[]> = {
      deadline: [],
      submission: [],
      requirement: [],
      risk: [],
      clarification: [],
      admin: [],
      outline: [],
    };
    for (const r of filteredRows) groups[r.type].push(r);
    return groups;
  }, [filteredRows]);

  async function refreshWork() {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase
      .from("job_work_items")
      .select("*")
      .eq("job_id", jobId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    setWorkItems((data as any[]) ?? []);
  }

  async function refreshWorkSafe() {
    try {
      await refreshWork();
    } catch (e) {
      console.warn("BidRoomPanel refreshWork failed", e);
    }
  }

  function isDuplicateKeyError(err: any) {
    const code = String(err?.code ?? "");
    const msg = String(err?.message ?? "");
    return code === "23505" || /duplicate key/i.test(msg);
  }

  async function doUpsertWorkItem(input: {
    type: WorkItemType;
    ref_key: string;
    title: string;
    status?: string;
    owner_label?: string | null;
    due_at?: string | null;
    notes?: string | null;
  }) {
    setWorkError(null);
    setWorkSaving(`${input.type}:${input.ref_key}`);

    const rowKey = `${input.type}:${input.ref_key}`;

    function upsertLocalRow(row: any) {
      if (!row) return;
      setWorkItems((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const next = [...cur];

        const id = row?.id;
        if (id) {
          const byId = next.findIndex((x) => x?.id === id);
          if (byId >= 0) {
            next[byId] = { ...next[byId], ...row };
            return next;
          }
        }

        const byKey = next.findIndex((x) => `${x?.type ?? ""}:${x?.ref_key ?? ""}` === rowKey);
        if (byKey >= 0) {
          next[byKey] = { ...next[byKey], ...row };
          return next;
        }

        next.unshift(row);
        return next;
      });
    }

    try {
      const supabase = supabaseBrowser();

      const existing = workByKeyRef.current.get(rowKey);
      const existingId = existing?.id ? String(existing.id) : "";
      const existingRawStatus = String(existing?.status ?? "").trim();

      const basePatch: any = { title: input.title };
      if (Object.prototype.hasOwnProperty.call(input, "owner_label")) basePatch.owner_label = input.owner_label;
      if (Object.prototype.hasOwnProperty.call(input, "due_at")) basePatch.due_at = input.due_at;
      if (Object.prototype.hasOwnProperty.call(input, "notes")) basePatch.notes = input.notes;

      const nextCanonicalStatus = Object.prototype.hasOwnProperty.call(input, "status")
        ? canonicalizeWorkStatus(input.status, "todo")
        : null;
      const statusCandidates = nextCanonicalStatus
        ? workStatusWriteCandidates(nextCanonicalStatus, existingRawStatus)
        : [null];

      const buildPatch = (statusCandidate: string | null) => {
        const patch: any = { ...basePatch };
        if (statusCandidate) patch.status = statusCandidate;
        return patch;
      };

      async function updateExistingById(id: string) {
        let lastError: any = null;
        for (const candidate of statusCandidates) {
          const patch = buildPatch(candidate);
          const { data, error } = await supabase
            .from("job_work_items")
            .update(patch)
            .eq("id", id)
            .select("*")
            .single();

          if (!error) {
            upsertLocalRow(data);
            return;
          }

          lastError = error;
          if (!(candidate && isWorkStatusRetryableError(error))) break;
        }
        throw lastError;
      }

      async function insertNewRow() {
        let lastError: any = null;
        for (const candidate of statusCandidates) {
          const row: any = {
            job_id: jobId,
            type: input.type,
            ref_key: input.ref_key,
            title: input.title,
            status: candidate ?? "todo",
            owner_label: Object.prototype.hasOwnProperty.call(input, "owner_label") ? input.owner_label : null,
            due_at: Object.prototype.hasOwnProperty.call(input, "due_at") ? input.due_at : null,
            notes: Object.prototype.hasOwnProperty.call(input, "notes") ? input.notes : null,
          };

          const { data, error } = await supabase.from("job_work_items").insert(row).select("*").single();

          if (!error) {
            upsertLocalRow(data);
            return;
          }

          if (isDuplicateKeyError(error)) {
            const { data: found, error: findErr } = await supabase
              .from("job_work_items")
              .select("*")
              .eq("job_id", jobId)
              .eq("type", input.type)
              .eq("ref_key", input.ref_key)
              .order("updated_at", { ascending: false })
              .limit(1);

            if (findErr) throw findErr;
            const latest = Array.isArray(found) && found.length ? (found[0] as any) : null;
            const latestId = latest?.id ? String(latest.id) : "";

            if (!latestId) throw error;

            await updateExistingById(latestId);
            return;
          }

          lastError = error;
          if (!(candidate && isWorkStatusRetryableError(error))) break;
        }
        throw lastError;
      }

      if (existingId) {
        await updateExistingById(existingId);
      } else {
        await insertNewRow();
      }
    } catch (e: any) {
      console.error("BidRoomPanel upsertWorkItem failed", e);
      setWorkError(t("app.bidroom.panel.saveFailed"));
      try { await refreshWorkSafe(); } catch { /* ignore */ }
    } finally {
      setWorkSaving(null);
    }
  }

  async function upsertWorkItem(input: {
    type: WorkItemType;
    ref_key: string;
    title: string;
    status?: string;
    owner_label?: string | null;
    due_at?: string | null;
    notes?: string | null;
  }) {
    const rowKey = `${input.type}:${input.ref_key}`;

    const prev = workWritePendingRef.current.get(rowKey) || {};
    const merged: any = { ...prev, type: input.type, ref_key: input.ref_key, title: input.title };
    if (Object.prototype.hasOwnProperty.call(input, "status")) merged.status = canonicalizeWorkStatus(input.status, "todo");
    if (Object.prototype.hasOwnProperty.call(input, "owner_label")) merged.owner_label = input.owner_label;
    if (Object.prototype.hasOwnProperty.call(input, "due_at")) merged.due_at = input.due_at;
    if (Object.prototype.hasOwnProperty.call(input, "notes")) merged.notes = input.notes;
    workWritePendingRef.current.set(rowKey, merged);

    if (workWriteInFlightRef.current.has(rowKey)) return;

    workWriteInFlightRef.current.add(rowKey);
    try {
      while (workWritePendingRef.current.has(rowKey)) {
        const next = workWritePendingRef.current.get(rowKey);
        workWritePendingRef.current.delete(rowKey);
        await doUpsertWorkItem(next);
      }
    } finally {
      workWriteInFlightRef.current.delete(rowKey);
    }
  }

  const doneCount = useMemo(() => {
    return workBaseRows.filter((r) => {
      const key = `${r.type}:${r.ref_key}`;
      const w = workByKey.get(key);
      const st = canonicalizeWorkStatus(w?.status ?? r.defaultStatus ?? "todo");
      return isDoneWorkStatus(st);
    }).length;
  }, [workBaseRows, workByKey]);
  const blockedCount = useMemo(() => {
    return workBaseRows.filter((r) => {
      const key = `${r.type}:${r.ref_key}`;
      const w = workByKey.get(key);
      const st = canonicalizeWorkStatus(w?.status ?? r.defaultStatus ?? "todo");
      return isBlockedWorkStatus(st);
    }).length;
  }, [workBaseRows, workByKey]);

  const header = props.showHeader !== false;
  const showExport = props.showExport !== false;

  return (
    <Card className={props.className ?? "rounded-2xl"}>
      <CardContent className="p-5 space-y-4">
        {header ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("app.bidroom.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("app.bidroom.panel.subtitle")}
              </p>
            </div>
            {showExport ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full sm:w-auto"
                  onClick={() => openPdfAt()}
                >
                  {t("app.bidroom.panel.openOriginalPdf")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full sm:w-auto"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/jobs/${jobId}/export/bid-pack`, { method: "GET" });
                      if (!res.ok) throw new Error(String(res.status));
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `TenderPilot_BidPack_${jobId}.xlsx`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch {
                      const msg = t("app.bidroom.panel.exportBidPackFailed");
                      setWorkError(msg);
                      props.onExportError?.(msg);
                    }
                  }}
                  disabled={!canDownload}
                >
                  {t("app.bidroom.panel.exportBidPack")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {header ? <Separator /> : null}

        {workError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{workError}</p>
          </div>
        ) : null}

        {factCards.length ? (
          <div className="rounded-2xl border bg-card/30 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t("app.bidroom.facts.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("app.bidroom.facts.subtitle")}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {factCards.map((fact) => (
                <div key={fact.key} className="rounded-2xl border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{fact.label}</p>
                    {fact.kind === "deadline" ? (
                      <Badge variant={fact.isExpired ? "destructive" : "outline"} className="rounded-full">{fact.note}</Badge>
                    ) : fact.kind === "decision" ? (
                      <Badge variant={fact.note === "Go" ? "default" : fact.note === "No-Go" ? "destructive" : "secondary"} className="rounded-full">{fact.note}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium leading-snug break-words">{fact.value}</p>
                  {fact.kind !== "deadline" && fact.kind !== "decision" && fact.note ? <p className="mt-2 text-xs text-muted-foreground">{fact.note}</p> : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {fact.kind === "portal" && tenderFacts?.portalUrl ? (
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => window.open(tenderFacts.portalUrl || "", "_blank", "noopener,noreferrer")}>
                        {t("app.bidroom.facts.actions.openPortal")}
                      </Button>
                    ) : fact.evidenceIds?.length ? (
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => showEvidenceByIds(fact.evidenceIds)}>
                        {t("app.bidroom.actions.openEvidence")}
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => openPdfAt()}>
                        {t("app.common.locateInPdf")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full">
            {t("app.bidroom.panel.stats.items", { count: workBaseRows.length })}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {t("app.bidroom.panel.stats.done", { count: doneCount })}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {t("app.bidroom.panel.stats.blocked", { count: blockedCount })}
          </Badge>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("app.bidroom.panel.searchPlaceholder")}
              className="h-9 w-full rounded-full sm:w-[240px]"
            />

            <select
              className="h-9 w-full rounded-full border bg-background px-3 text-xs sm:w-auto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">{t("app.bidroom.panel.filters.allTypes")}</option>
              <option value="deadline">{t("app.bidroom.types.deadline")}</option>
              <option value="submission">{t("app.bidroom.types.submission")}</option>
              <option value="requirement">{t("app.bidroom.types.requirement")}</option>
              <option value="risk">{t("app.bidroom.types.risk")}</option>
              <option value="clarification">{t("app.bidroom.types.clarification")}</option>
              <option value="admin">{t("app.bidroom.types.admin")}</option>
              <option value="outline">{t("app.bidroom.types.outline")}</option>
            </select>

            <select
              className="h-9 w-full rounded-full border bg-background px-3 text-xs sm:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">{t("app.bidroom.panel.filters.allStatus")}</option>
              <option value="todo">{t("app.bidroom.status.todo")}</option>
              <option value="doing">{t("app.bidroom.status.doing")}</option>
              <option value="blocked">{t("app.bidroom.status.blocked")}</option>
              <option value="done">{t("app.bidroom.status.done")}</option>
            </select>

            <Button
              type="button"
              variant={hideDone ? "secondary" : "outline"}
              size="sm"
              className="w-full rounded-full sm:w-auto"
              onClick={() => setHideDone((v) => !v)}
            >
              {hideDone ? t("app.bidroom.panel.hideDone.hiding") : t("app.bidroom.panel.hideDone.showing")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/30">
          <div className="flex flex-col gap-1 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-muted-foreground">{t("app.bidroom.panel.table.title")}</p>
            <p className="text-xs text-muted-foreground">{t("app.bidroom.panel.table.note")}</p>
          </div>

          <ScrollArea className="h-[65dvh] sm:h-[560px]">
            <div className="p-3 space-y-6">
              {filteredRows.length === 0 ? (
                <div className="rounded-2xl border bg-background p-6 text-center">
                  <p className="text-sm font-medium">{t("app.bidroom.panel.empty.title")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("app.bidroom.panel.empty.body")}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setQuery("")}>{t("app.bidroom.panel.empty.clearSearch")}</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setTypeFilter("all");
                        setStatusFilter("all");
                        setHideDone(false);
                      }}
                    >
                      {t("app.common.resetFilters")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {(
                [
                  { key: "deadline" as const, label: t("app.bidroom.panel.typeGroups.deadline") },
                  { key: "submission" as const, label: t("app.bidroom.panel.typeGroups.submission") },
                  { key: "requirement" as const, label: t("app.bidroom.panel.typeGroups.requirement") },
                  { key: "risk" as const, label: t("app.bidroom.panel.typeGroups.risk") },
                  { key: "clarification" as const, label: t("app.bidroom.panel.typeGroups.clarification") },
                  { key: "admin" as const, label: t("app.bidroom.panel.typeGroups.admin") },
                  { key: "outline" as const, label: t("app.bidroom.panel.typeGroups.outline") },
                ] as const
              ).map((g) => {
                const rows = groupedRows[g.key] ?? [];
                if (!rows.length) return null;
                return (
                  <div key={g.key} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                      <p className="text-xs text-muted-foreground">{rows.length}</p>
                    </div>

                    <div className="space-y-3">
                      {rows.map((r) => {
                        const key = `${r.type}:${r.ref_key}`;
                        const w = workByKey.get(key);
                        const status = canonicalizeWorkStatus(w?.status ?? r.defaultStatus ?? "todo");
                        const owner = String(w?.owner_label ?? "");
                        const due = w?.due_at ? String(w.due_at).slice(0, 10) : (r.defaultDueAt ? String(r.defaultDueAt).slice(0, 10) : "");
                        const notes = String(w?.notes ?? "");
                        const hasEvidence = Array.isArray(r.evidenceIds) && r.evidenceIds.length > 0;
                        const notesIsOpen = notesOpen.has(key) || Boolean(notes);

                        const typeBadge = (() => {
                          if (r.type === "deadline") return t("app.bidroom.panel.typeGroups.deadline");
                          if (r.type === "submission") return t("app.bidroom.panel.typeGroups.submission");
                          if (r.type === "requirement") return t("app.bidroom.panel.typeGroups.requirement");
                          if (r.type === "risk") return t("app.bidroom.panel.typeGroups.risk");
                          if (r.type === "clarification") return t("app.bidroom.panel.typeGroups.clarification");
                          if (r.type === "admin") return t("app.bidroom.panel.typeGroups.admin");
                          return t("app.bidroom.panel.typeGroups.outline");
                        })();

                        return (
                          <div key={key} className="rounded-2xl border bg-background p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                  <Badge variant="outline" className="rounded-full">{typeBadge}{r.meta ? ` • ${r.meta}` : ""}</Badge>
                                  <span className="text-[11px] text-muted-foreground">{r.ref_key}</span>
                                </div>
                                <button
                                  type="button"
                                  className="mt-2 block w-full text-left text-sm font-medium leading-snug text-foreground hover:underline"
                                  onClick={() => showEvidenceByIds(r.evidenceIds)}
                                  disabled={!hasEvidence && evidenceById.size === 0}
                                >
                                  <span className="line-clamp-2 break-words">{r.title}</span>
                                </button>
                              </div>

                              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full rounded-full sm:w-auto"
                                  onClick={() => showEvidenceByIds(r.evidenceIds)}
                                  disabled={!hasEvidence && evidenceById.size === 0}
                                >
                                  {t("app.bidroom.actions.openEvidence")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full rounded-full sm:w-auto"
                                  onClick={() => {
                                    const ids = Array.isArray(r.evidenceIds) ? r.evidenceIds : [];
                                    const first = ids.find((id) => evidenceById.has(id));
                                    const cand = first ? evidenceById.get(first) : null;
                                    openPdfAt({ page: cand?.page ?? null });
                                  }}
                                >
                                  {t("app.common.locateInPdf")}
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                              <Input
                                value={owner}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setWorkItems((prev) => {
                                    const next = [...prev];
                                    const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === key);
                                    if (idx >= 0) next[idx] = { ...next[idx], owner_label: v };
                                    else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status, owner_label: v });
                                    return next;
                                  });
                                }}
                                onBlur={async (e) => {
                                  await upsertWorkItem({
                                    type: r.type,
                                    ref_key: r.ref_key,
                                    title: r.title,
                                  owner_label: e.target.value || null,
                                  });
                                }}
                                placeholder={t("app.bidroom.fields.ownerPlaceholder")}
                                className="h-9 w-full rounded-full sm:w-[160px]"
                              />

                              <select
                                className="h-9 w-full rounded-full border bg-background px-3 text-xs sm:w-auto"
                                value={status}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setWorkItems((prev) => {
                                    const next = [...prev];
                                    const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === key);
                                    if (idx >= 0) next[idx] = { ...next[idx], status: v };
                                    else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status: v, owner_label: owner });
                                    return next;
                                  });
                                  void upsertWorkItem({
                                    type: r.type,
                                    ref_key: r.ref_key,
                                    title: r.title,
                                    status: v,
                                  });
                                }}
                              >
                                <option value="todo">{t("app.bidroom.status.todo")}</option>
                                <option value="doing">{t("app.bidroom.status.doing")}</option>
                                <option value="blocked">{t("app.bidroom.status.blocked")}</option>
                                <option value="done">{t("app.bidroom.status.done")}</option>
                              </select>

                              <Input
                                type="date"
                                value={due}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setWorkItems((prev) => {
                                    const next = [...prev];
                                    const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === key);
                                    if (idx >= 0) next[idx] = { ...next[idx], due_at: v || null };
                                    else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status, due_at: v || null });
                                    return next;
                                  });
                                }}
                                onBlur={async (e) => {
                                  await upsertWorkItem({
                                    type: r.type,
                                    ref_key: r.ref_key,
                                    title: r.title,
                                    due_at: e.target.value || null,
                                  });
                                }}
                                className="h-9 w-full rounded-full sm:w-[150px]"
                              />

                              {notesIsOpen ? (
                                <div className="col-span-2 sm:col-span-1 sm:flex-1 flex gap-2 w-full sm:min-w-[220px]">
                                  <Input
                                    value={notes}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setWorkItems((prev) => {
                                        const next = [...prev];
                                        const idx = next.findIndex((x) => `${x.type}:${x.ref_key}` === key);
                                        if (idx >= 0) next[idx] = { ...next[idx], notes: v };
                                        else next.unshift({ job_id: jobId, type: r.type, ref_key: r.ref_key, title: r.title, status, notes: v });
                                        return next;
                                      });
                                    }}
                                    onBlur={async (e) => {
                                      await upsertWorkItem({
                                        type: r.type,
                                        ref_key: r.ref_key,
                                        title: r.title,
                                        notes: e.target.value || null,
                                      });
                                    }}
                                    placeholder={t("app.bidroom.fields.notesPlaceholder")}
                                    className="h-9 w-full rounded-full"
                                  />
                                  {r.type === "clarification" && notes.trim() ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="rounded-full shrink-0 h-9 px-3"
                                      onClick={() => handleSaveToKb(key, r.title, notes)}
                                      disabled={savingKbIdx === key}
                                    >
                                      {savingKbIdx === key ? (t("app.common.saving") || "Saving...") : savedKbIdx[key] ? (t("app.common.saved") || "Saved!") : "Save for future bids"}
                                    </Button>
                                  ) : null}
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="col-span-2 w-full rounded-full sm:col-span-1 sm:w-auto"
                                  onClick={() =>
                                    setNotesOpen((prev) => {
                                      const next = new Set(prev);
                                      next.add(key);
                                      return next;
                                    })
                                  }
                                >
                                  {t("app.bidroom.actions.addNote")}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {evidenceOpen ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEvidenceOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-none bg-background shadow-2xl border-l sm:max-w-xl">
              <div className="flex items-start justify-between gap-3 p-5 border-b">
                <div>
                  <p className="text-sm font-semibold">{t("app.bidroom.evidence.title")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("app.bidroom.evidence.subtitle")}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEvidenceOpen(false)}>
                  {t("app.common.close")}
                </Button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-full">{t("app.bidroom.evidence.labels.id")}: {evidenceFocus?.id || "—"}</Badge>
                  {typeof evidenceFocus?.page === "number" ? (
                    <Badge variant="outline" className="rounded-full">{t("app.bidroom.evidence.labels.page")}: {evidenceFocus?.page}</Badge>
                  ) : null}
                  {evidenceFocus?.anchor ? (
                    <Badge variant="outline" className="rounded-full">{t("app.bidroom.evidence.labels.anchor")}: {evidenceFocus.anchor}</Badge>
                  ) : null}
                </div>

                {evidenceFocus?.note ? (
                  <div className="rounded-xl border bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">{evidenceFocus.note}</p>
                  </div>
                ) : null}

                <div className="rounded-2xl border bg-card/30 p-4">
                  {evidenceFocus?.excerpt ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{evidenceFocus.excerpt}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("app.bidroom.evidence.noExcerpt")}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-full sm:w-auto"
                    onClick={() => openPdfAt({ page: evidenceFocus?.page ?? null })}
                  >
                    {t("app.common.locateInPdf")}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full rounded-full sm:w-auto" onClick={() => openPdfAt()}>
                    {t("app.bidroom.panel.openOriginalPdf")}
                  </Button>
                </div>

                {evidenceFocus?.allIds?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t("app.bidroom.evidence.otherEvidenceIds")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {evidenceFocus.allIds.slice(0, 12).map((id) => (
                        <Button
                          key={id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => showEvidenceByIds([id])}
                        >
                          {id}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}