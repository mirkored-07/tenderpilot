"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppI18n } from "./_components/app-i18n-provider";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  const { error, reset } = props;
  const { t } = useAppI18n();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("TenderPilot route error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("app.errors.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("app.errors.body")}</p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-sm font-medium">{t("app.errors.whatYouCanDo")}</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>{t("app.errors.actions.retryPage")}</li>
              <li>{t("app.errors.actions.openHistory")}</li>
              <li>{t("app.errors.actions.refreshAfterSignIn")}</li>
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={() => reset()}>
              {t("app.errors.cta.retry")}
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/jobs">{t("app.errors.cta.openHistory")}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/upload">{t("app.errors.cta.newReview")}</Link>
            </Button>
          </div>

          {error?.message ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {t("app.errors.details")} <span className="font-mono">{error.message}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
