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
import { ScrollReveal } from "@/components/marketing/ScrollReveal";

type LocalePrefix = "" | "/en" | "/de" | "/it" | "/fr" | "/es";

export type PricingDict = {
  hero: { badge: string; title: string; subtitle: string; cta: string };
  ui: { theme: string; language?: string; tipLabel: string; tipText: string };
  tiers: {
    free: { name: string; price: string; sub: string; includes: string[]; cta: string; note?: string };
    pro: { name: string; price: string; after: string; limited: string; includes: string[]; cta: string; note?: string };
    team: { name: string; price: string; after: string; limited: string; includes: string[]; cta: string; note?: string };
  };
  credits: { title: string; text: string };
  faq: { title: string; items: Array<{ q: string; a: string }> };
  early_access: { title: string; description: string; limited: string };
  footer: { privacy: string; terms: string };
};

export type MarketingNavDict = {
  title: string; howItWorks: string; sample: string; pricing: string; menu: string;
};

function TierCard({
  name, price, sub, after, limited, includes, ctaHref, ctaLabel, featured, note,
}: {
  name: string; price: string; sub?: string; after?: string; limited?: string;
  includes: string[]; ctaHref: string; ctaLabel: string; featured?: boolean; note?: string;
}) {
  return (
    <div className={`relative rounded-3xl border overflow-hidden flex flex-col h-full ${
      featured
        ? "border-teal-500/30 bg-white dark:bg-zinc-900/80 shadow-[0_0_60px_-12px_rgba(45,212,191,0.3)]"
        : "border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50"
    } backdrop-blur-sm`}>
      {/* Featured glow */}
      {featured && (
        <div className="pointer-events-none absolute -inset-12 bg-gradient-to-br from-teal-500/15 via-transparent to-indigo-500/10 blur-3xl" />
      )}
      {featured && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
      )}

      <div className="relative p-8 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-8">
          <div>
            <div className="text-sm font-semibold text-muted-foreground">{name}</div>
            <div className={`mt-2 text-4xl font-extrabold tracking-tight ${featured ? "text-gradient-brand" : "text-foreground"}`}>
              {price}
            </div>
            {sub && <div className="mt-2 text-sm text-muted-foreground">{sub}</div>}
            {after && <div className="mt-2 text-sm text-muted-foreground">{after}</div>}
          </div>
          {limited && (
            <Badge variant="secondary" className={`rounded-full shrink-0 ${
              featured
                ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 dark:text-teal-300"
                : "bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-foreground"
            }`}>
              {limited}
            </Badge>
          )}
        </div>

        <ul className="space-y-3 flex-1">
          {includes.map((it) => (
            <li key={it} className="flex gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${featured ? "text-teal-400" : "text-zinc-500"}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        {note && <p className="mt-6 text-xs text-muted-foreground">{note}</p>}

        <div className="mt-8">
          <Button
            asChild size="lg"
            className={`w-full rounded-full h-12 ${featured ? "shadow-lg shadow-teal-500/25" : ""}`}
            variant={featured ? "default" : "outline"}
          >
            <Link href={ctaHref}>
              {ctaLabel} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PricingContent({
  localePrefix, nav, dict,
}: {
  localePrefix: LocalePrefix; nav: MarketingNavDict; dict: PricingDict;
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
    <div className="min-h-screen bg-background aurora-bg selection:bg-teal-500/30 overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* ── HEADER ── */}
     <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
          <Link href={homeHref} className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <Link href={howItWorksHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{nav.howItWorks}</Link>
            <Link href={sampleHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{nav.sample}</Link>
            <Link href={pricingHref} className="text-sm font-medium text-foreground" aria-current="page">{nav.pricing}</Link>
            <Button asChild className="rounded-full shadow-lg shadow-teal-500/20 bg-primary text-primary-foreground ml-2">
              <Link href={primaryCtaHref}>{dict.hero.cta}</Link>
            </Button>
            <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2">
              <LanguageSwitcherSlot />
              <ModeToggle />
            </div>
          </div>

          <details className="relative md:hidden z-50">
            <summary className="cursor-pointer list-none rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-zinc-900/50 px-3 py-2 text-sm font-medium text-foreground backdrop-blur-md [&::-webkit-details-marker]:hidden">
              {nav.menu}
            </summary>
           <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl ring-1 ring-black/5">
              <Link href={howItWorksHref} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground">{nav.howItWorks}</Link>
              <Link href={sampleHref} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground">{nav.sample}</Link>
              <Link href={pricingHref} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-foreground">{nav.pricing}</Link>
              <Link href={primaryCtaHref} className="block rounded-xl px-3 py-2 text-sm font-medium text-teal-400 hover:bg-teal-500/10">{dict.hero.cta}</Link>
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

      <main className="mx-auto max-w-7xl px-4 py-24 md:px-8">

        {/* ── HERO ── */}
        <div className="text-center max-w-3xl mx-auto relative">
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-[400px] w-[700px] bg-teal-600/10 blur-[100px] rounded-full opacity-60" />
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-8 shadow-sm backdrop-blur-md">
              <Sparkles className="w-3 h-3" />
              <span>{dict.hero.badge}</span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{dict.hero.title}</h1>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">{dict.hero.subtitle}</p>
          </ScrollReveal>
        </div>

        {/* ── TIER CARDS ── */}
        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {[
            { data: dict.tiers.free,  href: primaryCtaHref,  featured: false },
            { data: dict.tiers.pro,   href: primaryCtaHref,  featured: true  },
            { data: dict.tiers.team,  href: businessCtaHref, featured: false },
          ].map(({ data, href, featured }, i) => (
            <ScrollReveal key={data.name} delay={((i + 1) as 0 | 1 | 2 | 3 | 4 | 5)}>
              <TierCard
                name={data.name}
                price={data.price}
                sub={"sub" in data ? data.sub : undefined}
                after={"after" in data ? data.after : undefined}
                limited={"limited" in data ? data.limited : undefined}
                includes={data.includes}
                ctaHref={href}
                ctaLabel={data.cta}
                featured={featured}
                note={data.note}
              />
            </ScrollReveal>
          ))}
        </div>

        {/* ── CREDITS + FAQ ── */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <ScrollReveal>
            <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-sm h-full">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold">{dict.credits.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{dict.credits.text}</p>
                <Separator className="my-6 opacity-20" />
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{dict.ui.tipLabel}</span>
                  <span className="ml-2">{dict.ui.tipText}</span>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={1}>
            <Card className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50 backdrop-blur-sm h-full">
              <CardContent className="p-8">
                <h2 className="text-xl font-bold">{dict.faq.title}</h2>
                <div className="mt-6 space-y-5">
                  {dict.faq.items.map((it, i) => (
                    <ScrollReveal key={it.q} delay={((i % 3) as 0 | 1 | 2 | 3 | 4 | 5)}>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{it.q}</div>
                        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{it.a}</p>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>

        {/* ── EARLY ACCESS ── */}
        {accessMode !== "public" ? (
          <ScrollReveal className="mt-16">
            <section id="early-access" className="relative rounded-3xl border border-zinc-200 dark:border-white/10 overflow-hidden bg-white dark:bg-transparent">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-indigo-500/5" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
              <div className="relative p-10 md:p-12">
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
          </ScrollReveal>
        ) : null}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-200 dark:border-white/5 py-12 bg-zinc-50 dark:bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} TenderPilot</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">{dict.footer.privacy}</Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">{dict.footer.terms}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
