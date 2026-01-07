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
};

type NormalizedReq = {
  id: string;
  type: "MUST" | "SHOULD" | "INFO";
  text: string;
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

export default function Checklist({ checklist, extractedText, onJumpToSource }: Props) {
  const [filter, setFilter] = useState<"ALL" | "MUST" | "SHOULD" | "INFO">("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

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

        return {
          id: String(it?.id ?? it?.key ?? idx),
          type: normalizeType(typeRaw),
          text: String(textRaw ?? "").trim(),
        };
      })
      .filter((x) => x.text.length > 0);
  }, [checklist]);

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

  async function copyMust() {
    const mustItems = normalized.filter((i) => i.type === "MUST");
    const text = mustItems.map((x, i) => `${i + 1}. ${x.text}`).join("\n");
    await navigator.clipboard.writeText(text || "No MUST requirements detected.");
  }

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
            const excerpt = isOpen ? findExcerpt(extractedText, it.text) : null;

            return (
              <Card key={it.id} className="rounded-2xl">
                <CardContent className="p-5">
                  <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : it.id)} type="button">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {typeBadge(it.type)}
                          <span className="text-sm font-medium text-foreground">{it.type}</span>
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
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => onJumpToSource(it.text)}>
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
