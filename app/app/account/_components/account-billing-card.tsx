"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { hasPaidExportsAccess } from "@/lib/billing-entitlements";
import { useAppI18n } from "../../_components/app-i18n-provider";

type BillingSnapshot = {
  credits: number | null;
  planTier: "free" | "pro";
  planStatus: string | null;
  periodEnd: string | null;
  hasCustomer: boolean;
};

type UsageSnapshot = {
  totalJobs: number;
  doneJobs: number;
  inProgressJobs: number;
};

function formatPlanStatus(raw: string | null | undefined, t: (key: string) => string) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return t("app.account.billing.statusActive");
  return value.replaceAll("_", " ");
}

export function AccountBillingCard({
  billingNotice,
  billing,
  usage,
  billingBusy,
  onOpenBillingPortal,
  onStartCheckout,
  onSyncBilling,
}: {
  billingNotice: { kind: "ok" | "err"; text: string } | null;
  billing: BillingSnapshot | null;
  usage: UsageSnapshot | null;
  billingBusy: boolean;
  onOpenBillingPortal: () => void;
  onStartCheckout: (interval: "monthly" | "yearly") => void;
  onSyncBilling: () => void;
}) {
  const { t } = useAppI18n();
  const isPro = billing?.planTier === "pro";
  const hasPaidExports = hasPaidExportsAccess(billing?.planTier);

  return (
    <Card id="billing" className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>{t("app.account.billing.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {billingNotice && (
          <div
            className={cn(
              "rounded-2xl border p-3 text-sm",
              billingNotice.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {billingNotice.text}
          </div>
        )}

        {isPro && typeof billing?.credits === "number" && billing.credits < 1 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">{t("app.account.billing.creditsNotUpdatedTitle")}</p>
            <p className="mt-1 text-xs text-amber-900/80">{t("app.account.billing.creditsNotUpdatedBody")}</p>
            <p className="mt-2 text-xs text-amber-900/80">{t("app.account.billing.paidPlanHelp")}</p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={onSyncBilling}
                disabled={billingBusy}
              >
                {t("app.account.billing.syncBilling")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("app.account.billing.current")}</p>
            <p className="mt-1 text-lg font-semibold">
              {isPro ? t("app.account.billing.planLabelPro") : t("app.account.billing.planLabelFree")}
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full capitalize">
            {isPro ? formatPlanStatus(billing?.planStatus, t) : t("app.account.billing.statusFree")}
          </Badge>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("app.account.billing.creditsBalance")}</p>
              <p className="mt-1 text-2xl font-semibold">{billing?.credits ?? "–"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{t("app.account.billing.periodEnds")}</p>
              <p className="mt-1 text-sm font-medium">
                {billing?.periodEnd ? new Date(billing.periodEnd).toLocaleDateString() : "–"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">{t("app.account.billing.exportAccessLabel")}</p>
              <p className="mt-1 text-sm font-medium">
                {hasPaidExports
                  ? t("app.account.billing.exportAccessPaid")
                  : t("app.account.billing.exportAccessCredit")}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <p className="text-xs text-muted-foreground">{t("app.account.billing.usage")}</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold">{usage ? usage.totalJobs : "–"}</p>
              <p className="text-xs text-muted-foreground">{t("app.account.billing.tenders")}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{usage ? usage.doneJobs : "–"}</p>
              <p className="text-xs text-muted-foreground">{t("app.account.billing.processed")}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{usage ? usage.inProgressJobs : "–"}</p>
              <p className="text-xs text-muted-foreground">{t("app.account.billing.inProgress")}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {isPro ? t("app.account.billing.paidPlanHelp") : t("app.account.billing.freePlanHelp")}
        </p>

        {isPro ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="rounded-full"
              onClick={onOpenBillingPortal}
              disabled={billingBusy}
            >
              {t("app.account.billing.manageBilling")}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onStartCheckout("yearly")}
              disabled={billingBusy}
            >
              {t("app.account.billing.changePlan")}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={onSyncBilling}
              disabled={billingBusy}
            >
              {t("app.account.billing.syncBilling")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="rounded-full"
              onClick={() => onStartCheckout("monthly")}
              disabled={billingBusy}
            >
              {t("app.account.billing.upgradeMonthly")}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onStartCheckout("yearly")}
              disabled={billingBusy}
            >
              {t("app.account.billing.upgradeAnnual")}
            </Button>

            {billing?.hasCustomer ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={onSyncBilling}
                disabled={billingBusy}
              >
                {t("app.account.billing.syncBilling")}
              </Button>
            ) : null}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("app.account.billing.stripeNote")}</p>
      </CardContent>
    </Card>
  );
}
