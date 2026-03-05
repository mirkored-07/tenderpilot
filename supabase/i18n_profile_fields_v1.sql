-- TenderPilot i18n profile fields (safe to re-run)

alter table if exists public.profiles
  add column if not exists locale text;

alter table if exists public.profiles
  add column if not exists output_language text;

-- Defaults (best-effort)
update public.profiles
set locale = coalesce(locale, 'en'),
    output_language = coalesce(output_language, locale, 'en')
where locale is null or output_language is null;
