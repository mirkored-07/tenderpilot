"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { stableRefKey } from "@/lib/bid-workflow/keys";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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

  async function upsertCompliance(input: {
    cm_ref_key: string;
    title: string;
    complianceStatus: ComplianceStatus;
    proposalSection: string;
    note: string;
  }) {
    setWorkError(null);
    setSavingKey(input.cm_ref_key);

    try {
      const supabase = supabaseBrowser();

      // Keep compliance data isolated from Bid room by using cm__-prefixed ref_key.
      // Store compliance fields inside notes as JSON; keep status as "todo" to avoid any DB constraints on status values.
      const payload: any = {
        job_id: jobId,
        type: "requirement",
        ref_key: input.cm_ref_key,
        title: input.title,
        status: "todo",
        owner_label: null,
        due_at: null,
        notes: stringifyJsonNotes({
          complianceStatus: input.complianceStatus,
          proposalSection: input.proposalSection,
          note: input.note,
        }),
      };

      const { error } = await supabase.from("job_work_items").upsert(payload, { onConflict: "job_id,type,ref_key" });
      if (error) throw error;

      await refreshWork();
    } catch (e: any) {
      // Surface a useful error instead of {} when possible
      const msg = String(e?.message ?? e?.error_description ?? e?.details ?? "").trim();
      console.error(e);
      setWorkError(msg ? `Could not save changes: ${msg}` : "Could not save changes.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Compliance matrix</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit lens for requirements only. Track compliance status and where each requirement is addressed in the proposal.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Evidence IDs come from AI extraction. Use the Job page to open authoritative excerpts (Locate in source is best-effort).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {workHref ? (
            <Button asChild variant="outline" className="rounded-full">
              <Link href={workHref}>Open bid room</Link>
            </Button>
          ) : null}
          {backHref ? (
            <Button asChild variant="outline" className="rounded-full">
              <Link href={backHref}>Back to job</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {workError ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-sm">{workError}</CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground">
            <div className="col-span-1">Level</div>
            <div className="col-span-5">Requirement</div>
            <div className="col-span-2">Compliance</div>
            <div className="col-span-2">Proposal section</div>
            <div className="col-span-2">Evidence IDs</div>
          </div>

          <Separator />

          {normalized.length ? (
            normalized.map((r) => {
              const w = cmByRef.get(r.cm_ref_key) ?? null;
              const j = parseJsonNotes(w?.notes);

              const complianceStatus: ComplianceStatus =
                (String(j?.complianceStatus ?? "tbd").toLowerCase() as ComplianceStatus) || "tbd";
              const proposalSection = String(j?.proposalSection ?? "");
              const note = String(j?.note ?? "");

              return (
                <div key={r.cm_ref_key} className="px-4 py-3">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-1 pt-0.5">{kindBadge(r.kind)}</div>

                    <div className="col-span-5">
                      <div className="text-sm leading-snug">{r.text}</div>
                      <div className="mt-1 text-xs text-muted-foreground">req: {r.base_ref_key}</div>
                    </div>

                    <div className="col-span-2">
                      <select
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                        value={complianceStatus}
                        disabled={savingKey === r.cm_ref_key}
                        onChange={(e) => {
                          const v = e.target.value as ComplianceStatus;
                          // optimistic UI update
                          setCmItems((prev) => {
                            const next = [...(prev ?? [])];
                            const idx = next.findIndex((x) => String(x?.ref_key ?? "") === r.cm_ref_key);
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
                            proposalSection,
                            note,
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

                    <div className="col-span-2">
                      <Input
                        value={proposalSection}
                        placeholder="e.g. 2.1 / Annex A"
                        className="h-8"
                        disabled={savingKey === r.cm_ref_key}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCmItems((prev) => {
                            const next = [...(prev ?? [])];
                            const idx = next.findIndex((x) => String(x?.ref_key ?? "") === r.cm_ref_key);
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
                            complianceStatus,
                            proposalSection: e.target.value,
                            note,
                          });
                        }}
                      />

                      <Input
                        value={note}
                        placeholder="Audit note"
                        className="h-8 mt-2"
                        disabled={savingKey === r.cm_ref_key}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCmItems((prev) => {
                            const next = [...(prev ?? [])];
                            const idx = next.findIndex((x) => String(x?.ref_key ?? "") === r.cm_ref_key);
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
                            complianceStatus,
                            proposalSection,
                            note: e.target.value,
                          });
                        }}
                      />
                    </div>

                    <div className="col-span-2">
                      {r.evidenceIds?.length ? (
                        <div className="text-xs">
                          <div className="font-mono break-words">{r.evidenceIds.join(", ")}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">Excerpt is authoritative on the Job page.</div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Separator />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-sm text-muted-foreground">No requirements extracted yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
