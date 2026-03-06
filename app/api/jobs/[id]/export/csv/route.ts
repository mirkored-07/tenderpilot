import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

function csvEscape(v: any) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

type CsvCol = { key: string; label: string };

function rowsToCsv(rows: Array<Record<string, any>>, cols: CsvCol[]) {
  const out: string[] = [];
  out.push(cols.map((c) => csvEscape(c.label)).join(","));
  for (const r of rows) {
    out.push(cols.map((c) => csvEscape((r as any)[c.key])).join(","));
  }
  return out.join("\n") + "\n";
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
  const url = new URL(req.url);
  const type = String(url.searchParams.get("type") ?? "").trim().toLowerCase();

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
  } catch {
    const res = await admin
      .from("profiles")
      .select("credits_balance,plan_tier")
      .eq("id", userRes.user.id)
      .maybeSingle();
    profileRow = res.data as any;
    if (res.error) console.warn("Failed to read credits_balance for export gate", res.error);
  }

  if (!canExportForProfile(profileRow)) {
    return NextResponse.json({ error: "no_export_entitlement" }, { status: 402 });
  }

  const locale = normalizeLocale(profileRow?.locale);
  const [dict, fallback] = await Promise.all([loadDict(locale), loadDict("en")]);
  const tt = (key: string, vars?: Record<string, string | number>) => tFromDict({ dict, fallbackDict: fallback, key, vars });
  const H = (k: string) => tt(`app.exports.headers.${k}`);

  const { data: job } = await supabase
    .from("jobs")
    .select("id,file_name,pipeline")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });

  const { data: result } = await supabase
    .from("job_results")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (!result) return NextResponse.json({ error: "result_not_found" }, { status: 404 });

  const { data: workItems } = await supabase
    .from("job_work_items")
    .select("job_id,type,ref_key,owner_label,status,due_at,notes")
    .eq("job_id", jobId);
  const workByKey = new Map<string, any>();
  for (const w of workItems ?? []) workByKey.set(`${w.type}:${w.ref_key}`, w);

  const evidenceCandidates: any[] = Array.isArray((job as any)?.pipeline?.evidence?.candidates)
    ? ((job as any).pipeline.evidence.candidates as any[])
    : [];
  const evidenceById = new Map<string, any>();
  for (const e of evidenceCandidates) {
    const id = String(e?.id ?? "").trim();
    if (id) evidenceById.set(id, e);
  }

  const checklist = normalizeChecklist((result as any)?.checklist);
  const risks = normalizeRisks((result as any)?.risks);
  const clarifications = normalizeQuestions((result as any)?.clarifications ?? (result as any)?.buyer_questions);
  const outline = buildOutlineItems((result as any)?.proposal_draft);
  const exec = (result as any)?.executive_summary ?? {};

  const baseName = String((job as any)?.file_name ?? "tender").replace(/[\\/:*?\"<>|]+/g, "_").slice(0, 60);

  if (type === "overview") {
    const cols: CsvCol[] = [
      { key: "field", label: H("field") },
      { key: "value", label: H("value") },
    ];
    const rows = [
      { field: tt("app.exports.overview.tender"), value: String((job as any)?.file_name ?? "") },
      { field: tt("app.exports.overview.decision"), value: String(exec?.decisionBadge ?? "") },
      { field: tt("app.exports.overview.why"), value: String(exec?.decisionLine ?? "") },
      { field: tt("app.exports.overview.deadline"), value: String(exec?.submissionDeadline ?? "") },
    ];
    const csv = rowsToCsv(rows, cols);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="TenderPilot_overview_${baseName}_${jobId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "requirements") {
    const cols: CsvCol[] = [
      { key: "ref_key", label: H("ref_key") },
      { key: "type", label: H("type") },
      { key: "requirement", label: H("requirement") },
      { key: "owner", label: H("owner") },
      { key: "status", label: H("status") },
      { key: "due_at", label: H("due_at") },
      { key: "notes", label: H("notes") },
      { key: "evidence_ids", label: H("evidence_ids") },
      { key: "pages", label: H("pages") },
    ];
    const rows = checklist
      .map((it) => {
        const kind = String(it?.type ?? it?.level ?? it?.priority ?? "INFO").toUpperCase();
        const text = String(it?.text ?? it?.requirement ?? "").trim();
        const ref = stableRefKey({ jobId, type: "requirement", text, extra: kind });
        const w = workByKey.get(`requirement:${ref}`);
        const evIds = Array.isArray((it as any)?.evidence_ids) ? (it as any).evidence_ids : [];
        const pages = evIds
          .map((id: any) => evidenceById.get(String(id))?.page)
          .filter((p: any) => p !== null && p !== undefined)
          .map((p: any) => String(p));
        return {
          ref_key: ref,
          type: kind,
          requirement: text,
          owner: String(w?.owner_label ?? ""),
          status: String(w?.status ?? ""),
          due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
          notes: String(w?.notes ?? ""),
          evidence_ids: listToString(evIds),
          pages: listToString(pages),
        };
      })
      .filter((r) => r.requirement);

    const csv = rowsToCsv(rows, cols);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="TenderPilot_requirements_${baseName}_${jobId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "risks") {
    const cols: CsvCol[] = [
      { key: "ref_key", label: H("ref_key") },
      { key: "severity", label: H("severity") },
      { key: "risk", label: H("risk") },
      { key: "detail", label: H("detail") },
      { key: "owner", label: H("owner") },
      { key: "status", label: H("status") },
      { key: "due_at", label: H("due_at") },
      { key: "notes", label: H("notes") },
      { key: "evidence_ids", label: H("evidence_ids") },
      { key: "pages", label: H("pages") },
    ];
    const rows = risks
      .map((r) => {
        const title = String(r?.title ?? r?.text ?? r?.risk ?? "").trim();
        const detail = String(r?.detail ?? r?.description ?? r?.why ?? r?.impact ?? "").trim();
        const sev = String(r?.severity ?? r?.level ?? "medium").toLowerCase();
        const ref = stableRefKey({ jobId, type: "risk", text: title || detail, extra: sev });
        const w = workByKey.get(`risk:${ref}`);
        const evIds = Array.isArray((r as any)?.evidence_ids) ? (r as any).evidence_ids : [];
        const pages = evIds
          .map((id: any) => evidenceById.get(String(id))?.page)
          .filter((p: any) => p !== null && p !== undefined)
          .map((p: any) => String(p));
        return {
          ref_key: ref,
          severity: sev,
          risk: title,
          detail,
          owner: String(w?.owner_label ?? ""),
          status: String(w?.status ?? ""),
          due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
          notes: String(w?.notes ?? ""),
          evidence_ids: listToString(evIds),
          pages: listToString(pages),
        };
      })
      .filter((r) => r.risk || r.detail);

    const csv = rowsToCsv(rows, cols);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="TenderPilot_risks_${baseName}_${jobId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "clarifications") {
    const cols: CsvCol[] = [
      { key: "ref_key", label: H("ref_key") },
      { key: "question", label: H("question") },
      { key: "owner", label: H("owner") },
      { key: "status", label: H("status") },
      { key: "due_at", label: H("due_at") },
      { key: "notes", label: H("notes") },
    ];
    const rows = clarifications
      .map((q) => {
        const text = String(q ?? "").trim();
        const ref = stableRefKey({ jobId, type: "clarification", text });
        const w = workByKey.get(`clarification:${ref}`);
        return {
          ref_key: ref,
          question: text,
          owner: String(w?.owner_label ?? ""),
          status: String(w?.status ?? ""),
          due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
          notes: String(w?.notes ?? ""),
        };
      })
      .filter((r) => r.question);

    const csv = rowsToCsv(rows, cols);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="TenderPilot_clarifications_${baseName}_${jobId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (type === "outline") {
    const cols: CsvCol[] = [
      { key: "ref_key", label: H("ref_key") },
      { key: "section", label: H("section") },
      { key: "bullets", label: H("bullets") },
      { key: "owner", label: H("owner") },
      { key: "status", label: H("status") },
      { key: "due_at", label: H("due_at") },
      { key: "notes", label: H("notes") },
    ];
    const rows = outline.map((s) => {
      const ref = stableRefKey({ jobId, type: "outline", text: s.title });
      const w = workByKey.get(`outline:${ref}`);
      return {
        ref_key: ref,
        section: s.title,
        bullets: (s.bullets ?? []).join(" | "),
        owner: String(w?.owner_label ?? ""),
        status: String(w?.status ?? ""),
        due_at: w?.due_at ? String(w.due_at).slice(0, 10) : "",
        notes: String(w?.notes ?? ""),
      };
    });

    const csv = rowsToCsv(rows, cols);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="TenderPilot_outline_${baseName}_${jobId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      error: "invalid_type",
      allowed: ["overview", "requirements", "risks", "clarifications", "outline"],
    },
    { status: 400 }
  );
}
