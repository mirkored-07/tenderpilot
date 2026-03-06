import Link from "next/link";
import * as React from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ExportMode = null | "summary" | "brief" | "xlsx";
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function JobPageHeader(props: {
  title: string;
  showProgress: boolean;
  showFailed: boolean;
  showReady: boolean;
  lastProgressEvent?: { message: string; createdAtText?: string | null } | null;
  statusBadge: React.ReactNode;
  extractionBadge?: { label: string; title: string } | null;
  t: TranslateFn;
  onRetryAnalysis: () => void;
  canRetryAnalysis: boolean;
  canDownload: boolean;
  exportLocked: boolean;
  unlockExportsHref: string;
  canExport: boolean;
  exporting: ExportMode;
  creditsLoading: boolean;
  onExportBidPack: (source?: "header" | "menu") => Promise<void> | void;
  onExportTenderBriefPdf: () => Promise<void> | void;
  onExportSummaryTxt: () => Promise<void> | void;
  onExportCsv: (kind: "overview" | "requirements" | "risks" | "clarifications" | "outline") => void;
  onRename: () => void;
  canRename: boolean;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const {
    title,
    showProgress,
    showFailed,
    showReady,
    lastProgressEvent,
    statusBadge,
    extractionBadge,
    t,
    onRetryAnalysis,
    canRetryAnalysis,
    canDownload,
    exportLocked,
    unlockExportsHref,
    canExport,
    exporting,
    creditsLoading,
    onExportBidPack,
    onExportTenderBriefPdf,
    onExportSummaryTxt,
    onExportCsv,
    onRename,
    canRename,
    onDelete,
    canDelete,
  } = props;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>

          {showProgress && (
            <Button variant="secondary" className="rounded-full" onClick={onRetryAnalysis} disabled={!canRetryAnalysis}>
              {t("app.review.actions.retryAnalysis")}
            </Button>
          )}

          {statusBadge}

          {showReady || showFailed ? (
            <Badge variant="secondary" className="rounded-full" title={extractionBadge?.title}>
              {extractionBadge?.label}
            </Badge>
          ) : null}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {showProgress
            ? t("app.review.state.progress")
            : showFailed
              ? t("app.review.state.failed")
              : t("app.review.state.ready")}

          {showProgress && lastProgressEvent ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("app.review.state.lastUpdateLabel")}</span>{" "}
              <span>{lastProgressEvent.message}</span>
              {lastProgressEvent.createdAtText ? <span className="ml-2">({lastProgressEvent.createdAtText})</span> : null}
            </p>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{t("app.common.draftingSupport")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="ghost" className="h-9 rounded-full px-3">
          <Link href="/app/jobs" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>{t("app.common.back")}</span>
          </Link>
        </Button>

        {canDownload ? (
          exportLocked ? (
            <Button asChild variant="outline" className="h-9 rounded-full px-4">
              <a href={unlockExportsHref}>{t("app.review.actions.unlockExports")}</a>
            </Button>
          ) : (
            <Button
              className="h-9 rounded-full px-4"
              disabled={!canExport || exporting !== null || creditsLoading}
              onClick={() => onExportBidPack("header")}
            >
              {exporting === "xlsx" ? t("app.common.preparing") : t("app.review.actions.downloadBidPack")}
            </Button>
          )
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              disabled={exporting !== null}
              aria-label={t("app.review.actions.menuAria")}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-[240px]">
            <DropdownMenuItem
              disabled={!canRename}
              onSelect={(e) => {
                e.preventDefault();
                if (!canRename) return;
                onRename();
              }}
            >
              {t("app.review.actions.rename")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {canDownload ? (
              <>
                {exportLocked ? (
                  <>
                    <DropdownMenuItem asChild>
                      <a href={unlockExportsHref}>{t("app.review.actions.unlockExports")}</a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}

                <DropdownMenuItem
                  disabled={!canExport || exporting !== null || creditsLoading}
                  onSelect={async (e) => {
                    e.preventDefault();
                    await onExportTenderBriefPdf();
                  }}
                >
                  {exporting === "brief" ? t("app.common.preparing") : t("app.review.actions.exportTenderBriefPdf")}
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={!canExport || exporting !== null || creditsLoading}
                  onSelect={async (e) => {
                    e.preventDefault();
                    await onExportBidPack("menu");
                  }}
                >
                  {exporting === "xlsx" ? t("app.common.preparing") : t("app.review.actions.downloadBidPack")}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={!canExport || creditsLoading}
                  onSelect={(e) => {
                    e.preventDefault();
                    onExportCsv("overview");
                  }}
                >
                  {t("app.review.actions.exportCsvOverview")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canExport || creditsLoading}
                  onSelect={(e) => {
                    e.preventDefault();
                    onExportCsv("requirements");
                  }}
                >
                  {t("app.review.actions.exportCsvRequirements")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canExport || creditsLoading}
                  onSelect={(e) => {
                    e.preventDefault();
                    onExportCsv("risks");
                  }}
                >
                  {t("app.review.actions.exportCsvRisks")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canExport || creditsLoading}
                  onSelect={(e) => {
                    e.preventDefault();
                    onExportCsv("clarifications");
                  }}
                >
                  {t("app.review.actions.exportCsvClarifications")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canExport || creditsLoading}
                  onSelect={(e) => {
                    e.preventDefault();
                    onExportCsv("outline");
                  }}
                >
                  {t("app.review.actions.exportCsvOutline")}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={!canExport || exporting !== null || creditsLoading}
                  onSelect={async (e) => {
                    e.preventDefault();
                    await onExportSummaryTxt();
                  }}
                >
                  {exporting === "summary" ? t("app.common.preparing") : t("app.review.actions.downloadSummary")}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            ) : (
              <>
                <DropdownMenuItem disabled>{t("app.review.exportsNotReady")}</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              disabled={!canDelete}
              className="text-red-600 focus:text-red-600 dark:text-red-300 dark:focus:text-red-300"
              onSelect={(e) => {
                e.preventDefault();
                if (!canDelete) return;
                onDelete();
              }}
            >
              {t("app.common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
