import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function AttentionBidsCard(props: {
  t: TranslateFn;
  bids: any[];
  expanded: boolean;
  onToggleExpanded: () => void;
  renderDecisionBadge: (raw: string) => React.ReactNode;
}) {
  const { t, bids, expanded, onToggleExpanded, renderDecisionBadge } = props;
  const rows = expanded ? bids : bids.slice(0, 8);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t("app.dashboard.attention.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("app.dashboard.attention.subtitle")}
            </p>
          </div>

          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={onToggleExpanded}
          >
            {expanded ? t("app.common.showLess") : t("app.common.showMore")}
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {bids.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("app.dashboard.attention.empty")}</p>
          ) : (
            <>
              {rows.map((r: any) => (
                <div
                  key={r.job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/60 p-3"
                >
                  <div className="min-w-0">
                    <Link href={`/app/jobs/${r.job.id}`} className="text-sm font-semibold hover:underline">
                      {r.displayName}
                    </Link>
                    {r.hasDuplicateName ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{r.displayMeta}</p>
                    ) : null}

                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.missingDecision
                        ? t("app.dashboard.labels.decisionUnset")
                        : `${t("app.dashboard.labels.decision")}: ${r.decisionBucket === "unknown" ? t("app.common.unknown") : r.decisionBucket === "no-go" ? t("app.decision.noGo") : r.decisionBucket === "hold" ? t("app.decision.hold") : t("app.decision.go")}`}
                      {" • "}
                      {r.missingDeadline
                        ? t("app.dashboard.labels.deadlineUnset")
                        : r.deadline
                          ? `${t("app.dashboard.labels.deadline")}: ${new Date(r.deadline).toLocaleDateString()}`
                          : `${t("app.dashboard.labels.deadline")}: ${String(r.deadlineText || t("app.common.unknown"))}`}
                      {" • "}
                      {(() => {
                        const openCount = Math.max(0, r.total - r.done);
                        if (r.total <= 0) return t("app.dashboard.labels.noWorkItems");
                        return openCount === 1
                          ? t("app.dashboard.labels.openWorkItemOne", { count: openCount })
                          : t("app.dashboard.labels.openWorkItemMany", { count: openCount });
                      })()}
                      {r.blocked > 0 ? ` • ${t("app.dashboard.labels.blockedCount", { count: r.blocked })}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderDecisionBadge(r.decisionText)}

                    {r.dueSoon !== null ? (
                      <Badge variant={r.dueSoon < 0 ? "destructive" : "outline"} className="rounded-full">
                        {r.dueSoon < 0
                          ? t("app.dashboard.labels.daysOverdue", { count: Math.abs(r.dueSoon) })
                          : t("app.dashboard.labels.dueInDays", { count: r.dueSoon })}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full">
                        {t("app.dashboard.labels.deadlineUnknown")}
                      </Badge>
                    )}

                    {r.total > 0 ? (
                      <Badge variant="outline" className="rounded-full">
                        {t("app.dashboard.labels.itemsDone", { done: r.done, total: r.total })}
                      </Badge>
                    ) : null}

                    <div className="ml-1 flex items-center gap-2">
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link href={`/app/jobs/${r.job.id}`}>{t("app.common.open")}</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link href={`/app/jobs/${r.job.id}/bid-room`}>{t("app.bidroom.title")}</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link href={`/app/jobs/${r.job.id}/compliance`}>{t("app.compliance.title")}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {bids.length > 8 ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={onToggleExpanded}
                >
                  {expanded ? t("app.common.showLess") : t("app.common.showAllCount", { count: bids.length })}
                </button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
