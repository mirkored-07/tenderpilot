"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useAppI18n } from "../../_components/app-i18n-provider";

export function AccountResourcesPanel() {
  const { t } = useAppI18n();

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle>{t("app.account.exports.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("app.account.exports.body")}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="rounded-full">
              <Link href="/app/jobs">{t("app.account.exports.openTenders")}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/upload">{t("app.nav.newReview")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle>{t("app.account.help.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <Link
              href="/how-it-works"
              className="text-foreground underline underline-offset-4"
            >
              {t("app.account.help.howItWorks")}
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("app.account.help.workflowOverview")}
            </p>
          </div>

          <div className="text-sm">
            <Link
              href="/privacy"
              className="text-foreground underline underline-offset-4"
            >
              {t("app.account.help.privacy")}
            </Link>
          </div>

          <div className="text-sm">
            <Link
              href="/terms"
              className="text-foreground underline underline-offset-4"
            >
              {t("app.account.help.terms")}
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("app.common.draftingSupport")}
            </p>
          </div>

          <div className="pt-1">
            <Button disabled variant="secondary" className="rounded-full">
              {t("app.account.help.contactSupportSoon")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
