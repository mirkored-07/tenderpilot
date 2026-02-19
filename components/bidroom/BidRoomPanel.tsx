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

type WorkBaseRow = { type: WorkItemType; ref_key: string; title: string; meta?: string };

export function BidRoomPanel(props: {
  jobId: string;
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
      rows.push({ type: "requirement", ref_key: ref, title: text, meta: kind });
    }

    for (const r of risks ?? []) {
      const title = String((r as any)?.title ?? (r as any)?.text ?? (r as any)?.risk ?? "").trim();
      const detail = String((r as any)?.detail ?? (r as any)?.description ?? (r as any)?.why ?? (r as any)?.impact ?? "").trim();
      const sev = String((r as any)?.severity ?? (r as any)?.level ?? "medium").toLowerCase();
      const text = title || detail;
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "risk", text, extra: sev });
      rows.push({ type: "risk", ref_key: ref, title: title || detail, meta: sev });
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
    status?: string;
    owner_label?: string;
    due_at?: string | null;
    notes?: string;
  }) {
    setWorkError(null);
    setWorkSaving(`${input.type}:${input.ref_key}`);

    try {
      const supabase = supabaseBrowser();
      const payload: any = {
        job_id: jobId,
        type: input.type,
        ref_key: input.ref_key,
        title: input.title,
        status: input.status ?? "todo",
        owner_label: input.owner_label ?? null,
        due_at: input.due_at ? input.due_at : null,
        notes: input.notes ?? null,
      };

      const { error } = await supabase.from("job_work_items").upsert(payload, { onConflict: "job_id,type,ref_key" });
      if (error) throw error;
      await refreshWork();
    } catch (e) {
      console.error(e);
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
              <p className="text-sm font-semibold">Bid room</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assign owners, track status, and leave short notes. This overlays the evidence-first results (it does not change them).
              </p>
            </div>
            {showExport ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
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

        <div className="rounded-xl border bg-background/60">
          <div className="grid grid-cols-12 gap-2 border-b bg-background/60 p-2 text-[11px] font-medium text-muted-foreground">
            <div className="col-span-2">Type</div>
            <div className="col-span-5">Item</div>
            <div className="col-span-2">Owner</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Due</div>
            <div className="col-span-1">Notes</div>
          </div>

          <ScrollArea className="h-[520px]">
            <div className="divide-y">
              {workBaseRows.map((r) => {
                const key = `${r.type}:${r.ref_key}`;
                const w = workByKey.get(key);
                const status = String(w?.status ?? "todo");
                const owner = String(w?.owner_label ?? "");
                const due = w?.due_at ? String(w.due_at).slice(0, 10) : "";
                const notes = String(w?.notes ?? "");

                return (
                  <div key={key} className="grid grid-cols-12 gap-2 p-2 text-sm">
                    <div className="col-span-2">
                      <p className="text-xs font-medium">
                        {r.type}
                        {r.meta ? <span className="text-muted-foreground"> • {r.meta}</span> : null}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{r.ref_key}</p>
                    </div>

                    <div className="col-span-5 min-w-0">
                      <p className="text-sm text-foreground/90 break-words">{r.title}</p>
                    </div>

                    <div className="col-span-2">
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
                            status,
                            owner_label: e.target.value,
                            due_at: due || null,
                            notes,
                          });
                        }}
                        placeholder="Owner"
                        className="h-8"
                        disabled={workSaving === key}
                      />
                    </div>

                    <div className="col-span-1">
                      <select
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
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
                            owner_label: owner,
                            due_at: due || null,
                            notes,
                          });
                        }}
                        disabled={workSaving === key}
                      >
                        <option value="todo">todo</option>
                        <option value="doing">doing</option>
                        <option value="blocked">blocked</option>
                        <option value="done">done</option>
                      </select>
                    </div>

                    <div className="col-span-1">
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
                            status,
                            owner_label: owner,
                            due_at: e.target.value || null,
                            notes,
                          });
                        }}
                        className="h-8"
                        disabled={workSaving === key}
                      />
                    </div>

                    <div className="col-span-1">
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
                            status,
                            owner_label: owner,
                            due_at: due || null,
                            notes: e.target.value,
                          });
                        }}
                        placeholder="Notes"
                        className="h-8"
                        disabled={workSaving === key}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
