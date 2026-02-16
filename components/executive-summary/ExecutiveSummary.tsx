"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type ExecutiveRisk = {
  severity: "high" | "medium" | "low";
  text?: string;
  title?: string;
  detail?: string;
};

type DecisionLevel = "proceed" | "caution" | "risk";

/**
 * Backward compatible props:
 * - Old/strict: decision + decisionLine + keyFindings + topRisks + nextActions
 * - Current page.tsx passes: decisionBadge (string) + decisionLine + keyFindings + topRisks + nextActions
 */
type ExecutiveSummaryProps =
  | {
      decision: DecisionLevel;
      decisionLine: string;
      keyFindings: string[];
      topRisks: ExecutiveRisk[];
      nextActions: string[];
      submissionDeadline?: string;
      decisionBadge?: never;
    }
  | {
      decisionBadge: string;
      decisionLine: string;
      keyFindings: string[];
      topRisks: ExecutiveRisk[];
      nextActions: string[];
      submissionDeadline?: string;
      decision?: never;
    };

const decisionLabel: Record<DecisionLevel, string> = {
  proceed: "Proceed",
  caution: "Proceed with caution",
  risk: "Hold – potential blocker",
};

function severityBadge(sev: ExecutiveRisk["severity"]) {
  if (sev === "high") return <Badge variant="destructive" className="rounded-full">High</Badge>;
  if (sev === "medium") return <Badge variant="secondary" className="rounded-full">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full">Low</Badge>;
}

function badgeFromDecision(decision: DecisionLevel): string {
  return decisionLabel[decision] ?? "Proceed with caution";
}

export function ExecutiveSummary(props: ExecutiveSummaryProps) {
  const decisionLine = props.decisionLine ?? "";
  const keyFindings = props.keyFindings ?? [];
  const topRisks = props.topRisks ?? [];
  const nextActions = props.nextActions ?? [];
  const submissionDeadline = props.submissionDeadline;

  const badgeText =
    "decisionBadge" in props
      ? props.decisionBadge
      : badgeFromDecision(props.decision);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Executive summary</h2>
            <Badge className="rounded-full">{badgeText}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{decisionLine}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Key findings</p>
            <ul className="mt-2 space-y-1 text-sm">
              {keyFindings.slice(0, 7).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
              {!keyFindings.length ? (
                <li className="text-sm text-muted-foreground">No highlights TenderPilot.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Top risks</p>
            <ul className="mt-2 space-y-2 text-sm">
              {topRisks.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  {severityBadge(r.severity)}
                  <span>{r.text ?? r.title ?? r.detail ?? ""}</span>
                </li>
              ))}
              {!topRisks.length ? (
                <li className="text-sm text-muted-foreground">No risks detected.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">Recommended next actions</p>
            <ul className="mt-2 space-y-1 text-sm">
              {nextActions.slice(0, 3).map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
              {!nextActions.length ? (
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

export default ExecutiveSummary;
