import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

type EvidenceFocusLike = {
  id: string;
  excerpt: string;
  page?: number | null;
  anchor?: string | null;
  note?: string | null;
  allIds?: string[] | null;
};

type SourceFocusLike = {
  query: string;
  snippet: string;
  idx: number | null;
  highlightStart: number | null;
  highlightEnd: number | null;
};

export function JobPageReferencePanels(props: {
  t: TranslateFn;
  evidenceFocus: EvidenceFocusLike | null;
  copiedSection: string | null;
  showEvidenceExcerpt: boolean;
  evidenceExcerptRef: React.RefObject<HTMLDivElement | null>;
  onSwitchEvidenceId: (evidenceId: string) => void;
  onOpenEvidenceExcerpt: () => void;
  onLocateEvidence: () => void;
  onCopyEvidenceExcerpt: () => Promise<void> | void;
  onCloseEvidence: () => void;
  sourceFocus: SourceFocusLike | null;
  onCopySourcePhrase: () => Promise<void> | void;
  onCloseSourceFocus: () => void;
}) {
  const {
    t,
    evidenceFocus,
    copiedSection,
    showEvidenceExcerpt,
    evidenceExcerptRef,
    onSwitchEvidenceId,
    onOpenEvidenceExcerpt,
    onLocateEvidence,
    onCopyEvidenceExcerpt,
    onCloseEvidence,
    sourceFocus,
    onCopySourcePhrase,
    onCloseSourceFocus,
  } = props;

  return (
    <>
      {evidenceFocus ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{t("app.review.source.evidenceExcerptTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {evidenceFocus.id ? (
                    <>
                      {t("app.review.source.idLabel")} <span className="font-medium text-foreground">{evidenceFocus.id}</span>
                    </>
                  ) : (
                    <>{t("app.review.source.evidenceLabel")}</>
                  )}
                  {typeof evidenceFocus.page === "number" ? (
                    <> • {t("app.review.source.pageLabel")} {evidenceFocus.page}</>
                  ) : null}
                  {evidenceFocus.anchor ? <> • <span className="text-foreground/70">{evidenceFocus.anchor}</span></> : null}
                </p>

                {Array.isArray(evidenceFocus.allIds) && evidenceFocus.allIds.length > 1 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t("app.review.source.switchEvidence")}</span>
                    {evidenceFocus.allIds.slice(0, 12).map((eid) => {
                      const active = String(eid) === String(evidenceFocus.id);
                      return (
                        <Button
                          key={eid}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => onSwitchEvidenceId(String(eid))}
                        >
                          {eid}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}

                {evidenceFocus.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{evidenceFocus.note}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{t("app.review.source.excerptAuthoritativeNote")}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button className="rounded-full" onClick={onOpenEvidenceExcerpt}>
                  {t("app.review.source.openEvidenceExcerpt")}
                </Button>

                {evidenceFocus.excerpt ? (
                  <Button variant="outline" className="rounded-full" onClick={onLocateEvidence}>
                    {t("app.review.source.locateBestEffort")}
                  </Button>
                ) : null}

                {evidenceFocus.excerpt ? (
                  <Button variant="outline" className="rounded-full" onClick={onCopyEvidenceExcerpt}>
                    {copiedSection === "evidence" ? t("app.common.copied") : t("app.review.actions.copyExcerpt")}
                  </Button>
                ) : null}

                <Button variant="outline" className="rounded-full" onClick={onCloseEvidence}>
                  {t("app.common.close")}
                </Button>
              </div>
            </div>

            {showEvidenceExcerpt && evidenceFocus.excerpt ? (
              <div ref={evidenceExcerptRef} className="mt-4 rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{evidenceFocus.excerpt}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {sourceFocus ? (
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{t("app.review.source.locateBestEffort")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("app.review.source.matchFor")} <span className="font-medium text-foreground">{sourceFocus.query}</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{t("app.review.source.bestEffortPointer")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="rounded-full" onClick={onCopySourcePhrase}>
                  {copiedSection === "sourcePhrase" ? t("app.common.copied") : t("app.review.actions.copyPhrase")}
                </Button>

                <Button variant="outline" className="rounded-full" onClick={onCloseSourceFocus}>
                  {t("app.review.source.closeLocateView")}
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{sourceFocus.snippet}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
