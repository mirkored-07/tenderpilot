"use client";

import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { APP_LOCALES, localeCode, localeLabel, type AppLocale } from "@/lib/i18n/locales";
import { useAppI18n } from "./app-i18n-provider";

export function AppLanguageSwitcher() {
  const { locale, setLocale, t } = useAppI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full gap-2">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{t("app.common.language")}</span>
          <span className="font-semibold">{localeCode(locale as any)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {APP_LOCALES.map((l: AppLocale) => (
          <DropdownMenuItem
            key={l}
            onClick={() => {
              void setLocale(l);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span>{localeLabel(l)}</span>
            {l === locale ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
