"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  checklist: any[];
  extractedText: string;
  onJumpToSource: (query: string) => void;
  onShowEvidence?: (evidenceIds: string[] | undefined, fallbackQuery: string) => void; // NEW (optional for backward compatibility)
  /** Optional list of evidence ids that are actually available in jobs.pipeline.evidence.candidates */
  knownEvidenceIds?: string[];

  /** Optional evidence map from jobs.pipeline.evidence.candidates keyed by evidence id */
  evidenceById?: Map<string, any>;
};


type NormalizedReq = {
  id: string;
  type: "MUST" | "SHOULD" | "INFO";
  text: string;
  evidenceIds: string[];
};

function pickFirstString(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeType(raw: any): "MUST" | "SHOULD" | "INFO" {
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("must") || v.includes("mandatory") || v.includes("shall") || v.includes("required")) return "MUST";
  if (v.includes("should") || v.includes("recommended") || v.includes("nice")) return "SHOULD";
  if (v.includes("info") || v.includes("note") || v.includes("context")) return "INFO";
  return "INFO";
}

function typeBadge(type: "MUST" | "SHOULD" | "INFO") {
  if (type === "MUST") return <Badge className="rounded-full">MUST</Badge>;
  if (type === "SHOULD") return <Badge variant="secondary" className="rounded-full">SHOULD</Badge>;
  return <Badge variant="outline" className="rounded-full">Info</Badge>;
}

/**
 * Fuzzy excerpt finder:
 * - exact match first
 * - then short contiguous needles
 * - then keyword window scoring
 * Also snaps snippet to word boundaries to avoid "uestions" style cuts.
 */
function findExcerpt(text: string, query: string) {
  const t = text ?? "";
  const q = (query ?? "").trim();
  if (!t || !q) return null;

  const hay = t.toLowerCase();

  function snapToWordBounds(start: number, end: number) {
    let s = Math.max(0, start);
    let e = Math.min(t.length, end);

    // move start left until whitespace or beginning
    while (s > 0 && !/\s/.test(t[s])) s -= 1;
    // move end right until whitespace or end
    while (e < t.length && !/\s/.test(t[e - 1])) e += 1;

    s = Math.max(0, s);
    e = Math.min(t.length, e);
    return { s, e };
  }

  function makeSnippet(centerIdx: number, needleLen: number) {
    const startRaw = Math.max(0, centerIdx - 200);
    const endRaw = Math.min(t.length, centerIdx + Math.max(needleLen, 40) + 260);
    const { s, e } = snapToWordBounds(startRaw, endRaw);
    return t.slice(s, e).replace(/\s+/g, " ").trim();
  }

  // 1) exact
  const exactIdx = hay.indexOf(q.toLowerCase());
  if (exactIdx >= 0) return makeSnippet(exactIdx, q.length);

  // 2) first 12 / 8 words
  const wordsAll = q.split(/\s+/).filter(Boolean);
  const needles = [
    wordsAll.slice(0, 12).join(" "),
    wordsAll.slice(0, 8).join(" "),
  ].filter(Boolean);

  for (const n of needles) {
    const idx = hay.indexOf(n.toLowerCase());
    if (idx >= 0) return makeSnippet(idx, n.length);
  }

  // 3) keyword window scoring
  const STOP = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","by","via",
    "is","are","be","as","at","from","that","this","these","those",
    "must","should","shall","will","may","can","not","only","all"
  ]);

  const tokens = wordsAll
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length >= 4 && !STOP.has(w));

  if (!tokens.length) return null;

  const uniq = Array.from(new Set(tokens)).slice(0, 12);

  const MAX_OCC_PER_TOKEN = 25;
  type Occ = { idx: number; token: string };
  const occs: Occ[] = [];

  for (const tok of uniq) {
    let start = 0;
    let found = 0;
    while (found < MAX_OCC_PER_TOKEN) {
      const i = hay.indexOf(tok, start);
      if (i < 0) break;
      occs.push({ idx: i, token: tok });
      found += 1;
      start = i + tok.length;
    }
  }

  if (!occs.length) return null;

  const WINDOW = 700;

  let best = { score: 0, center: occs[0].idx, tokenLen: occs[0].token.length };
  for (const o of occs) {
    const wStart = o.idx - WINDOW / 2;
    const wEnd = o.idx + WINDOW / 2;

    const tokensInWindow = new Set<string>();
    for (const other of occs) {
      if (other.idx >= wStart && other.idx <= wEnd) tokensInWindow.add(other.token);
    }

    const score = tokensInWindow.size;
    if (score > best.score) {
      best = { score, center: o.idx, tokenLen: o.token.length };
      if (best.score >= Math.min(6, uniq.length)) break;
    }
  }

  if (best.score < 2) return null;
  return makeSnippet(best.center, best.tokenLen);
}

export default function Checklist({ checklist, extractedText, onJumpToSource, onShowEvidence, knownEvidenceIds, evidenceById }: Props) {
  const [filter, setFilter] = useState<"ALL" | "MUST" | "SHOULD" | "INFO">("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [selectedEvidenceByItem, setSelectedEvidenceByItem] = useState<Record<string, string>>({});

  const knownEvidenceIdSet = useMemo(() => {
    const arr = Array.isArray(knownEvidenceIds) ? knownEvidenceIds : [];
    return new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean));
  }, [knownEvidenceIds]);

  const normalized: NormalizedReq[] = useMemo(() => {
    const arr = Array.isArray(checklist) ? checklist : [];
    return arr
      .map((it, idx) => {
        const typeRaw =
          pickFirstString(it, ["type", "level", "priority", "classification", "category"]) ||
          String(it?.severity ?? it?.importance ?? "");

        const textRaw =
          pickFirstString(it, ["text", "statement", "requirement", "item", "title", "summary", "description"]) ||
          (typeof it === "string" ? it : "");

        const idsRaw = (it as any)?.evidence_ids ?? (it as any)?.evidenceIds ?? (it as any)?.evidence ?? null;

        const evidenceIds = Array.isArray(idsRaw)
          ? idsRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean)
          : [];

        return {
          id: String(it?.id ?? it?.key ?? idx),
          type: normalizeType(typeRaw),
          text: String(textRaw ?? "").trim(),
          evidenceIds,
        };
      })
      .filter((x) => x.text.length > 0);
  }, [checklist]);

  function hasResolvedEvidence(ids: string[]) {
    if (!ids?.length) return false;
    for (const id of ids) {
      if (knownEvidenceIdSet.has(String(id ?? "").trim())) return true;
    }
    return false;
  }

  const counts = useMemo(() => {
    const must = normalized.filter((i) => i.type === "MUST").length;
    const should = normalized.filter((i) => i.type === "SHOULD").length;
    const info = normalized.filter((i) => i.type === "INFO").length;
    return { must, should, info };
  }, [normalized]);

  const allEmpty = counts.must === 0 && counts.should === 0 && counts.info === 0;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return normalized.filter((it) => {
      if (filter !== "ALL" && it.type !== filter) return false;
      if (!query) return true;
      return it.text.toLowerCase().includes(query);
    });
  }, [normalized, filter, q]);

  if (allEmpty) {
    return (
      <div className="space-y-4">
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-3">
            <div>
              <p className="text-sm font-semibold">Requirements</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We couldn’t extract structured requirements from this document.
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Some tenders describe requirements in tables or scanned sections. You can still verify by reviewing the source text.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button className="rounded-full" onClick={() => onJumpToSource("")}>
                Review source text
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold">Requirements</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with MUST items. Use source excerpts to verify wording.
              </p>
            </div>

            <div />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={filter === "ALL" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("ALL")}
              >
                All
              </Button>
              <Button
                type="button"
                variant={filter === "MUST" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("MUST")}
              >
                MUST <span className="ml-2 text-xs opacity-70">{counts.must}</span>
              </Button>
              <Button
                type="button"
                variant={filter === "SHOULD" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("SHOULD")}
              >
                SHOULD <span className="ml-2 text-xs opacity-70">{counts.should}</span>
              </Button>
              <Button
                type="button"
                variant={filter === "INFO" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("INFO")}
              >
                Info <span className="ml-2 text-xs opacity-70">{counts.info}</span>
              </Button>
            </div>

            <div className="min-w-[260px]">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search requirements…"
                className="rounded-2xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-3">
            <div>
              <p className="text-sm font-semibold">Nothing matches your filter</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different filter or search term.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setFilter("ALL");
                  setQ("");
                }}
              >
                Reset filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            const isOpen = open === it.id;

            // Evidence-first: pick the currently selected evidence id for this item (default: first),
            // then show its deterministic excerpt if it exists in the pipeline evidence map.
            const selectedEvidence = selectedEvidenceByItem[it.id] || it.evidenceIds?.[0] || "";
            const selectedCandidate =
              selectedEvidence && evidenceById ? evidenceById.get(String(selectedEvidence)) : null;

            const excerpt = isOpen
              ? String(selectedCandidate?.excerpt ?? "").trim() || findExcerpt(extractedText, it.text)
              : null;

            const resolved = hasResolvedEvidence(it.evidenceIds);
            const needsVerification = it.type === "MUST" && !resolved;

            const selectableEvidenceIds = Array.isArray(it.evidenceIds)
              ? it.evidenceIds.filter((id) => knownEvidenceIdSet.has(String(id ?? "").trim()))
              : [];

            return (
              <Card key={it.id} className="rounded-2xl">
                <CardContent className="p-5">
                  <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : it.id)} type="button">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {typeBadge(it.type)}
                          <span className="text-sm font-medium text-foreground">{it.type}</span>
                          {needsVerification ? (
                            <Badge variant="secondary" className="rounded-full">
                              Needs verification
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{it.text}</p>
                      </div>
                      <span className="text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="mt-4 space-y-3">
                      <Separator />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() =>
                            selectedEvidence && onShowEvidence
                              ? onShowEvidence([selectedEvidence], it.text)
                              : it.evidenceIds?.length && onShowEvidence
                                ? onShowEvidence(it.evidenceIds, it.text)
                                : onJumpToSource(it.text)
                          }
                        >
                          Open evidence
                        </Button>
                        <Button type="button" variant="ghost" className="rounded-full" onClick={() => onJumpToSource(it.text)}>
                          Locate in source (best-effort)
                        </Button>
                      </div>

                      {selectableEvidenceIds.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Evidence IDs:</span>
                          {selectableEvidenceIds.slice(0, 10).map((eid) => {
                            const active = String(selectedEvidence) === String(eid);
                            return (
                              <Button
                                key={eid}
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                className="rounded-full"
                                onClick={() => setSelectedEvidenceByItem((prev) => ({ ...prev, [it.id]: eid }))}
                              >
                                {eid}
                              </Button>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">Source excerpt</p>
                        {selectedCandidate?.page ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">Page {String(selectedCandidate.page)}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                          {excerpt ?? "No matching excerpt found in the source text."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
