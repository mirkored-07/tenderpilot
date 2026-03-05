"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AppLocale } from "@/lib/i18n/locales";
import { normalizeLocale } from "@/lib/i18n/locales";
import { loadDict } from "@/lib/i18n/dict";
import { tFromDict } from "@/lib/i18n/t";
import { supabaseBrowser } from "@/lib/supabase/browser";

const LS_KEY = "tp_locale_v1";

type I18nCtx = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function AppI18nProvider({
  initialLocale,
  initialOutputLanguage,
  children,
}: {
  initialLocale?: string | null;
  initialOutputLanguage?: string | null;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    // Order: localStorage -> initialLocale -> EN
    try {
      const ls = window.localStorage.getItem(LS_KEY);
      if (ls) return normalizeLocale(ls);
    } catch {
      // ignore
    }
    return normalizeLocale(initialLocale);
  });

  const [dict, setDict] = useState<any | null>(null);
  const [fallback, setFallback] = useState<any | null>(null);

  // Load EN fallback once.
  useEffect(() => {
    let alive = true;
    loadDict("en").then((d) => {
      if (!alive) return;
      setFallback(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Load current dict.
  useEffect(() => {
    let alive = true;
    loadDict(locale).then((d) => {
      if (!alive) return;
      setDict(d);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  const setLocale = useCallback(async (next: AppLocale) => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);

    try {
      window.localStorage.setItem(LS_KEY, normalized);
    } catch {
      // ignore
    }

    // Best-effort persist to profile so the user sees the same UI across devices.
    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (uid) {
        // Option A: keep decision labels in English, but UI + outputs follow locale.
        // For now, output_language follows UI locale (can be decoupled later).
        await supabase
          .from("profiles")
          .update({ locale: normalized, output_language: normalized })
          .eq("id", uid);
      }
    } catch {
      // ignore (offline/RLS/env differences)
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      return tFromDict({ dict: dict ?? {}, fallbackDict: fallback ?? {}, key, vars });
    },
    [dict, fallback]
  );

  const value = useMemo<I18nCtx>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppI18n must be used within AppI18nProvider");
  return v;
}
