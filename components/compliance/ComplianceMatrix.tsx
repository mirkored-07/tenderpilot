"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { stableRefKey } from "@/lib/bid-workflow/keys";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileText, MoreHorizontal, X } from "lucide-react";

type ReqType = "MUST" | "SHOULD" | "INFO";

type ComplianceStatus = "tbd" | "compliant" | "partial" | "noncompliant" | "na";

type NormalizedReq = {
  kind: ReqType;
  text: string;
  evidenceIds: string[];
  base_ref_key: string; // aligns with Bid room requirement key
  cm_ref_key: string; // stored overlay key for compliance
};

const CM_PREFIX = "cm__";

function pickFirstString(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeType(raw: any): ReqType {
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("must") || v.includes("mandatory") || v.includes("shall") || v.includes("required")) return "MUST";
  if (v.includes("should") || v.includes("recommended") || v.includes("nice")) return "SHOULD";
  return "INFO";
}

function kindBadge(kind: ReqType) {
  if (kind === "MUST") return <Badge className="rounded-full">MUST</Badge>;
  if (kind === "SHOULD") return <Badge variant="secondary" className="rounded-full">SHOULD</Badge>;
  return <Badge variant="outline" className="rounded-full">Info</Badge>;
}

function parseJsonNotes(raw: any): any {
  const s = String(raw ?? "").trim();
  if (!s) return {};
  try {
    const o = JSON.parse(s);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function stringifyJsonNotes(obj: any) {
  try {
    return JSON.stringify(obj ?? {});
  } catch {
    return "{}";
  }
}

function statusLabel(s: ComplianceStatus) {
  if (s === "compliant") return "Compliant";
  if (s === "partial") return "Partial";
  if (s === "noncompliant") return "Non-compliant";
  if (s === "na") return "N/A";
  return "TBD";
}

function isGapStatus(s: ComplianceStatus) {
  return s === "tbd" || s === "partial" || s === "noncompliant";
}

function clampText(s: string, max = 240) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function csvEscape(val: any) {
  const s = String(val ?? "");
  const needsQuotes = /[\n\r",]/.test(s);
  const inner = s.replace(/"/g, '""');
  return needsQuotes ? `"${inner}"` : inner;
}

type EvidenceCandidate = {
  id: string;
  excerpt?: string;
  page?: number | null;
  anchor?: string | null;
  kind?: string;
  score?: number;
};

export function ComplianceMatrix(props: {
  jobId: string;
  checklist: any[];
  backHref?: string;
  workHref?: string;
}) {
  const { jobId, checklist, backHref, workHref } = props;

  const [cmItems, setCmItems] = useState<any[]>([]);
  const [workError, setWorkError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Job context (for evidence map + signed PDF link)
  const [jobFilePath, setJobFilePath] = useState<string>("");
  const [evidenceById, setEvidenceById] = useState<Map<string, EvidenceCandidate>>(new Map());
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const pdfUrlFetchedAtRef = useRef<number>(0);

  // UX controls
  const [viewMode, setViewMode] = useState<"GAPS" | "ALL">("GAPS");
  const [q, setQ] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | ReqType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ComplianceStatus>("ALL");

  // Evidence drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReq, setDrawerReq] = useState<NormalizedReq | null>(null);
  const [drawerEvidenceId, setDrawerEvidenceId] = useState<string>("");
  const [sendState, setSendState] = useState<Record<string, "idle" | "sending" | "sent" | "exists">>({});

  // Local toast (lightweight; avoids adding global Toaster plumbing)
  const [toast, setToast] = useState<null | { title: string; description?: string; action?: "OPEN_BID_ROOM" }>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function refreshWork() {
    const supabase = supabaseBrowser();
    // IMPORTANT: we store compliance overlays as job_work_items with type="requirement" and ref_key prefixed by cm__
    const { data, error } = await supabase
      .from("job_work_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("type", "requirement")
      .like("ref_key", `${CM_PREFIX}%`)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Failed to load compliance overlays", error);
      setWorkError("Compliance overlays could not be loaded.");
      setCmItems([]);
      return;
    }
    setCmItems((data as any[]) ?? []);
  }

  useEffect(() => {
    if (!jobId) return;
    setWorkError(null);
    refreshWork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    const supabase = supabaseBrowser();
    let cancelled = false;

    async function loadJobContext() {
      try {
        const { data, error } = await supabase.from("jobs").select("id,file_path,pipeline").eq("id", jobId).maybeSingle();
        if (cancelled) return;
        if (error || !data) return;
        setJobFilePath(String((data as any)?.file_path ?? "").trim());

        const candidatesRaw: any[] = Array.isArray((data as any)?.pipeline?.evidence?.candidates)
          ? ((data as any).pipeline.evidence.candidates as any[])
          : [];
        const map = new Map<string, EvidenceCandidate>();
        for (const e of candidatesRaw) {
          const id = String((e as any)?.id ?? "").trim();
          if (!id) continue;
          const pRaw = (e as any)?.page;
          const pNum = typeof pRaw === "number" ? pRaw : pRaw ? Number(pRaw) : undefined;
          const page = typeof pNum === "number" && Number.isFinite(pNum) ? pNum : undefined;

          map.set(id, {
            id,
            excerpt: String((e as any)?.excerpt ?? "").trim() || undefined,
            page,
            anchor: (e as any)?.anchor ? String((e as any).anchor) : undefined,
            kind: (e as any)?.kind ? String((e as any).kind) : undefined,
            score: typeof (e as any)?.score === "number" ? (e as any).score : undefined,
          });
        }
        setEvidenceById(map);
      } catch {
        // ignore
      }
    }

    loadJobContext();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function getPdfUrl() {
    const now = Date.now();
    // cache for ~10 minutes
    if (pdfUrl && now - pdfUrlFetchedAtRef.current < 10 * 60 * 1000) return pdfUrl;
    if (!jobFilePath) throw new Error("No PDF file is attached to this job.");

    const supabase = supabaseBrowser();
    const { data, error } = await supabase.storage.from("uploads").createSignedUrl(jobFilePath, 60 * 30);
    if (error || !data?.signedUrl) throw new Error("Could not open the PDF.");
    setPdfUrl(data.signedUrl);
    pdfUrlFetchedAtRef.current = now;
    return data.signedUrl;
  }

  async function openPdfAtEvidence(evidenceId?: string) {
    setWorkError(null);
    try {
      const base = await getPdfUrl();
      const ev = evidenceId ? evidenceById.get(String(evidenceId).trim()) : undefined;
      const page = ev?.page;
      const url = page ? `${base}#page=${page}` : base;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      const msg = String(e?.message ?? "").trim();
      setWorkError(msg || "Could not open the PDF.");
    }
  }

  function openEvidenceDrawer(req: NormalizedReq, evidenceId?: string) {
    setDrawerReq(req);
    setDrawerEvidenceId(String(evidenceId ?? req.evidenceIds?.[0] ?? "").trim());
    setDrawerOpen(true);
  }

  async function sendGapToBidRoom(req: NormalizedReq, cmStatus: ComplianceStatus, proposalSection: string, note: string) {
    const k = req.base_ref_key;
    setSendState((p) => ({ ...p, [k]: "sending" }));
    setWorkError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: existing, error: exErr } = await supabase
        .from("job_work_items")
        .select("job_id,type,ref_key")
        .eq("job_id", jobId)
        .eq("type", "requirement")
        .eq("ref_key", req.base_ref_key)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) {
        setSendState((p) => ({ ...p, [k]: "exists" }));
        setToast({
          title: "Already in Bid Room",
          description: "This requirement already exists as an execution item.",
          action: workHref ? "OPEN_BID_ROOM" : undefined,
        });
        return;
      }

      const payload: any = {
        job_id: jobId,
        type: "requirement",
        ref_key: req.base_ref_key,
        title: req.text,
        status: "todo",
        owner_label: null,
        due_at: null,
        notes: `From Compliance Matrix — Status: ${statusLabel(cmStatus)}${proposalSection ? ` • Proposal: ${proposalSection}` : ""}${note ? ` • Note: ${note}` : ""}`,
      };
      const { error } = await supabase.from("job_work_items").insert(payload);
      if (error) throw error;
      setSendState((p) => ({ ...p, [k]: "sent" }));
      setToast({
        title: "Sent to Bid Room",
        description: "Execution item created for this gap.",
        action: workHref ? "OPEN_BID_ROOM" : undefined,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e?.error_description ?? e?.details ?? "").trim();
      console.error(e);
      setWorkError(msg ? `Could not send to Bid Room: ${msg}` : "Could not send to Bid Room.");
      setSendState((p) => ({ ...p, [k]: "idle" }));
    }
  }

  const normalized: NormalizedReq[] = useMemo(() => {
    const arr = Array.isArray(checklist) ? checklist : [];
    return arr
      .map((it) => {
        const typeRaw =
          pickFirstString(it, ["type", "level", "priority", "classification", "category"]) ||
          String((it as any)?.severity ?? (it as any)?.importance ?? "");

        const textRaw =
          pickFirstString(it, ["text", "statement", "requirement", "item", "title", "summary", "description"]) ||
          (typeof it === "string" ? it : "");

        const idsRaw = (it as any)?.evidence_ids ?? (it as any)?.evidenceIds ?? (it as any)?.evidence ?? null;
        const evidenceIds = Array.isArray(idsRaw) ? idsRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];

        const kindFromRaw = String(typeRaw ?? "").trim();
        const kindCandidate = kindFromRaw ? String(kindFromRaw).toUpperCase() : "";
        const kind: ReqType =
          kindCandidate === "MUST" || kindCandidate === "SHOULD" || kindCandidate === "INFO"
            ? (kindCandidate as ReqType)
            : normalizeType(kindFromRaw);

        const text = String(textRaw ?? "").trim();
        if (!text) return null;

        const base_ref_key = stableRefKey({ jobId, type: "requirement", text, extra: kind });
        const cm_ref_key = `${CM_PREFIX}${base_ref_key}`;

        return { kind, text, evidenceIds, base_ref_key, cm_ref_key };
      })
      .filter(Boolean) as NormalizedReq[];
  }, [checklist, jobId]);

  const cmByRef = useMemo(() => {
    const map = new Map<string, any>();
    for (const w of cmItems ?? []) {
      const key = String((w as any)?.ref_key ?? "").trim();
      if (!key) continue;
      map.set(key, w);
    }
    return map;
  }, [cmItems]);

  const rowModel = useMemo(() => {
    return normalized.map((r) => {
      const w = cmByRef.get(r.cm_ref_key) ?? null;
      const j = parseJsonNotes(w?.notes);
      const complianceStatus: ComplianceStatus =
        (String(j?.complianceStatus ?? "tbd").toLowerCase() as ComplianceStatus) || "tbd";
      const proposalSection = String(j?.proposalSection ?? "");
      const note = String(j?.note ?? "");
      return { r, w, j, complianceStatus, proposalSection, note };
    });
  }, [normalized, cmByRef]);

  const summary = useMemo(() => {
    const out = {
      total: rowModel.length,
      gaps: 0,
      mustGaps: 0,
      mustTbd: 0,
      mustPartial: 0,
      mustNon: 0,
      tbd: 0,
      partial: 0,
      non: 0,
      compliant: 0,
      na: 0,
    };

    for (const x of rowModel) {
      const s = x.complianceStatus;
      if (s === "tbd") out.tbd += 1;
      else if (s === "partial") out.partial += 1;
      else if (s === "noncompliant") out.non += 1;
      else if (s === "compliant") out.compliant += 1;
      else if (s === "na") out.na += 1;
      if (isGapStatus(s)) out.gaps += 1;
      if (x.r.kind === "MUST" && isGapStatus(s)) {
        out.mustGaps += 1;
        if (s === "tbd") out.mustTbd += 1;
        if (s === "partial") out.mustPartial += 1;
        if (s === "noncompliant") out.mustNon += 1;
      }
    }
    return out;
  }, [rowModel]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rowModel.filter((x) => {
      if (viewMode === "GAPS" && !isGapStatus(x.complianceStatus)) return false;
      if (levelFilter !== "ALL" && x.r.kind !== levelFilter) return false;
      if (statusFilter !== "ALL" && x.complianceStatus !== statusFilter) return false;
      if (query) {
        const hay = `${x.r.text} ${x.proposalSection} ${x.note}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rowModel, q, levelFilter, statusFilter, viewMode]);

  function exportMatrixCsv() {
    const header = [
      "req_ref_key",
      "level",
      "requirement",
      "compliance_status",
      "proposal_section",
      "audit_note",
      "evidence_ids",
    ];
    const lines: string[] = [header.map(csvEscape).join(",")];
    for (const x of rowModel) {
      lines.push(
        [
          x.r.base_ref_key,
          x.r.kind,
          x.r.text,
          x.complianceStatus,
          x.proposalSection,
          x.note,
          (x.r.evidenceIds ?? []).join(";"),
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TenderRay_ComplianceMatrix_${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function upsertCompliance(input: {
    cm_ref_key: string;
    title: string;
    // Treat these as PATCH fields so we don't overwrite other values with stale state.
    complianceStatus?: ComplianceStatus;
    proposalSection?: string;
    note?: string;
  }) {
    setWorkError(null);
    setSavingKey(input.cm_ref_key);

    try {
      const supabase = supabaseBrowser();

      const { data: existing, error: exErr } = await supabase
        .from("job_work_items")
        .select("id,notes")
        .eq("job_id", jobId)
        .eq("type", "requirement")
        .eq("ref_key", input.cm_ref_key)
        .maybeSingle();
      if (exErr) throw exErr;

      // PATCH merge into JSON notes to avoid overwriting other fields.
      const current = parseJsonNotes((existing as any)?.notes);
      const next: any = { ...current };
      if (Object.prototype.hasOwnProperty.call(input, "complianceStatus")) next.complianceStatus = input.complianceStatus;
      if (Object.prototype.hasOwnProperty.call(input, "proposalSection")) next.proposalSection = input.proposalSection;
      if (Object.prototype.hasOwnProperty.call(input, "note")) next.note = input.note;

      if (!next.complianceStatus) next.complianceStatus = current?.complianceStatus ?? "tbd";
      if (typeof next.proposalSection !== "string") next.proposalSection = String(current?.proposalSection ?? "");
      if (typeof next.note !== "string") next.note = String(current?.note ?? "");

      // Keep compliance data isolated from Bid room by using cm__-prefixed ref_key.
      // Store compliance fields inside notes as JSON; keep status as "todo".
      const payload: any = {
        job_id: jobId,
        type: "requirement",
        ref_key: input.cm_ref_key,
        title: input.title,
        status: "todo",
        owner_label: null,
        due_at: null,
        notes: stringifyJsonNotes(next),
      };

      if (existing && (existing as any).id) {
        const { error } = await supabase
          .from("job_work_items")
          .update({ title: payload.title, notes: payload.notes })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("job_work_items").insert(payload);
        if (error) throw error;
      }

      await refreshWork();
    } catch (e: any) {
      // Surface a useful error instead of {} when possible
      const msg = String(e?.message ?? e?.error_description ?? e?.details ?? "").trim();
      console.error("ComplianceMatrix upsertCompliance failed", {
        type: typeof e,
        asString: String(e),
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        status: e?.status,
      });
      console.error("ComplianceMatrix upsertCompliance raw", e);
      setWorkError(msg ? `Could not save changes: ${msg}` : "Could not save changes.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Proposal coverage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit lens for requirements. Set compliance stance and map where each requirement is addressed in the proposal.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This is not task tracking. Use Bid Room for owners, due dates, and operational status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {workHref ? (
            <Button asChild className="rounded-full">
				  <Link href={workHref}>Open Bid Room</Link>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 w-9 rounded-full p-0" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportMatrixCsv();
                }}
              >
                <FileDown className="h-4 w-4" /> Export CSV
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  openPdfAtEvidence(undefined);
                }}
              >
                <FileText className="h-4 w-4" /> Open PDF
              </DropdownMenuItem>

              {backHref ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      window.location.href = backHref;
                    }}
                  >
                    Back to job
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {workError ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-sm">{workError}</CardContent>
        </Card>
      ) : null}

      {/* Coverage cockpit */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gate</p>
            <p className="mt-1 text-sm font-semibold">
              {summary.mustGaps === 0 ? "Submission-ready (MUST covered)" : `MUST gaps: ${summary.mustGaps}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">MUST TBD: {summary.mustTbd} • Partial: {summary.mustPartial} • Non-compliant: {summary.mustNon}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gaps</p>
            <p className="mt-1 text-sm font-semibold">{summary.gaps} / {summary.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">TBD: {summary.tbd} • Partial: {summary.partial} • Non-compliant: {summary.non}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Covered</p>
            <p className="mt-1 text-sm font-semibold">{summary.compliant + summary.na} / {summary.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Compliant: {summary.compliant} • N/A: {summary.na}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search requirement, proposal section, notes…"
                className="h-9"
              />

              <select
                className="h-9 rounded-md border bg-background px-2 text-xs"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as any)}
              >
                <option value="ALL">All levels</option>
                <option value="MUST">MUST</option>
                <option value="SHOULD">SHOULD</option>
                <option value="INFO">INFO</option>
              </select>

              <select
                className="h-9 rounded-md border bg-background px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All statuses</option>
                <option value="tbd">TBD</option>
                <option value="partial">Partial</option>
                <option value="noncompliant">Non-compliant</option>
                <option value="compliant">Compliant</option>
                <option value="na">N/A</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full">Rows: {filteredRows.length}</Badge>
                <Badge variant="outline" className="rounded-full">Evidence map: {evidenceById.size}</Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">View</span>
                <div className="flex items-center rounded-full border bg-background p-0.5">
                  <Button
                    type="button"
                    variant={viewMode === "GAPS" ? "default" : "ghost"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setViewMode("GAPS")}
                  >
                    Gaps
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "ALL" ? "default" : "ghost"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setViewMode("ALL")}
                  >
                    Full
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rows */}
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground">
            {viewMode === "GAPS" ? "Gaps queue" : "Full matrix"}
            <span className="ml-2 font-normal">• set stance, map proposal section, justify with evidence</span>
          </div>
          <Separator />

          {filteredRows.length ? (
            <div className="divide-y">
              {filteredRows.map((x) => {
                const r = x.r;
                const j = x.j;
                const complianceStatus = x.complianceStatus;
                const proposalSection = x.proposalSection;
                const note = x.note;
                const sendK = r.base_ref_key;
                const send = sendState[sendK] ?? "idle";
                const firstEv = (r.evidenceIds ?? [])[0];
                const evResolved = firstEv ? evidenceById.get(firstEv) : undefined;

                return (
                  <div key={r.cm_ref_key} className="px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {kindBadge(r.kind)}
                          <Badge variant="outline" className="rounded-full text-[11px] font-mono">{r.base_ref_key}</Badge>
                          {isGapStatus(complianceStatus) ? (
                            <Badge variant="secondary" className="rounded-full">Gap</Badge>
                          ) : (
                            <Badge variant="outline" className="rounded-full">Covered</Badge>
                          )}
                        </div>

                        <p className="mt-2 text-sm font-medium leading-snug text-foreground/90">{clampText(r.text, 280)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Evidence: {r.evidenceIds?.length ? `${r.evidenceIds.length} id(s)` : "—"}
                          {evResolved?.page ? <span className="ml-2">• PDF page {evResolved.page}</span> : null}
                        </p>
                      </div>

                      <div className="w-full lg:w-[420px]">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-5">
                            <label className="text-[11px] font-medium text-muted-foreground">Compliance stance</label>
                            <select
                              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
                              value={complianceStatus}
                              disabled={savingKey === r.cm_ref_key}
                              onChange={(e) => {
                                const v = e.target.value as ComplianceStatus;
                                // optimistic UI update
                                setCmItems((prev) => {
                                  const next = [...(prev ?? [])];
                                  const idx = next.findIndex((it) => String(it?.ref_key ?? "") === r.cm_ref_key);
                                  const merged = stringifyJsonNotes({ ...j, complianceStatus: v, proposalSection, note });
                                  if (idx >= 0) next[idx] = { ...next[idx], notes: merged };
                                  else next.unshift({ job_id: jobId, type: "requirement", ref_key: r.cm_ref_key, title: r.text, status: "todo", notes: merged });
                                  return next;
                                });
                              }}
                              onBlur={async (e) => {
                                await upsertCompliance({
                                  cm_ref_key: r.cm_ref_key,
                                  title: r.text,
                                  complianceStatus: e.currentTarget.value as ComplianceStatus,
                                });
                              }}
                            >
                              <option value="tbd">{statusLabel("tbd")}</option>
                              <option value="compliant">{statusLabel("compliant")}</option>
                              <option value="partial">{statusLabel("partial")}</option>
                              <option value="noncompliant">{statusLabel("noncompliant")}</option>
                              <option value="na">{statusLabel("na")}</option>
                            </select>
                          </div>

                          <div className="col-span-7">
                            <label className="text-[11px] font-medium text-muted-foreground">Proposal section</label>
                            <Input
                              value={proposalSection}
                              placeholder="e.g. 2.1 / Annex A"
                              className="mt-1 h-9"
                              disabled={savingKey === r.cm_ref_key}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCmItems((prev) => {
                                  const next = [...(prev ?? [])];
                                  const idx = next.findIndex((it) => String(it?.ref_key ?? "") === r.cm_ref_key);
                                  const merged = stringifyJsonNotes({ ...j, complianceStatus, proposalSection: v, note });
                                  if (idx >= 0) next[idx] = { ...next[idx], notes: merged };
                                  else next.unshift({ job_id: jobId, type: "requirement", ref_key: r.cm_ref_key, title: r.text, status: "todo", notes: merged });
                                  return next;
                                });
                              }}
                              onBlur={async (e) => {
                                await upsertCompliance({
                                  cm_ref_key: r.cm_ref_key,
                                  title: r.text,
                                  proposalSection: e.target.value,
                                });
                              }}
                            />
                          </div>

                          <div className="col-span-12">
                            <label className="text-[11px] font-medium text-muted-foreground">Audit note</label>
                            <Input
                              value={note}
                              placeholder="Why this stance (short, audit-friendly)"
                              className="mt-1 h-9"
                              disabled={savingKey === r.cm_ref_key}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCmItems((prev) => {
                                  const next = [...(prev ?? [])];
                                  const idx = next.findIndex((it) => String(it?.ref_key ?? "") === r.cm_ref_key);
                                  const merged = stringifyJsonNotes({ ...j, complianceStatus, proposalSection, note: v });
                                  if (idx >= 0) next[idx] = { ...next[idx], notes: merged };
                                  else next.unshift({ job_id: jobId, type: "requirement", ref_key: r.cm_ref_key, title: r.text, status: "todo", notes: merged });
                                  return next;
                                });
                              }}
                              onBlur={async (e) => {
                                await upsertCompliance({
                                  cm_ref_key: r.cm_ref_key,
                                  title: r.text,
                                  note: e.target.value,
                                });
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() => openEvidenceDrawer(r, firstEv)}
                              disabled={!r.evidenceIds?.length}
                            >
                              Evidence
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() => openPdfAtEvidence(firstEv)}
                            >
                              Locate in PDF
                            </Button>
                          </div>

                          {isGapStatus(complianceStatus) ? (
                            <Button
                              type="button"
                              className="h-8 rounded-full px-3 text-xs"
                              onClick={() => sendGapToBidRoom(r, complianceStatus, proposalSection, note)}
                              disabled={send === "sending"}
                            >
                              {send === "sending" ? "Sending…" : send === "sent" ? "Sent to Bid Room" : send === "exists" ? "Already in Bid Room" : "Send to Bid Room"}
                            </Button>
                          ) : (
                            <div className="text-[11px] text-muted-foreground">Covered — no task needed</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-10 text-sm text-muted-foreground">
              {rowModel.length ? "No rows match the current filters." : "No requirements extracted yet."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence drawer (authoritative excerpt) */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l bg-background shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <p className="text-sm font-semibold">Evidence & justification</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Excerpt is authoritative. Locate in PDF is best-effort.
                </p>
              </div>
              <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
            </div>

            <div className="p-4 space-y-3">
              {drawerReq ? (
                <>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {kindBadge(drawerReq.kind)}
                      <Badge variant="outline" className="rounded-full text-[11px] font-mono">{drawerReq.base_ref_key}</Badge>
                    </div>
                    <p className="text-sm font-medium leading-snug">{drawerReq.text}</p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Evidence ID</p>
                    {drawerReq.evidenceIds?.length ? (
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                        value={drawerEvidenceId}
                        onChange={(e) => setDrawerEvidenceId(e.target.value)}
                      >
                        {drawerReq.evidenceIds.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-muted-foreground">No evidence ids available.</p>
                    )}
                  </div>

                  {drawerEvidenceId ? (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">Authoritative excerpt</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => openPdfAtEvidence(drawerEvidenceId)}
                          >
                            Locate in PDF
                          </Button>
                        </div>

                        {(() => {
                          const ev = evidenceById.get(drawerEvidenceId);
                          if (!ev) {
                            return (
                              <Card className="rounded-2xl">
                                <CardContent className="p-4 text-sm text-muted-foreground">
                                  Evidence {drawerEvidenceId} was not found in the job evidence map.
                                </CardContent>
                              </Card>
                            );
                          }
                          return (
                            <Card className="rounded-2xl">
                              <CardContent className="p-4 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className="font-mono">{ev.id}</span>
                                  {typeof ev.page === "number" ? <span>• page {ev.page}</span> : null}
                                  {ev.anchor ? <span className="truncate">• {ev.anchor}</span> : null}
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{ev.excerpt || "(No excerpt stored)"}</p>
                              </CardContent>
                            </Card>
                          );
                        })()}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No requirement selected.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast: feedback after "Send to Bid Room" */}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)]">
          <div className="rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 rounded-full p-0"
                onClick={() => setToast(null)}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {toast.action === "OPEN_BID_ROOM" && workHref ? (
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => {
                    setToast(null);
                    window.location.href = workHref;
                  }}
                >
                  Open bid room
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
