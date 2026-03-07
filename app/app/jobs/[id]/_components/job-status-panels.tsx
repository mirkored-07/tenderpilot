"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppI18n } from "../../../_components/app-i18n-provider";

export type JobStatusPanelStatus = "queued" | "processing" | "done" | "failed";

export type JobEventLike = {
  level: "info" | "warn" | "error";
  message: string;
  created_at: string;
  meta?: any;
};

export function formatJobDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export function summarizeJobEventMessage(msg?: string | null) {
  const s = String(msg ?? "").trim();
  if (!s) return "";
  return s.length > 220 ? s.slice(0, 217).trimEnd() + "…" : s;
}

export function pickFailureFromEvents(
  events: JobEventLike[],
  t?: (key: string, vars?: Record<string, string | number>) => string
) {
  const list = Array.isArray(events) ? [...events] : [];
  list.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));

  const lastError = [...list].reverse().find((e) => e.level === "error") ?? [...list].reverse()[0] ?? null;
  const msg = String(lastError?.message ?? "").trim();
  const T = t ?? ((k: string) => k);

  if (msg.includes("Job exceeds cost cap")) {
    const usdEst = (lastError as any)?.meta?.usdEst;
    const maxUsd = (lastError as any)?.meta?.maxUsdPerJob;

    const costNote =
      usdEst && maxUsd
        ? T("app.review.failures.processingLimits.costNote", {
            usdEst: Number(usdEst).toFixed(3),
            maxUsd: Number(maxUsd).toFixed(3),
          })
        : "";

    return {
      title: T("app.review.failures.processingLimits.title"),
      text: T("app.review.failures.processingLimits.body", { costNote }),
    };
  }

  if (msg.includes("Unstructured extract returned empty text")) {
    return {
      title: T("app.review.failures.noTextExtracted.title"),
      text: T("app.review.failures.noTextExtracted.body"),
    };
  }

  if (msg.includes("Storage download failed")) {
    return {
      title: T("app.review.failures.fileAccess.title"),
      text: T("app.review.failures.fileAccess.body"),
    };
  }

  if (msg.includes("Saving results failed")) {
    return {
      title: T("app.review.failures.saveResults.title"),
      text: T("app.review.failures.saveResults.body"),
    };
  }

  return {
    title: T("app.review.failures.generic.title"),
    text: T("app.review.failures.generic.body"),
  };
}

export function FailedStatePanel({
  jobId,
  fileName,
  events,
  retrying,
  retryFeedback,
  onRetry,
}: {
  jobId: string;
  fileName: string;
  events: JobEventLike[];
  retrying: boolean;
  retryFeedback: string | null;
  onRetry: () => void;
}) {
  const { t } = useAppI18n();
  const failure = pickFailureFromEvents(events, t);

  const lastError = (() => {
    const list = Array.isArray(events) ? [...events] : [];
    list.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    return [...list].reverse().find((e) => e.level === "error") ?? [...list].reverse()[0] ?? null;
  })();
  const lastMsg = summarizeJobEventMessage(lastError?.message);
  const lastWhen = lastError?.created_at ? formatJobDate(lastError.created_at) : "";

  const supportHref = useMemo(() => {
    const subject = `TenderPilot: job failed (${jobId})`;
    const bodyLines: string[] = [];
    bodyLines.push(`Job ID: ${jobId}`);
    bodyLines.push(`File: ${fileName}`);
    bodyLines.push("");
    bodyLines.push(`What happened: ${failure.title}`);
    if (lastMsg) bodyLines.push(`Last event: ${lastMsg}${lastWhen ? ` (${lastWhen})` : ""}`);
    bodyLines.push("");
    bodyLines.push(t("app.review.support.emailRequestLine"));

    const body = bodyLines.join("\n");
    return `mailto:support@tenderpilot.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [jobId, fileName, failure.title, lastMsg, lastWhen, t]);

  return (
    <Card className="rounded-3xl border-red-200 bg-red-50/70 shadow-sm dark:border-red-500/25 dark:bg-red-500/10">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="rounded-full">
                {t("app.common.failed")}
              </Badge>
              <p className="text-sm font-semibold">{t("app.review.failed.title")}</p>
            </div>

            <p className="mt-3 text-sm text-red-800/90 dark:text-red-200/90">
              <span className="font-medium">{t("app.review.failed.reasonLabel")}</span> {failure.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{failure.text}</p>

            {lastMsg ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {t("app.review.failed.lastStepLabel")} <span className="font-medium">{lastMsg}</span>
                {lastWhen ? <span className="ml-1">({lastWhen})</span> : null}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col md:items-end">
            <Button className="rounded-full" onClick={onRetry} disabled={retrying}>
              {retrying ? t("app.review.actions.retrying") : t("app.review.actions.retry")}
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/upload">{t("app.review.progress.startNewReview")}</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <a href={supportHref}>{t("app.common.emailSupport")}</a>
            </Button>
          </div>
        </div>

        {retryFeedback ? (
          <div className="mt-5 rounded-2xl border bg-background/70 p-4 text-sm text-foreground/80">{retryFeedback}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ProgressCard({
  status,
  events,
}: {
  status: JobStatusPanelStatus;
  events: JobEventLike[];
}) {
  const { t } = useAppI18n();
  const isFailed = status === "failed";

  const fallbackFailure = {
    title: t("app.review.progress.needsAttentionTitle"),
    text: t("app.review.progress.needsAttentionBody"),
  };

  const failure =
    typeof pickFailureFromEvents === "function" ? pickFailureFromEvents(events, t) : fallbackFailure;

  const title =
    status === "queued"
      ? t("app.review.progress.gettingStarted")
      : status === "processing"
        ? t("app.review.progress.working")
        : status === "done"
          ? t("app.common.ready")
          : failure.title;

  const subtitle =
    status === "queued"
      ? t("app.review.progress.preparing")
      : status === "processing"
        ? t("app.review.progress.extracting")
        : status === "done"
          ? t("app.review.progress.resultsReady")
          : failure.text;

  const barClass =
    status === "failed"
      ? "w-full bg-red-500"
      : status === "queued"
        ? "w-1/3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-pulse"
        : status === "processing"
          ? "w-2/3 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-pulse"
          : "w-full bg-green-500";

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 py-5">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{t("app.review.progress.autoUpdates")}</p>
        </div>

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barClass}`} />
        </div>

        <p className="text-xs text-muted-foreground">{subtitle}</p>

        {isFailed ? (
          <div className="pt-1">
            <Button asChild className="rounded-full">
              <Link href="/app/upload">{t("app.review.progress.startNewReview")}</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
