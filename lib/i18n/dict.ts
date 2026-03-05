import type { AppLocale } from "./locales";

// Keep loaders explicit so Next can statically include JSON files.
const LOADERS: Record<AppLocale, () => Promise<any>> = {
  en: () => import("@/dictionaries/en.json").then((m) => m.default ?? m),
  de: () => import("@/dictionaries/de.json").then((m) => m.default ?? m),
  it: () => import("@/dictionaries/it.json").then((m) => m.default ?? m),
  fr: () => import("@/dictionaries/fr.json").then((m) => m.default ?? m),
  es: () => import("@/dictionaries/es.json").then((m) => m.default ?? m),
};

export async function loadDict(locale: AppLocale): Promise<any> {
  const l = locale in LOADERS ? locale : ("en" as AppLocale);
  try {
    return await LOADERS[l]();
  } catch {
    // Fallback to EN if a locale file is missing.
    return await LOADERS.en();
  }
}
