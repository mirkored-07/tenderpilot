"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ChecklistItem = {
  type?: "MUST" | "SHOULD" | "INFO";
  text?: string;
};

type RiskItem = {
  title?: string;
  detail?: string;
  severity?: string;
  text?: string; // allow UI-shaped risks too
};

type Props = {
  checklist: ChecklistItem[];
  risks: RiskItem[];
  extractedText: string; // kept for backward compatibility (not used here)
  onJumpToSource: (query: string) => void;

  // NEW (optional): explicit questions from DB (proposal_draft.buyer_questions)
  questions?: string[];
  tenderName?: string;

  /** OPTIONAL (UI-only): controlled selection state (single source of truth lives in the page) */
  selectedMap?: Record<number, false>;
  onToggleSelected?: (index: number) => void;
};

function normalizeStrArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (Array.isArray(raw?.items)) return raw.items.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  if (Array.isArray(raw?.questions)) return raw.questions.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  return [];
}

export default function BuyerQuestions({
  checklist,
  risks,
  onJumpToSource,
  questions: explicitQuestions,
  tenderName,
  selectedMap,
  onToggleSelected,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedLocal, setSelectedLocal] = useState<Record<number, false>>({});
  const [showDraft, setShowDraft] = useState(false);
  const [showExtracts, setShowExtracts] = useState(false);

  const selected = selectedMap ?? selectedLocal;

  const questions = useMemo(() => {
    // 1) Prefer explicit questions from DB (passed in by the page)
    const fromDb = normalizeStrArray(explicitQuestions);
    if (fromDb.length) {
      return fromDb.map((text) => {
        // Anchor heuristic: use the first meaningful chunk of the question
        const anchor = text
          .replace(/^please\s+/i, "")
          .replace(/^can you\s+/i, "")
          .replace(/\?+$/g, "")
          .trim()
          .slice(0, 90);

        return { text, anchor: anchor || text.slice(0, 90) };
      });
    }

    // 2) Fallback to derived questions (existing behavior)
    const q: { text: string; anchor: string }[] = [];

    (Array.isArray(checklist) ? checklist : [])
      .filter((c) => String(c?.type ?? "").toUpperCase() === "SHOULD")
      .forEach((c) => {
        const text = String(c?.text ?? "").trim();
        if (text) {
          q.push({
            text: `Can you clarify expectations regarding: "${text}"?`,
            anchor: text,
          });
        }
      });

    (Array.isArray(risks) ? risks : []).forEach((r) => {
      const title = String(r?.title ?? "").trim();
      const text = String(r?.text ?? "").trim(); // UI risk shape
      const anchor = title || text;
      const label = title || text;

      if (label) {
        q.push({
          text: `Can you clarify the following risk or ambiguity: "${label}"?`,
          anchor,
        });
      }
    });

    // de-dupe by full question
    const map = new Map<string, { text: string; anchor: string }>();
    for (const item of q) map.set(item.text, item);
    return Array.from(map.values());
  }, [checklist, risks, explicitQuestions]);

  function buildRawList(items: { text: string }[]) {
    return items.map((x) => x.text).join("\n");
  }

  function buildInternalNote(items: { text: string }[]) {
    const lines: string[] = [];
    lines.push(`Clarifications (${items.length})`);
    lines.push("");
    for (const q of items) lines.push(`- ${q.text}`);
    return lines.join("\n");
  }

  function buildEmailDraft(items: { text: string }[]) {
    const name = String(tenderName ?? "").trim() || "Tender";
    const subject = `Clarification questions – ${name}`;

    const lines: string[] = [];
    lines.push("Hello,");
    lines.push("");
    lines.push("We are preparing our tender response and would appreciate clarification on the points below.");
    lines.push("Thank you.");
    lines.push("");
    for (let i = 0; i < items.length; i++) {
      lines.push(`${i + 1}. ${items[i].text}`);
    }

    return { subject, body: lines.join("\n") };
  }

  async function safeCopyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  }

  const selectedItems = useMemo(() => {
    // Selection model: default is selected; map stores explicit removals (idx -> false).
    return questions.filter((_, idx) => selected[idx] !== false);
  }, [selected, questions]);

  const selectedCount = selectedItems.length;
  const totalCount = questions.length;

  const draftItems = useMemo(() => selectedItems, [selectedItems]);

  const emailDraft = useMemo(() => {
    if (!draftItems.length) return null;
    return buildEmailDraft(draftItems);
  }, [draftItems, tenderName]);

  const selectionHint = useMemo(() => {
    if (totalCount === 0) return "";
    if (selectedCount === totalCount) return `Includes: All questions (${totalCount}).`;
    if (selectedCount === 0) return "Includes: 0 questions (none selected).";
    return `Includes: ${selectedCount} selected question${selectedCount === 1 ? "" : "s"}.`;
  }, [selectedCount, totalCount]);

  const { pricingConstraints, complianceConstraints } = useMemo(() => {
    const pick = (s: unknown) => String(s ?? "").trim();
    const pool: string[] = [];

    // Use only existing extracted items (checklist + risks). No invention.
    (Array.isArray(checklist) ? checklist : []).forEach((c) => {
      const t = pick((c as any)?.text);
      if (t) pool.push(t);
    });
    (Array.isArray(risks) ? risks : []).forEach((r) => {
      const title = pick((r as any)?.title ?? (r as any)?.text);
      const detail = pick((r as any)?.detail);
      if (title) pool.push(title);
      if (detail) pool.push(detail);
    });

    const uniq = Array.from(new Set(pool)).slice(0, 300);

    const pricingKeys = [
      "price",
      "pricing",
      "cost",
      "budget",
      "estimated value",
      "financial",
      "commercial",
      "currency",
      "eur",
      "€",
      "vat",
      "tax",
      "payment",
      "invoice",
      "discount",
      "fixed price",
      "unit price",
      "hourly",
      "rate",
    ];

    const complianceKeys = [
      "mandatory",
      "must",
      "eligib",
      "qualification",
      "certificate",
      "certification",
      "iso",
      "gdpr",
      "data protection",
      "declaration",
      "subcontract",
      "sub-contractor",
      "submission",
      "portal",
      "deadline",
      "format",
      "signature",
      "audit",
      "compliance",
      "legal",
    ];

    const matchAny = (text: string, keys: string[]) => {
      const t = text.toLowerCase();
      return keys.some((k) => t.includes(k));
    };

    const pricing = uniq.filter((t) => matchAny(t, pricingKeys)).slice(0, 30);
    const compliance = uniq.filter((t) => matchAny(t, complianceKeys)).slice(0, 30);

    return {
      pricingConstraints: pricing,
      complianceConstraints: compliance,
    };
  }, [checklist, risks]);

  function formatExtract(title: string, items: string[]) {
    if (!items.length) return "";
    const lines: string[] = [];
    lines.push(title);
    lines.push("");
    for (const it of items) lines.push(`- ${it}`);
    return lines.join("\n");
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold">Clarifications</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Select questions to reduce ambiguity before you commit effort.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                Selected: {selectedCount} / {totalCount}
              </Badge>

              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  if (!emailDraft) return;
                  safeCopyText(`${emailDraft.subject}\n\n${emailDraft.body}\n`, "email_draft");
                }}
                disabled={!emailDraft}
              >
                {copied === "email_draft" ? "Copied" : "Copy email draft"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setShowDraft((v) => !v)}
                disabled={totalCount === 0}
              >
                {showDraft ? "Hide preview" : "Preview"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => safeCopyText(buildRawList(selectedItems), "selected")}
                disabled={selectedCount === 0}
              >
                {copied === "selected" ? "Copied" : "Copy selected"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => safeCopyText(buildRawList(questions), "all")}
                disabled={totalCount === 0}
              >
                {copied === "all" ? "Copied" : "Copy all"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  safeCopyText(buildInternalNote(selectedItems.length ? selectedItems : questions), "internal")
                }
                disabled={totalCount === 0}
              >
                {copied === "internal" ? "Copied" : "Copy internal note"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setShowExtracts((v) => !v)}
                disabled={pricingConstraints.length === 0 && complianceConstraints.length === 0}
              >
                {showExtracts ? "Hide quick extracts" : "Quick extracts"}
              </Button>
            </div>
          </div>

          {showExtracts ? (
            <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold">Quick extracts</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Based on existing extracted items only. If nothing is detected, buttons stay disabled.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={pricingConstraints.length === 0}
                  onClick={() => {
                    const txt = formatExtract("Pricing constraints", pricingConstraints);
                    if (!txt) return;
                    safeCopyText(txt, "pricing");
                  }}
                >
                  {copied === "pricing" ? "Copied" : "Copy pricing constraints"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={complianceConstraints.length === 0}
                  onClick={() => {
                    const txt = formatExtract("Compliance constraints", complianceConstraints);
                    if (!txt) return;
                    safeCopyText(txt, "compliance");
                  }}
                >
                  {copied === "compliance" ? "Copied" : "Copy compliance constraints"}
                </Button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Tip: paste these into the buyer email or your internal update when pricing/compliance gates are critical.
              </p>
            </div>
          ) : null}

          {showDraft ? (
            <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold">Email draft preview</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectionHint}
                  </p>
                </div>
              </div>

              {emailDraft ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold">Subject</p>
                    <p className="mt-1 text-sm">{emailDraft.subject}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold">Body</p>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                      {emailDraft.body}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border bg-background/60 p-3">
                  <p className="text-sm text-muted-foreground">Select one or more questions above to generate a buyer email draft.</p>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm font-medium">No clarifications suggested</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The document looks consistent based on the TenderPilot information.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <Card key={idx} className="rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={selected[idx] !== false}
                    onChange={() => {
                      if (onToggleSelected) {
                        onToggleSelected(idx);
                        return;
                      }
                      setSelectedLocal((prev) => {
                        const next: Record<number, false> = { ...prev };
                        if (next[idx] === false) {
                          delete (next as any)[idx];
                        } else {
                          (next as any)[idx] = false;
                        }
                        return next;
                      });
                    }}
                      aria-label="Select question"
                    />
                    <p className="min-w-0 text-sm leading-relaxed">{q.text}</p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => safeCopyText(q.text, `q_${idx}`)}
                    >
                      {copied === `q_${idx}` ? "Copied" : "Copy"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => onJumpToSource(q.anchor)}
                    >
                      Locate in source (best-effort)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
