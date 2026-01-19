"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  risks: any[];
  extractedText: string;
  onJumpToSource: (query: string) => void;
};

type RiskSeverity = "high" | "medium" | "low";

type NormalizedRisk = {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
};

function pickFirstString(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeSeverity(v?: any): RiskSeverity {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("high") || s.includes("critical")) return "high";
  if (s.includes("low") || s.includes("minor")) return "low";
  return "medium";
}

function severityBadge(sev: RiskSeverity) {
  if (sev === "high") return <Badge variant="destructive" className="rounded-full">High</Badge>;
  if (sev === "medium") return <Badge variant="secondary" className="rounded-full">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full">Low</Badge>;
}

function findExcerpt(text: string, query: string) {
  const t = text ?? "";
  const q = (query ?? "").trim();
  if (!t || !q) return null;

  const hay = t.toLowerCase();

  function snapToWordBounds(start: number, end: number) {
    let s = Math.max(0, start);
    let e = Math.min(t.length, end);
    while (s > 0 && !/\s/.test(t[s])) s -= 1;
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

  const exactIdx = hay.indexOf(q.toLowerCase());
  if (exactIdx >= 0) return makeSnippet(exactIdx, q.length);

  const wordsAll = q.split(/\s+/).filter(Boolean);
  const needles = [
    wordsAll.slice(0, 12).join(" "),
    wordsAll.slice(0, 8).join(" "),
  ].filter(Boolean);

  for (const n of needles) {
    const idx = hay.indexOf(n.toLowerCase());
    if (idx >= 0) return makeSnippet(idx, n.length);
  }

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

export default function Risks({ risks, extractedText, onJumpToSource }: Props) {
  const [filter, setFilter] = useState<RiskSeverity | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const normalized: NormalizedRisk[] = useMemo(() => {
    const arr = Array.isArray(risks) ? risks : [];

    return arr
      .map((r, idx) => {
        const sevRaw = pickFirstString(r, ["severity", "level", "rating", "priority"]);
        const titleRaw =
          pickFirstString(r, ["title", "risk", "name", "summary", "text"]) ||
          (typeof r === "string" ? r : "");
        const detailRaw = pickFirstString(r, ["detail", "description", "why", "impact", "mitigation", "recommendation"]);

        return {
          id: String(r?.id ?? r?.key ?? idx),
          severity: normalizeSeverity(sevRaw),
          title: String(titleRaw ?? "").trim(),
          detail: String(detailRaw ?? "").trim(),
        };
      })
      .filter((x) => x.title.length > 0);
  }, [risks]);

  const counts = useMemo(() => {
    const high = normalized.filter((r) => r.severity === "high").length;
    const medium = normalized.filter((r) => r.severity === "medium").length;
    const low = normalized.filter((r) => r.severity === "low").length;
    return { high, medium, low };
  }, [normalized]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return normalized.filter((r) => {
      if (filter !== "ALL" && r.severity !== filter) return false;
      if (!query) return true;
      return r.title.toLowerCase().includes(query) || r.detail.toLowerCase().includes(query);
    });
  }, [normalized, filter, q]);

  const showEmpty = filtered.length === 0;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold">Risks</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with High risks. Use excerpts to verify wording.
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
                variant={filter === "high" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("high")}
              >
                High <span className="ml-2 text-xs opacity-70">{counts.high}</span>
              </Button>
              <Button
                type="button"
                variant={filter === "medium" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("medium")}
              >
                Medium <span className="ml-2 text-xs opacity-70">{counts.medium}</span>
              </Button>
              <Button
                type="button"
                variant={filter === "low" ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter("low")}
              >
                Low <span className="ml-2 text-xs opacity-70">{counts.low}</span>
              </Button>
            </div>

            <div className="min-w-[260px]">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search risks…"
                className="rounded-2xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {showEmpty ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-3">
            <div>
              <p className="text-sm font-semibold">No risks detected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                If the tender contains complex tables or scanned content, risks may not be captured reliably. Review the source to verify.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button className="rounded-full" onClick={() => onJumpToSource("")}>
                Review source text
              </Button>
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
          {filtered.map((r) => {
            const isOpen = open === r.id;
            const excerpt = isOpen ? findExcerpt(extractedText, r.title) : null;

            return (
              <Card key={r.id} className="rounded-2xl">
                <CardContent className="p-5">
                  <button
                    className="w-full text-left"
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {severityBadge(r.severity)}
                          <span className="text-sm font-medium text-foreground">{r.title}</span>
                        </div>
                        {r.detail ? (
                          <p className="text-sm text-muted-foreground leading-relaxed">{r.detail}</p>
                        ) : null}
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
                          onClick={() => onJumpToSource(r.title)}
                        >
                          Jump to source
                        </Button>
                      </div>

                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">Source excerpt</p>
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
