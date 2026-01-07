"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type ExecutiveRisk = {
  severity: "high" | "medium" | "low";
  text: string;
};

type DecisionLevel = "proceed" | "caution" | "risk";

interface ExecutiveSummaryProps {
  decision: DecisionLevel;
  decisionLine: string;
  keyFindings: string[];
  topRisks: ExecutiveRisk[];
  nextActions: string[];
  submissionDeadline?: string;
}

const decisionLabel: Record<DecisionLevel, string> = {
  proceed: "Proceed with bid",
  caution: "Proceed with caution",
  risk: "High disqualification risk",
};

function severityBadge(sev: ExecutiveRisk["severity"]) {
  if (sev === "high") return <Badge variant="destructive" className="rounded-full">High</Badge>;
  if (sev === "medium") return <Badge variant="secondary" className="rounded-full">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full">Low</Badge>;
}

export function ExecutiveSummary({
  decision,
  decisionLine,
  keyFindings,
  topRisks,
  nextActions,
  submissionDeadline,
}: ExecutiveSummaryProps) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Executive summary</h2>
            <Badge className="rounded-full">{decisionLabel[decision]}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{decisionLine}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Key findings</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(keyFindings ?? []).slice(0, 7).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
              {!keyFindings?.length ? (
                <li className="text-sm text-muted-foreground">No highlights available.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Top risks</p>
            <ul className="mt-2 space-y-2 text-sm">
              {(topRisks ?? []).slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  {severityBadge(r.severity)}
                  <span>{r.text}</span>
                </li>
              ))}
              {!topRisks?.length ? (
                <li className="text-sm text-muted-foreground">No risks detected.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Recommended next actions</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(nextActions ?? []).slice(0, 3).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
              {!nextActions?.length ? (
                <li className="text-sm text-muted-foreground">No actions suggested.</li>
              ) : null}
            </ul>
          </div>
        </div>

        {submissionDeadline ? (
          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Key dates</p>
            <p className="mt-2 text-sm">
              Submission deadline <span className="font-medium">{submissionDeadline}</span>
            </p>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Drafting support only. Always verify mandatory requirements against the original tender documents.
        </p>
      </CardContent>
    </Card>
  );
}

// Also provide default export to avoid future import mismatches
export default ExecutiveSummary;
