"use client";

import { useEffect, useMemo, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { stableRefKey } from "@/lib/bid-workflow/keys";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type WorkItemType = "requirement" | "risk" | "clarification" | "outline";

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
};

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
  className?: string;
  showHeader?: boolean;
  showExport?: boolean;
  onExportError?: (msg: string) => void;
}) {
  const { jobId, checklist, risks, questions, outlineSections, canDownload } = props;

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

  async function openPdfAt(args?: { page?: number | null }) {
    setWorkError(null);
    const filePath = String(props.jobFilePath ?? "").trim();
    if (!filePath) {
      setWorkError("Original PDF is not available for this job.");
      return;
    }

    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.storage.from("uploads").createSignedUrl(filePath, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error("No signed URL");
      const p = typeof args?.page === "number" && Number.isFinite(args.page) ? Math.max(1, Math.floor(args.page)) : null;
      const url = p ? `${data.signedUrl}#page=${p}` : data.signedUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.warn(e);
      setWorkError("Could not open the original PDF.");
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
          "Evidence id not found in the pipeline evidence map. This can happen if the pipeline evidence was generated with a different version or was trimmed. Verify in the original PDF.",
        allIds: ids.length ? ids : null,
      });
    } else {
      setEvidenceFocus({
        id: "",
        excerpt: "",
        page: null,
        anchor: null,
        note: "No evidence id is available for this item. Verify in the original PDF.",
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
        setWorkError("Work items could not be loaded.");
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

  const workBaseRows: WorkBaseRow[] = useMemo(() => {
    const rows: WorkBaseRow[] = [];

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

    return rows;
  }, [jobId, checklist, risks, questions, outlineSections]);

  const workByKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const w of workItems ?? []) {
      const k = `${String(w?.type ?? "")}:${String(w?.ref_key ?? "")}`;
      if (k.includes(":")) m.set(k, w);
    }
    return m;
  }, [workItems]);

  const filteredRows = useMemo(() => {
    const q = String(query ?? "").trim().toLowerCase();
    return (workBaseRows ?? []).filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      const key = `${r.type}:${r.ref_key}`;
      const w = workByKey.get(key);
      const st = String(w?.status ?? "todo");
      if (hideDone && st === "done") return false;
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
      requirement: [],
      risk: [],
      clarification: [],
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

  async function upsertWorkItem(input: {
    type: WorkItemType;
    ref_key: string;
    title: string;
    // NOTE: treat optional fields as PATCH fields.
    // If a field is omitted, we must NOT overwrite the existing DB value.
    status?: string;
    owner_label?: string | null;
    due_at?: string | null;
    notes?: string | null;
  }) {
    setWorkError(null);
    setWorkSaving(`${input.type}:${input.ref_key}`);

    try {
      const supabase = supabaseBrowser();

      // Find existing row (do not rely on a specific unique constraint).
      const { data: existing, error: exErr } = await supabase
        .from("job_work_items")
        .select("id,status,owner_label,due_at,notes")
        .eq("job_id", jobId)
        .eq("type", input.type)
        .eq("ref_key", input.ref_key)
        .maybeSingle();
      if (exErr) throw exErr;

      if (existing && (existing as any).id) {
        // PATCH update: only write fields explicitly provided.
        const patch: any = { title: input.title };
        if (Object.prototype.hasOwnProperty.call(input, "status")) patch.status = input.status;
        if (Object.prototype.hasOwnProperty.call(input, "owner_label")) patch.owner_label = input.owner_label;
        if (Object.prototype.hasOwnProperty.call(input, "due_at")) patch.due_at = input.due_at;
        if (Object.prototype.hasOwnProperty.call(input, "notes")) patch.notes = input.notes;

        const { error } = await supabase.from("job_work_items").update(patch).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        // INSERT: apply defaults for omitted fields.
        const row: any = {
          job_id: jobId,
          type: input.type,
          ref_key: input.ref_key,
          title: input.title,
          status: Object.prototype.hasOwnProperty.call(input, "status") ? input.status : "todo",
          owner_label: Object.prototype.hasOwnProperty.call(input, "owner_label") ? input.owner_label : null,
          due_at: Object.prototype.hasOwnProperty.call(input, "due_at") ? input.due_at : null,
          notes: Object.prototype.hasOwnProperty.call(input, "notes") ? input.notes : null,
        };

        const { error } = await supabase.from("job_work_items").insert(row);
        if (error) throw error;
      }

      await refreshWork();
    } catch (e: any) {
      console.error("BidRoomPanel upsertWorkItem failed", {
        type: typeof e,
        asString: String(e),
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        status: e?.status,
      });
      console.error("BidRoomPanel upsertWorkItem raw", e);
      setWorkError("Could not save changes.");
    } finally {
      setWorkSaving(null);
    }
  }

  const doneCount = useMemo(() => workItems.filter((w) => String(w?.status ?? "") === "done").length, [workItems]);
  const blockedCount = useMemo(() => workItems.filter((w) => String(w?.status ?? "") === "blocked").length, [workItems]);

  const header = props.showHeader !== false;
  const showExport = props.showExport !== false;

  return (
    <Card className={props.className ?? "rounded-2xl"}>
      <CardContent className="p-5 space-y-4">
        {header ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
			  <p className="text-sm font-semibold">Bid Room</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assign owners, track status, and leave short notes. This overlays the evidence-first results (it does not change them).
              </p>
            </div>
            {showExport ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => openPdfAt()}
                >
                  Open original PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
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
                      const msg = "Could not export the Bid Pack.";
                      setWorkError(msg);
                      props.onExportError?.(msg);
                    }
                  }}
                  disabled={!canDownload}
                >
                  Export Bid Pack
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full">
            Items: {workBaseRows.length}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Done: {doneCount}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Blocked: {blockedCount}
          </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="h-9 w-[240px] rounded-full"
            />

            <select
              className="h-9 rounded-full border bg-background px-3 text-xs"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All types</option>
              <option value="requirement">Requirements</option>
              <option value="risk">Risks</option>
              <option value="clarification">Clarifications</option>
              <option value="outline">Outline</option>
            </select>

            <select
              className="h-9 rounded-full border bg-background px-3 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All status</option>
              <option value="todo">Todo</option>
              <option value="doing">Doing</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>

            <Button
              type="button"
              variant={hideDone ? "secondary" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setHideDone((v) => !v)}
            >
              {hideDone ? "Hiding done" : "Showing done"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/30">
          <div className="flex items-center justify-between gap-3 border-b p-3">
            <p className="text-xs font-semibold text-muted-foreground">Work items</p>
            <p className="text-xs text-muted-foreground">Operational overlay only. This does not change the AI decision.</p>
          </div>

          <ScrollArea className="h-[560px]">
            <div className="p-3 space-y-6">
              {filteredRows.length === 0 ? (
                <div className="rounded-2xl border bg-background p-6 text-center">
                  <p className="text-sm font-medium">No items match your filters.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try clearing filters or searching for a different keyword.</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setQuery("")}>Clear search</Button>
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
                      Reset filters
                    </Button>
                  </div>
                </div>
              ) : null}

              {(
                [
                  { key: "requirement" as const, label: "Requirements" },
                  { key: "risk" as const, label: "Risks" },
                  { key: "clarification" as const, label: "Clarifications" },
                  { key: "outline" as const, label: "Outline" },
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
                        const status = String(w?.status ?? "todo");
                        const owner = String(w?.owner_label ?? "");
                        const due = w?.due_at ? String(w.due_at).slice(0, 10) : "";
                        const notes = String(w?.notes ?? "");
                        const hasEvidence = Array.isArray(r.evidenceIds) && r.evidenceIds.length > 0;
                        const notesIsOpen = notesOpen.has(key) || Boolean(notes);

                        const typeBadge = (() => {
                          if (r.type === "requirement") return "Requirement";
                          if (r.type === "risk") return "Risk";
                          if (r.type === "clarification") return "Clarification";
                          return "Outline";
                        })();

                        return (
                          <div key={key} className="rounded-2xl border bg-background p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
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

                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() => showEvidenceByIds(r.evidenceIds)}
                                  disabled={!hasEvidence && evidenceById.size === 0}
                                >
                                  Open evidence
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() => {
                                    const ids = Array.isArray(r.evidenceIds) ? r.evidenceIds : [];
                                    const first = ids.find((id) => evidenceById.has(id));
                                    const cand = first ? evidenceById.get(first) : null;
                                    openPdfAt({ page: cand?.page ?? null });
                                  }}
                                >
                                  Locate in PDF
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
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
                                placeholder="Owner"
                                className="h-9 w-[160px] rounded-full"
                                disabled={workSaving === key}
                              />

                              <select
                                className="h-9 rounded-full border bg-background px-3 text-xs"
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
                                }}
                                onBlur={async (e) => {
                                  await upsertWorkItem({
                                    type: r.type,
                                    ref_key: r.ref_key,
                                    title: r.title,
                                    status: e.currentTarget.value,
                                  });
                                }}
                                disabled={workSaving === key}
                              >
                                <option value="todo">Todo</option>
                                <option value="doing">Doing</option>
                                <option value="blocked">Blocked</option>
                                <option value="done">Done</option>
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
                                className="h-9 w-[150px] rounded-full"
                                disabled={workSaving === key}
                              />

                              {notesIsOpen ? (
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
                                  placeholder="Notes (short, actionable)"
                                  className="h-9 flex-1 min-w-[220px] rounded-full"
                                  disabled={workSaving === key}
                                />
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() =>
                                    setNotesOpen((prev) => {
                                      const next = new Set(prev);
                                      next.add(key);
                                      return next;
                                    })
                                  }
                                >
                                  Add note
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
            <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-background shadow-2xl border-l">
              <div className="flex items-start justify-between gap-3 p-5 border-b">
                <div>
                  <p className="text-sm font-semibold">Evidence excerpt</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Excerpt is authoritative. “Locate in PDF” is best-effort.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEvidenceOpen(false)}>
                  Close
                </Button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-full">ID: {evidenceFocus?.id || "—"}</Badge>
                  {typeof evidenceFocus?.page === "number" ? (
                    <Badge variant="outline" className="rounded-full">Page: {evidenceFocus?.page}</Badge>
                  ) : null}
                  {evidenceFocus?.anchor ? (
                    <Badge variant="outline" className="rounded-full">Anchor: {evidenceFocus.anchor}</Badge>
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
                    <p className="text-sm text-muted-foreground">No excerpt text available for this evidence id.</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => openPdfAt({ page: evidenceFocus?.page ?? null })}
                  >
                    Locate in PDF (best-effort)
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => openPdfAt()}>
                    Open PDF
                  </Button>
                </div>

                {evidenceFocus?.allIds?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Other evidence ids</p>
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
