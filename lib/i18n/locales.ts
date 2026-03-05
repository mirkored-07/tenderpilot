export type AppLocale = "en" | "de" | "it" | "fr" | "es";

export const APP_LOCALES: AppLocale[] = ["en", "de", "it", "fr", "es"];

export function normalizeLocale(input: unknown): AppLocale {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "de") return "de";
  if (raw === "it") return "it";
  if (raw === "fr") return "fr";
  if (raw === "es") return "es";
  return "en";
}

export function localeLabel(l: AppLocale): string {
  // Use native names to reduce confusion
  if (l === "de") return "Deutsch";
  if (l === "it") return "Italiano";
  if (l === "fr") return "Français";
  if (l === "es") return "Español";
  return "English";
}

export function localeCode(l: AppLocale): string {
  return l.toUpperCase();
}

export function localeToLanguageName(l: AppLocale): string {
  // For prompt instructions (human-readable language names)
  if (l === "de") return "German";
  if (l === "it") return "Italian";
  if (l === "fr") return "French";
  if (l === "es") return "Spanish";
  return "English";
}
