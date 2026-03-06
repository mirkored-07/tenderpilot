import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

import { supabaseRoute } from "@/lib/supabase/route";
import { stableRefKey } from "@/lib/bid-workflow/keys";
import { loadDict } from "@/lib/i18n/dict";
import { normalizeLocale } from "@/lib/i18n/locales";
import { tFromDict } from "@/lib/i18n/t";
import { canExportForProfile } from "@/lib/billing-entitlements";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function listToString(xs: any): string {
  if (!xs) return "";
  if (Array.isArray(xs)) return xs.map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");
  return String(xs ?? "").trim();
}

function normalizeChecklist(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.requirements)) return raw.requirements;
  return [];
}

function normalizeRisks(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.risks)) return raw.risks;
  return [];
}

function normalizeQuestions(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (Array.isArray(raw?.items)) return raw.items.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  if (Array.isArray(raw?.questions)) return raw.questions.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  return [];
}

type PolicyTriggerExport = {
  key: string;
  impact: string;
  note: string;
};

function normalizePolicyTriggers(raw: any): PolicyTriggerExport[] {
  if (!raw) return [];

  let v: any = raw;

  // Some environments store JSON as a string — tolerate it.
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      v = JSON.parse(s);
    } catch {
      return [];
    }
  }

  const arr: any[] = Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : [];

  return (Array.isArray(arr) ? arr : [])
    .map((t: any) => {
      const key = String(t?.key ?? t?.id ?? "").trim();
      const impact = String(t?.impact ?? t?.severity ?? t?.level ?? "").trim();
      const note = String(t?.note ?? t?.detail ?? t?.text ?? "").trim();
      return { key, impact, note } as PolicyTriggerExport;
    })
    .filter((t: PolicyTriggerExport) => Boolean(t.key || t.note));
}

function policyKeyLabel(key: string) {
  const k = String(key ?? "").trim();
  if (!k) return "Policy";

  const map: Record<string, string> = {
    industry_tags: "Industry fit",
    offerings_summary: "Offerings fit",
    delivery_geographies: "Delivery geographies",
    languages_supported: "Languages supported",
    delivery_modes: "Delivery modes",
    capacity_band: "Capacity / sizing",
    typical_lead_time_weeks: "Lead time",
    certifications: "Certifications",
    non_negotiables: "Non-negotiables",
  };

  const hit = map[k];
  if (hit) return hit;

  return k.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildOutlineItems(proposalDraft: any): Array<{ title: string; bullets?: string[] }> {
  if (!proposalDraft) return [];
  if (typeof proposalDraft === "object" && Array.isArray((proposalDraft as any).sections)) {
    return ((proposalDraft as any).sections as any[])
      .map((s) => ({
        title: String(s?.title ?? "").trim(),
        bullets: Array.isArray(s?.bullets) ? (s.bullets as any[]).map((b) => String(b ?? "").trim()).filter(Boolean) : [],
      }))
      .filter((s) => s.title);
  }
  return [];
}

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await ctx.params;
  const supabase = supabaseRoute(req);

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Export gating: free tier requires at least 1 remaining credit.
  // Server-side enforced so UI cannot bypass.
  const admin = supabaseAdmin();
  let profileRow: any = null;
  try {
    const res = await admin
      .from("profiles")
      .select("credits_balance,plan_tier,locale")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (res.error) throw res.error;
    profileRow = res.data as any;
  } catch (e) {
    // If locale column does not exist yet, keep export path working.
    const res = await admin
      .from("profiles")
      .select("credits_balance,plan_tier")
      .eq("id", userRes.user.id)
      .maybeSingle();
    profileRow = res.data as any;
    if (res.error) {
      console.warn("Failed to read credits_balance for export gate", res.error);
    }
  }

  if (!canExportForProfile(profileRow)) {
    return NextResponse.json({ error: "no_export_entitlement" }, { status: 402 });
  }

  const locale = normalizeLocale(profileRow?.locale);
  const [dict, fallback] = await Promise.all([loadDict(locale), loadDict("en")]);
  const tt = (key: string, vars?: Record<string, string | number>) => tFromDict({ dict, fallbackDict: fallback, key, vars });
  const H = (k: string) => tt(`app.exports.headers.${k}`);

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id,file_name,created_at,status,pipeline")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const { data: result, error: resErr } = await supabase
    .from("job_results")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (resErr || !result) {
    return NextResponse.json({ error: "result_not_found" }, { status: 404 });
  }

  const { data: workItems } = await supabase
    .from("job_work_items")
    .select("job_id,type,ref_key,owner_label,status,due_at,notes,updated_at")
    .eq("job_id", jobId);

  const workByKey = new Map<string, any>();
  for (const w of workItems ?? []) {
    workByKey.set(`${w.type}:${w.ref_key}`, w);
  }

  const evidenceCandidates: any[] = Array.isArray((job as any)?.pipeline?.evidence?.candidates)
    ? ((job as any).pipeline.evidence.candidates as any[])
    : [];
  const evidenceById = new Map<string, any>();
  for (const e of evidenceCandidates) {
    const id = String(e?.id ?? "").trim();
    if (id) evidenceById.set(id, e);
  }

  const exec = (result as any)?.executive_summary ?? {};
  const checklist = normalizeChecklist((result as any)?.checklist);
  const risks = normalizeRisks((result as any)?.risks);
  const clarifications = normalizeQuestions((result as any)?.clarifications ?? (result as any)?.buyer_questions);
  const outline = buildOutlineItems((result as any)?.proposal_draft);

  const playbookVersion = (result as any)?.playbook_version ?? null;
  const policyTriggers = normalizePolicyTriggers((result as any)?.policy_triggers);

  const wb = new ExcelJS.Workbook();
  wb.creator = "TenderPilot";
  wb.created = new Date();

  // ---- 00_Overview ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.overview"));
    ws.columns = [
      { header: H("field"), key: "field", width: 28 },
      { header: H("value"), key: "value", width: 90 },
    ];
    const decisionBadge = String(exec?.decisionBadge ?? "").trim();
    const decisionLine = String(exec?.decisionLine ?? "").trim();
    const deadline = String(exec?.submissionDeadline ?? "").trim();

    ws.addRow({ field: tt("app.exports.overview.tender"), value: String((job as any)?.file_name ?? "").trim() });
    ws.addRow({ field: tt("app.exports.overview.created"), value: String((job as any)?.created_at ?? "").trim() });
    ws.addRow({ field: tt("app.exports.overview.status"), value: String((job as any)?.status ?? "").trim() });
    ws.addRow({ field: tt("app.exports.overview.decision"), value: decisionBadge });
    ws.addRow({ field: tt("app.exports.overview.why"), value: decisionLine });
    ws.addRow({ field: tt("app.exports.overview.deadline"), value: deadline });
    ws.addRow({ field: tt("app.exports.overview.notes"), value: tt("app.exports.overview.notesBody") });
  }

  // ---- 01_Blockers ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.blockers"));
    ws.columns = [
      { header: H("ref_key"), key: "ref_key", width: 22 },
      { header: H("requirement"), key: "requirement", width: 90 },
      { header: H("owner"), key: "owner", width: 18 },
      { header: H("status"), key: "status", width: 14 },
      { header: H("due_at"), key: "due_at", width: 16 },
      { header: H("notes"), key: "notes", width: 40 },
      { header: H("evidence_ids"), key: "evidence_ids", width: 22 },
      { header: H("pages"), key: "pages", width: 10 },
    ];

    const musts = checklist.filter((i) => String(i?.type ?? i?.level ?? i?.priority ?? "").toUpperCase().includes("MUST"));
    for (const it of musts) {
      const text = String(it?.text ?? it?.requirement ?? "").trim();
      const ref = stableRefKey({ jobId, type: "requirement", text, extra: "MUST" });
      const w = workByKey.get(`requirement:${ref}`);
      const evIds = Array.isArray((it as any)?.evidence_ids) ? (it as any).evidence_ids : [];
      const pages = evIds
        .map((id: any) => evidenceById.get(String(id))?.page)
        .filter((p: any) => p !== null && p !== undefined)
        .map((p: any) => String(p));

      ws.addRow({
        ref_key: ref,
        requirement: text,
        owner: String(w?.owner_label ?? "").trim(),
        status: String(w?.status ?? "").trim(),
        due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
        notes: String(w?.notes ?? "").trim(),
        evidence_ids: listToString(evIds),
        pages: listToString(pages),
      });
    }
  }

  // ---- 02_Requirements ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.requirements"));
    ws.columns = [
      { header: H("ref_key"), key: "ref_key", width: 22 },
      { header: H("type"), key: "type", width: 10 },
      { header: H("requirement"), key: "requirement", width: 90 },
      { header: H("owner"), key: "owner", width: 18 },
      { header: H("status"), key: "status", width: 14 },
      { header: H("due_at"), key: "due_at", width: 16 },
      { header: H("notes"), key: "notes", width: 40 },
      { header: H("evidence_ids"), key: "evidence_ids", width: 22 },
      { header: H("pages"), key: "pages", width: 10 },
    ];

    for (const it of checklist) {
      const kind = String(it?.type ?? it?.level ?? it?.priority ?? "INFO").toUpperCase();
      const text = String(it?.text ?? it?.requirement ?? "").trim();
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "requirement", text, extra: kind });
      const w = workByKey.get(`requirement:${ref}`);
      const evIds = Array.isArray((it as any)?.evidence_ids) ? (it as any).evidence_ids : [];
      const pages = evIds
        .map((id: any) => evidenceById.get(String(id))?.page)
        .filter((p: any) => p !== null && p !== undefined)
        .map((p: any) => String(p));

      ws.addRow({
        ref_key: ref,
        type: kind,
        requirement: text,
        owner: String(w?.owner_label ?? "").trim(),
        status: String(w?.status ?? "").trim(),
        due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
        notes: String(w?.notes ?? "").trim(),
        evidence_ids: listToString(evIds),
        pages: listToString(pages),
      });
    }
  }

  // ---- 03_Risks ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.risks"));
    ws.columns = [
      { header: H("ref_key"), key: "ref_key", width: 22 },
      { header: H("severity"), key: "severity", width: 10 },
      { header: H("risk"), key: "risk", width: 55 },
      { header: H("detail"), key: "detail", width: 70 },
      { header: H("owner"), key: "owner", width: 18 },
      { header: H("status"), key: "status", width: 14 },
      { header: H("due_at"), key: "due_at", width: 16 },
      { header: H("notes"), key: "notes", width: 40 },
      { header: H("evidence_ids"), key: "evidence_ids", width: 22 },
      { header: H("pages"), key: "pages", width: 10 },
    ];

    for (const r of risks) {
      const title = String(r?.title ?? r?.text ?? r?.risk ?? "").trim();
      const detail = String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim();
      const sev = String(r?.severity ?? r?.level ?? "medium").toLowerCase();
      if (!title && !detail) continue;
      const ref = stableRefKey({ jobId, type: "risk", text: title || detail, extra: sev });
      const w = workByKey.get(`risk:${ref}`);
      const evIds = Array.isArray((r as any)?.evidence_ids) ? (r as any).evidence_ids : [];
      const pages = evIds
        .map((id: any) => evidenceById.get(String(id))?.page)
        .filter((p: any) => p !== null && p !== undefined)
        .map((p: any) => String(p));

      ws.addRow({
        ref_key: ref,
        severity: sev,
        risk: title,
        detail,
        owner: String(w?.owner_label ?? "").trim(),
        status: String(w?.status ?? "").trim(),
        due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
        notes: String(w?.notes ?? "").trim(),
        evidence_ids: listToString(evIds),
        pages: listToString(pages),
      });
    }
  }

  // ---- 04_Clarifications ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.clarifications"));
    ws.columns = [
      { header: H("ref_key"), key: "ref_key", width: 22 },
      { header: H("question"), key: "question", width: 90 },
      { header: H("owner"), key: "owner", width: 18 },
      { header: H("status"), key: "status", width: 14 },
      { header: H("due_at"), key: "due_at", width: 16 },
      { header: H("notes"), key: "notes", width: 40 },
      { header: H("evidence_ids"), key: "evidence_ids", width: 22 },
      { header: H("pages"), key: "pages", width: 10 },
    ];

    for (const q of clarifications) {
      const text = String(q ?? "").trim();
      if (!text) continue;
      const ref = stableRefKey({ jobId, type: "clarification", text });
      const w = workByKey.get(`clarification:${ref}`);
      ws.addRow({
        ref_key: ref,
        question: text,
        owner: String(w?.owner_label ?? "").trim(),
        status: String(w?.status ?? "").trim(),
        due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
        notes: String(w?.notes ?? "").trim(),
        evidence_ids: "",
        pages: "",
      });
    }
  }

  // ---- 05_Outline ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.outline"));
    ws.columns = [
      { header: H("ref_key"), key: "ref_key", width: 22 },
      { header: H("section"), key: "section", width: 60 },
      { header: H("bullets"), key: "bullets", width: 90 },
      { header: H("owner"), key: "owner", width: 18 },
      { header: H("status"), key: "status", width: 14 },
      { header: H("due_at"), key: "due_at", width: 16 },
      { header: H("notes"), key: "notes", width: 40 },
    ];

    for (const s of outline) {
      const ref = stableRefKey({ jobId, type: "outline", text: s.title });
      const w = workByKey.get(`outline:${ref}`);
      ws.addRow({
        ref_key: ref,
        section: s.title,
        bullets: (s.bullets ?? []).join("\n"),
        owner: String(w?.owner_label ?? "").trim(),
        status: String(w?.status ?? "").trim(),
        due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
        notes: String(w?.notes ?? "").trim(),
      });
    }
  }



  // ---- Policy Triggers ----
  if ((policyTriggers ?? []).length) {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.policyTriggers"));
    ws.columns = [
      { header: H("trigger_id"), key: "trigger_id", width: 20 },
      { header: H("impact"), key: "impact", width: 16 },
      { header: H("title"), key: "title", width: 32 },
      { header: H("detail"), key: "detail", width: 90 },
      { header: H("playbook_version"), key: "playbook_version", width: 16 },
    ];

    for (const t of policyTriggers) {
      ws.addRow({
        trigger_id: String(t.key ?? "").trim(),
        impact: String(t.impact ?? "").trim(),
        title: policyKeyLabel(String(t.key ?? "").trim()),
        detail: String(t.note ?? "").trim(),
        playbook_version: playbookVersion != null ? String(playbookVersion).trim() : "",
      });
    }
  }

  // ---- 99_EvidenceIndex ----
  {
    const ws = wb.addWorksheet(tt("app.exports.bidPack.sheets.evidenceIndex"));
    ws.columns = [
      { header: H("evidence_id"), key: "evidence_id", width: 14 },
      { header: H("page"), key: "page", width: 8 },
      { header: H("anchor"), key: "anchor", width: 22 },
      { header: H("kind"), key: "kind", width: 12 },
      { header: H("excerpt"), key: "excerpt", width: 120 },
    ];
    for (const e of evidenceCandidates) {
      const id = String(e?.id ?? "").trim();
      if (!id) continue;
      ws.addRow({
        evidence_id: id,
        page: e?.page ?? "",
        anchor: String(e?.anchor ?? "").trim(),
        kind: String(e?.kind ?? "").trim(),
        excerpt: String(e?.excerpt ?? "").trim(),
      });
    }
  }

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const fileNameSafe = String((job as any)?.file_name ?? "tender")
    .replace(/[\\/:*?\"<>|]+/g, "_")
    .slice(0, 80);

  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="TenderPilot_BidPack_${fileNameSafe}_${jobId}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
