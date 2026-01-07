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

  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;

  const start = Math.max(0, idx - 180);
  const end = Math.min(t.length, idx + q.length + 220);
  return t.slice(start, end).replace(/\s+/g, " ").trim();
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

  async function copyRisks() {
    const text = normalized
      .map((r, i) => `${i + 1}. [${r.severity}] ${r.title}${r.detail ? ` — ${r.detail}` : ""}`)
      .join("\n");
    await navigator.clipboard.writeText(text || "No risks detected.");
  }

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
