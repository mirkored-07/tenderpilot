import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function JobPageFeedback(props: {
  notice: string | null;
  unlockExportsHref: string;
  onDismissNotice: () => void;
  error: string | null;
  showProgress: boolean;
  t: TranslateFn;
}) {
  const { notice, unlockExportsHref, onDismissNotice, error, showProgress, t } = props;

  return (
    <>
      {notice ? (
        <Card className="rounded-2xl border bg-muted/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-foreground/80">{notice}</p>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild variant="outline" size="sm" className="w-full rounded-full sm:w-auto">
                <a href={unlockExportsHref}>{t("app.review.actions.unlockExports")}</a>
              </Button>
              <Button variant="ghost" size="sm" className="w-full rounded-full sm:w-auto" onClick={onDismissNotice}>
                {t("app.common.dismiss")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10">
          <CardContent className="p-4">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {showProgress ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 py-5">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-medium">{t("app.review.progress.working")}</p>
              <p className="text-xs text-muted-foreground">{t("app.review.progress.autoUpdates")}</p>
            </div>

            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="absolute left-0 top-0 h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
            </div>

            <p className="text-xs text-muted-foreground">{t("app.review.progress.extracting")}</p>
            <p className="text-xs text-muted-foreground">{t("app.review.progress.stepsHint")}</p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
