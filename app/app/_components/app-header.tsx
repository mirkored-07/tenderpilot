"use client";

import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { MobileNavDrawer } from "./mobile-nav-drawer";
import { SignOutMenuItem } from "./sign-out-menu-item";
import { AppPageTitle } from "./app-page-title";
import { AppLanguageSwitcher } from "./app-language-switcher";
import { useAppI18n } from "./app-i18n-provider";

export function AppHeader({ creditsBalance }: { creditsBalance: number | null }) {
  const { t } = useAppI18n();

  return (
    <header className="h-16 sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <MobileNavDrawer creditsBalance={creditsBalance} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">
            <span className="hidden md:inline">TenderPilot</span>
            <span className="md:hidden">
              <AppPageTitle />
            </span>
          </p>
          <p className="hidden md:block text-xs text-muted-foreground">{t("app.header.tagline")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AppLanguageSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-2 py-1.5 shadow-sm backdrop-blur hover:opacity-90 transition">
              <Avatar className="h-7 w-7">
                <AvatarFallback>TP</AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm pr-1">{t("app.nav.account")}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/app/account">{t("app.account.settings")}</Link>
            </DropdownMenuItem>
            <SignOutMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
