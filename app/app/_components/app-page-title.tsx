"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAppI18n } from "./app-i18n-provider";

function titleFromPath(pathname: string, t: (k: string) => string): string {
  if (!pathname) return "TenderPilot";
  if (pathname === "/app/jobs") return t("app.nav.tenders");
  if (pathname.startsWith("/app/jobs/")) return t("app.tender.single");
  if (pathname === "/app/upload") return t("app.nav.newReview");
  if (pathname.startsWith("/app/upload")) return t("app.nav.newReview");
  if (pathname === "/app/dashboard") return t("app.nav.dashboard");
  if (pathname.startsWith("/app/bid-room")) return t("app.bidroom.title");
  if (pathname === "/app/account") return t("app.nav.account");
  if (pathname.startsWith("/app/account")) return t("app.nav.account");
  return "TenderPilot";
}

export function AppPageTitle() {
  const pathname = usePathname();

  const { t } = useAppI18n();

  const title = useMemo(() => titleFromPath(pathname, (k) => t(k)), [pathname, t]);
  return <span className="truncate">{title}</span>;
}
