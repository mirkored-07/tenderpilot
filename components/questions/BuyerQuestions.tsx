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
};

type Props = {
  checklist: ChecklistItem[];
  risks: RiskItem[];
  extractedText: string;
  onJumpToSource: (query: string) => void;
};

export default function BuyerQuestions({ checklist, risks, onJumpToSource }: Props) {
  const [copied, setCopied] = useState(false);

  const questions = useMemo(() => {
    const q: { text: string; anchor: string }[] = [];

    (Array.isArray(checklist) ? checklist : [])
      .filter((c) => String(c?.type ?? "").toUpperCase() === "SHOULD")
      .forEach((c) => {
        const text = String(c?.text ?? "").trim();
        if (text)
          q.push({
            text: `Can you clarify expectations regarding: "${text}"?`,
            anchor: text,
          });
      });

    (Array.isArray(risks) ? risks : []).forEach((r) => {
      const title = String(r?.title ?? "").trim();
      if (title)
        q.push({
          text: `Can you clarify the following risk or ambiguity: "${title}"?`,
          anchor: title,
        });
    });

    // de-dupe by full question
    const map = new Map<string, { text: string; anchor: string }>();
    for (const item of q) map.set(item.text, item);
    return Array.from(map.values());
  }, [checklist, risks]);

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
            </div>
          </div>
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm font-medium">No clarifications suggested</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The document looks consistent based on the available information.
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
