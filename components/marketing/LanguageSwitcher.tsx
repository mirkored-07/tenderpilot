"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Locale = "en" | "de" | "it" | "es" | "fr";

function getLocaleFromPath(pathname: string): Locale {
  const seg = pathname.split("/")[1];
  if (seg === "de") return "de";
  if (seg === "it") return "it";
  if (seg === "es") return "es";
  if (seg === "fr") return "fr";
  return "en";
}

function buildTargetPath(pathname: string, search: string, target: Locale) {
  const parts = pathname.split("/");
  const first = parts[1];

  let nextPath = `/${target}`;
  if (first === "en" || first === "de" || first === "it" || first === "es" || first === "fr") {
    parts[1] = target;
    nextPath = parts.join("/") || `/${target}`;
  } else {
    // No locale prefix in the URL (default language pages like "/" or "/pricing").
    // Keep EN canonical without prefix; for other locales, prefix the existing path.
    if (target === "en") {
      nextPath = pathname || "/";
    } else {
      nextPath = pathname === "/" ? `/${target}` : `/${target}${pathname}`;
    }
  }

  return search ? `${nextPath}?${search}` : nextPath;
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `tp_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher({
  label,
  showLabel = false,
}: {
  label?: string;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  const current = getLocaleFromPath(pathname);
  const currentTag = current.toUpperCase();

  const [resolvedLabel, setResolvedLabel] = React.useState<string>(label ?? "Language");

  React.useEffect(() => {
    if (label) {
      setResolvedLabel(label);
      return;
    }

    const getCookieLocale = (): Locale | null => {
      try {
        const raw = document.cookie || "";
        const m = raw.match(/(?:^|;\s*)tp_locale=([^;]+)/);
        const v = m ? decodeURIComponent(m[1]) : "";
        if (v === "en" || v === "de" || v === "it" || v === "es" || v === "fr") return v;
      } catch {
        // ignore
      }
      return null;
    };

    const effective: Locale = getCookieLocale() ?? current;

    let cancelled = false;
    (async () => {
      try {
        let mod: any = null;
        if (effective === "de") mod = await import("@/dictionaries/de.json");
        else if (effective === "it") mod = await import("@/dictionaries/it.json");
        else if (effective === "es") mod = await import("@/dictionaries/es.json");
        else if (effective === "fr") mod = await import("@/dictionaries/fr.json");
        else mod = await import("@/dictionaries/en.json");

        const txt = mod?.default?.landing?.nav?.language;
        if (!cancelled && typeof txt === "string" && txt.trim()) setResolvedLabel(txt);
      } catch {
        // keep fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [label, current]);

  const onSelect = (locale: Locale) => {
    setLocaleCookie(locale);
    const nextUrl = buildTargetPath(pathname, search, locale);
    router.push(nextUrl);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 rounded-full px-3 gap-2" aria-label={resolvedLabel}>
          <Languages className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide">{currentTag}</span>
          {showLabel ? (
            <span className="text-sm text-muted-foreground">{resolvedLabel}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSelect("en")} className="flex items-center justify-between">
          English <span className="text-xs text-muted-foreground">EN</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("de")} className="flex items-center justify-between">
          Deutsch <span className="text-xs text-muted-foreground">DE</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("it")} className="flex items-center justify-between">
          Italiano <span className="text-xs text-muted-foreground">IT</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("es")} className="flex items-center justify-between">
          Español <span className="text-xs text-muted-foreground">ES</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("fr")} className="flex items-center justify-between">
          Français <span className="text-xs text-muted-foreground">FR</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
