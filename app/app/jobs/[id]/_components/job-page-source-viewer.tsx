import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";


type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

type SourceFocusLike = {
  query: string;
  snippet: string;
  idx: number | null;
  highlightStart: number | null;
  highlightEnd: number | null;
};

export function JobPageSourceViewer(props: {
  t: TranslateFn;
  showReferenceText: boolean;
  onOpenReferenceText: () => void;
  sourceQuery: string;
  onSourceQueryChange: (value: string) => void;
  onFindSource: () => void;
  canFindSource: boolean;
  sourceText: string;
  previewLimit: number;
  showFullSourceText: boolean;
  onToggleShowFullSourceText: () => void;
  sourceFocus: SourceFocusLike | null;
  sourceAnchorRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const {
    t,
    showReferenceText,
    onOpenReferenceText,
    sourceQuery,
    onSourceQueryChange,
    onFindSource,
    canFindSource,
    sourceText,
    previewLimit,
    showFullSourceText,
    onToggleShowFullSourceText,
    sourceFocus,
    sourceAnchorRef,
  } = props;

  const fullText = String(sourceText ?? "");
  const isLarge = fullText.length > previewLimit;
  const visibleText = !isLarge || showFullSourceText ? fullText : fullText.slice(0, previewLimit);

  return (
    <>
      {!showReferenceText ? (
        <Card className="mt-4 rounded-2xl border-dashed">
          <CardContent className="p-5">
            <p className="text-sm font-medium">{t("app.review.source.hiddenTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.review.source.hiddenBody")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button className="rounded-full" onClick={onOpenReferenceText}>
                {t("app.review.source.openReferenceText")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{t("app.review.source.searchTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("app.review.source.searchSubtitle")}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={sourceQuery}
                onChange={(e) => onSourceQueryChange(e.target.value)}
                placeholder={t("app.review.source.searchPhrasePlaceholder")}
                className="w-full min-w-[260px] rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-[320px]"
              />
              <Button type="button" className="rounded-full" variant="outline" onClick={onFindSource} disabled={!canFindSource}>
                {t("app.common.find")}
              </Button>
            </div>
          </div>

          <ScrollArea className="mt-4 h-[520px] rounded-2xl border bg-muted/20">
            <div className="w-full overflow-x-auto">
              <pre className="min-w-max whitespace-pre p-4 text-xs leading-relaxed" style={{ scrollbarGutter: "stable both-edges" }}>
                {(() => {
                  const raw = visibleText || "";
                  if (!raw) return t("app.review.source.noSourceTextYet");

                  const hs = sourceFocus?.highlightStart;
                  const he = sourceFocus?.highlightEnd;
                  if (hs === null || hs === undefined || he === null || he === undefined) {
                    return raw;
                  }

                  const start = Math.max(0, Math.min(hs, raw.length));
                  const end = Math.max(start, Math.min(he, raw.length));
                  if (end <= start) return raw;

                  const before = raw.slice(0, start);
                  const mid = raw.slice(start, end);
                  const after = raw.slice(end);

                  return (
                    <>
                      {before}
                      <span
                        ref={sourceAnchorRef}
                        className="rounded-md border-l-4 border-yellow-500 bg-yellow-200/50 px-2 py-1"
                      >
                        {mid}
                      </span>
                      {after}
                    </>
                  );
                })()}
              </pre>
            </div>
          </ScrollArea>

          {isLarge ? (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={onToggleShowFullSourceText}>
                {showFullSourceText ? t("app.review.source.showPreview") : t("app.review.source.showFullText")}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Separator className="my-4" />
      <p className="text-xs text-muted-foreground">{t("app.review.source.verificationFooter")}</p>
    </>
  );
}
