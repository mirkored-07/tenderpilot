import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function HoldUnblockCard(props: {
  t: TranslateFn;
  rows: any[];
  expanded: boolean;
  onToggleExpanded: () => void;
  workItems: any[];
  jobMeta: Record<string, any>;
  isDoneStatus: (status?: string | null) => boolean;
}) {
  const { t, rows, expanded, onToggleExpanded, workItems, jobMeta, isDoneStatus } = props;
  const visibleRows = expanded ? rows : rows.slice(0, 6);

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("app.dashboard.attention.holdTitle")}</p>
          <span className="text-xs text-muted-foreground">{rows.length}</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.dashboard.attention.holdEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {visibleRows.map((r) => {
              const jid = String(r.job.id);
              const items = (workItems ?? []).filter((wi) => String(wi.job_id) === jid);
              const open = items
                .filter((wi) => {
                  const typeValue = String(wi.type ?? "").toLowerCase();
                  return typeValue === "requirement" || typeValue === "clarification";
                })
                .filter((wi) => !isDoneStatus(wi.status));
              const openCount = open.length;

              const targetIso = String((jobMeta[jid] as any)?.target_decision_at ?? "").trim();
              const target = targetIso ? new Date(targetIso) : null;
              const targetTxt = target && Number.isFinite(target.getTime()) ? target.toLocaleDateString() : "";

              return (
                <div key={jid} className="rounded-xl border bg-background/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.displayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {openCount} unblock action{openCount === 1 ? "" : "s"} open
                        {targetTxt ? ` • target decision: ${targetTxt}` : ""}
                      </p>
                    </div>
                    <Link href={`/app/jobs/${jid}`} className="text-xs text-foreground/80 underline hover:text-foreground">
                      Open
                    </Link>
                  </div>
                </div>
              );
            })}

            {rows.length > 6 ? (
              <Button variant="outline" className="rounded-full" onClick={onToggleExpanded}>
                {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: rows.length })}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
