"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppI18n } from "./app-i18n-provider";

type NavItem = { href: string; label: string };

function buildNav(t: (k: string) => string): NavItem[] {
  return [
    { href: "/app/upload", label: t("app.nav.newReview") },
    { href: "/app/jobs", label: t("app.nav.tenders") },
    { href: "/app/dashboard", label: t("app.nav.dashboard") },
    { href: "/app/account", label: t("app.nav.account") },
  ];
}

export function SideNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useAppI18n();

  const nav = buildNav((k) => t(k));

  return (
    <div className="px-3 py-4">
      <p className="px-3 pb-2 text-xs font-medium text-white/80">{t("app.nav.menu")}</p>

      <nav className="space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all",
                "hover:bg-white/10 hover:text-white",
                active
                  ? "bg-white/12 text-white shadow-sm ring-1 ring-white/15"
                  : "text-white/75"
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}