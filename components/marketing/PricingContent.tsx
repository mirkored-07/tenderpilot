import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { BrandIcon } from "@/components/brand-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import LanguageSwitcherSlot from "@/components/marketing/LanguageSwitcherSlot";
import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { getAccessMode, loginWithNextHref } from "@/lib/access-mode";

type LocalePrefix = "" | "/en" | "/de" | "/it" | "/fr" | "/es";

export type PricingDict = {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
  };
  ui: {
    theme: string;
    language?: string;
    tipLabel: string;
    tipText: string;
  };
  tiers: {
    free: {
      name: string;
      price: string;
      sub: string;
      includes: string[];
      cta: string;
      note?: string;
    };
    pro: {
      name: string;
      price: string;
      after: string;
      limited: string;
      includes: string[];
      cta: string;
      note?: string;
    };
    team: {
      name: string;
      price: string;
      after: string;
      limited: string;
      includes: string[];
      cta: string;
      note?: string;
    };
  };
  credits: { title: string; text: string };
  faq: { title: string; items: Array<{ q: string; a: string }> };
  early_access: { title: string; description: string; limited: string };
  footer: { privacy: string; terms: string };
};

export type MarketingNavDict = {
  title: string;
  howItWorks: string;
  sample: string;
  pricing: string;
  menu: string;
};

function TierCard({
  name,
  price,
  sub,
  after,
  limited,
  includes,
  ctaHref,
  ctaLabel,
  featured,
  note,
}: {
  name: string;
  price: string;
  sub?: string;
  after?: string;
  limited?: string;
  includes: string[];
  ctaHref: string;
  ctaLabel: string;
  featured?: boolean;
  note?: string;
}) {
  return (
    <Card
      className={
        featured
          ? "relative rounded-3xl glass-card border-white/10 overflow-hidden"
          : "rounded-3xl glass-card border-white/10"
      }
    >
      {featured ? (
        <div className="pointer-events-none absolute -inset-10 bg-gradient-to-br from-blue-500/15 via-transparent to-purple-500/15 blur-3xl" />
      ) : null}

      <CardContent className="relative p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-muted-foreground">{name}</div>
            <div className="mt-2 text-4xl font-extrabold tracking-tight text-foreground">{price}</div>
            {sub ? <div className="mt-2 text-sm text-muted-foreground">{sub}</div> : null}
            {after ? <div className="mt-2 text-sm text-muted-foreground">{after}</div> : null}
          </div>
          {limited ? (
            <Badge
              variant="secondary"
              className="rounded-full bg-white/5 border border-white/10 text-foreground"
            >
              {limited}
            </Badge>
          ) : null}
        </div>

        <ul className="mt-8 space-y-3">
          {includes.map((it) => (
            <li key={it} className="flex gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        {note ? <p className="mt-6 text-xs text-muted-foreground">{note}</p> : null}

        <div className="mt-8">
          <Button
            asChild
            size="lg"
            className={
              featured
                ? "w-full rounded-full h-12 shadow-lg shadow-blue-500/20"
                : "w-full rounded-full h-12"
            }
            variant={featured ? "default" : "outline"}
          >
            <Link href={ctaHref}>
              {ctaLabel} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PricingContent({
  localePrefix,
  nav,
  dict,
}: {
  localePrefix: LocalePrefix;
  nav: MarketingNavDict;
  dict: PricingDict;
}) {
  const accessMode = getAccessMode();
  const primaryCtaHref = accessMode === "public" ? loginWithNextHref("/app/upload") : "#early-access";
  const businessCtaHref = "#early-access";

  const homeHref = localePrefix || "/";
  const howItWorksHref = `${localePrefix}/how-it-works`;
  const sampleHref = `${localePrefix}/sample`;
  const pricingHref = `${localePrefix}/pricing`;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dict.faq.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-blue-500/30 overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
          <Link
            href={homeHref}
            className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href={howItWorksHref}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {nav.howItWorks}
            </Link>
            <Link
              href={sampleHref}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {nav.sample}
            </Link>
            <Link href={pricingHref} className="text-sm font-medium text-foreground" aria-current="page">
              {nav.pricing}
            </Link>
            <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-primary text-primary-foreground ml-2">
              <Link href={primaryCtaHref}>{dict.hero.cta}</Link>
            </Button>
            <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2">
              <LanguageSwitcherSlot />
              <ModeToggle />
            </div>
          </div>

          <details className="relative md:hidden z-50">
            <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-background/70 dark:bg-zinc-900/50 px-3 py-2 text-sm font-medium text-foreground backdrop-blur-md [&::-webkit-details-marker]:hidden">
              {nav.menu}
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-white/10 bg-background/95 dark:bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl ring-1 ring-black/5">
              <Link
                href={howItWorksHref}
                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground"
              >
                {nav.howItWorks}
              </Link>
              <Link
                href={sampleHref}
                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground"
              >
                {nav.sample}
              </Link>
              <Link
                href={pricingHref}
                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-foreground"
              >
                {nav.pricing}
              </Link>
              <Link
                href={primaryCtaHref}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10"
              >
                {dict.hero.cta}
              </Link>

              <div className="mt-2 space-y-3 border-t border-white/10 px-3 pt-3 pb-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{dict.ui.language ?? "Language"}</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{dict.ui.theme}</span>
                  <ModeToggle />
                </div>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-white/10 text-blue-300 text-xs font-medium mb-8 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>{dict.hero.badge}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{dict.hero.title}</h1>
          <p className="mt-6 text-lg text-muted-foreground">{dict.hero.subtitle}</p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          <TierCard
            name={dict.tiers.free.name}
            price={dict.tiers.free.price}
            sub={dict.tiers.free.sub}
            includes={dict.tiers.free.includes}
            ctaHref={primaryCtaHref}
            ctaLabel={dict.tiers.free.cta}
            note={dict.tiers.free.note}
          />
          <TierCard
            name={dict.tiers.pro.name}
            price={dict.tiers.pro.price}
            after={dict.tiers.pro.after}
            limited={dict.tiers.pro.limited}
            includes={dict.tiers.pro.includes}
            ctaHref={primaryCtaHref}
            ctaLabel={dict.tiers.pro.cta}
            featured
            note={dict.tiers.pro.note}
          />
          <TierCard
            name={dict.tiers.team.name}
            price={dict.tiers.team.price}
            after={dict.tiers.team.after}
            limited={dict.tiers.team.limited}
            includes={dict.tiers.team.includes}
            ctaHref={businessCtaHref}
            ctaLabel={dict.tiers.team.cta}
            note={dict.tiers.team.note}
          />
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <Card className="rounded-3xl glass-card border-white/10">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold">{dict.credits.title}</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{dict.credits.text}</p>
              <Separator className="my-6 opacity-30" />
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{dict.ui.tipLabel}</span>
                <span className="ml-2">{dict.ui.tipText}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl glass-card border-white/10">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold">{dict.faq.title}</h2>
              <div className="mt-6 space-y-6">
                {dict.faq.items.map((it) => (
                  <div key={it.q}>
                    <div className="text-sm font-bold text-foreground">{it.q}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {accessMode !== "public" ? (
          <section id="early-access" className="mt-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 md:p-12 backdrop-blur-sm">
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-2xl md:text-3xl font-bold">{dict.early_access.title}</h2>
                  <p className="mt-3 text-muted-foreground">{dict.early_access.description}</p>
                  <div className="mt-4 text-sm text-muted-foreground">{dict.early_access.limited}</div>
                </div>
                <div className="w-full md:max-w-md">
                  <WaitlistInline source="pricing" />
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">© {new Date().getFullYear()} TenderPilot</div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
                {dict.footer.privacy}
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground">
                {dict.footer.terms}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
