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
}: Props) {
  const [copied, setCopied] = useState(false);

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

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(questions.map((x) => x.text).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold">Clarifications</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Questions to reduce ambiguity before you commit effort.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {questions.length} questions
              </Badge>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={copyAll}
                disabled={questions.length === 0}
              >
                {copied ? "Copied" : "Copy all"}
              </Button>
            </div>
          </div>
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
                <p className="text-sm leading-relaxed">{q.text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => onJumpToSource(q.anchor)}
                  >
                    Jump to source
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
