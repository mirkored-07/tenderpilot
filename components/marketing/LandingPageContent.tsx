import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Euro,
  FileSearch,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { BrandIcon } from "@/components/brand-icon";
import { InteractiveDemo } from "@/components/marketing/InteractiveDemo";
import LanguageSwitcherSlot from "@/components/marketing/LanguageSwitcherSlot";
import { MarketingMobileMenu } from "@/components/marketing/MarketingMobileMenu";
import { ScrollProgressRing } from "@/components/marketing/ScrollProgressRing";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { StatCounter } from "@/components/marketing/StatCounter";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAccessMode, loginWithNextHref } from "@/lib/access-mode";

export type LandingLocalePrefix = "" | "/en" | "/de" | "/it" | "/fr" | "/es";

export type LandingDict = {
  nav: { cta: string; theme: string; language?: string };
  hero: {
    badge: string;
    title_line1: string;
    title_line2: string;
    description: string;
    primary_cta: string;
    secondary_cta: string;
    validated_prefix: string;
    validated_emphasis: string;
  };
  scanner: { risk_badge: string };
  features: {
    section_title: string;
    section_subtitle: string;
    cards: {
      executive: { title: string; subtitle: string; bullets: string[] };
      mandatory: { title: string; subtitle: string; bullets: string[] };
      risks: { title: string; subtitle: string; bullets: string[] };
      execution: { title: string; subtitle: string; bullets: string[] };
    };
  };
  roi: {
    header: string;
    subheader: string;
    cards: {
      time: { title: string; desc: string };
      margin: { title: string; desc: string };
      compliance: { title: string; desc: string };
    };
  };
  zero_training: { title: string; text: string };
  get_started: { title: string; description: string; bullets: string[]; note: string };
  early_access: { title: string; description: string; limited: string };
  footer: { browse: string; privacy: string; terms: string };
};

type MarketingNavDict = {
  howItWorks: string;
  sample: string;
  pricing: string;
  title: string;
  menu: string;
};

function localeHref(localePrefix: LandingLocalePrefix, path: string) {
  if (!localePrefix) {
    return path;
  }

  return path === "/" ? localePrefix : `${localePrefix}${path}`;
}

function FeatureCard({
  title,
  subtitle,
  bullets,
  icon,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  icon?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-teal-500/10 glass-card border-white/5 h-full">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-400 shadow-inner">
              {icon}
            </div>
          ) : null}
          <div>
            <div className="text-base font-bold text-foreground">{title}</div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-3 flex-1">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 text-sm text-zinc-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-500" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function LandingPageContent({
  localePrefix,
  nav,
  dict,
}: {
  localePrefix: LandingLocalePrefix;
  nav: MarketingNavDict;
  dict: LandingDict;
}) {
  const accessMode = getAccessMode();
  const primaryCtaHref = accessMode === "public" ? loginWithNextHref("/app/upload") : "#early-access";
  const homeHref = localeHref(localePrefix, "/");
  const howItWorksHref = localeHref(localePrefix, "/how-it-works");
  const sampleHref = localeHref(localePrefix, "/sample");
  const pricingHref = localeHref(localePrefix, "/pricing");

  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-teal-500/30 overflow-x-hidden">
      <ScrollProgressRing />

      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-white/5 bg-background/80 backdrop-blur-xl">
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
            <Link href={howItWorksHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {nav.howItWorks}
            </Link>
            <Link href={sampleHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {nav.sample}
            </Link>
            <Link href={pricingHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {nav.pricing}
            </Link>
            <Button asChild className="rounded-full shadow-lg shadow-teal-500/20 bg-primary text-primary-foreground ml-2">
              <Link href={primaryCtaHref}>{dict.nav.cta}</Link>
            </Button>
            <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2">
              <LanguageSwitcherSlot />
              <ModeToggle />
            </div>
          </div>

          <MarketingMobileMenu
            menuLabel={nav.menu}
            items={[
              { href: howItWorksHref, label: nav.howItWorks },
              { href: sampleHref, label: nav.sample },
              { href: pricingHref, label: nav.pricing },
              { href: primaryCtaHref, label: dict.nav.cta, accent: true },
            ]}
            languageLabel={dict.nav.language ?? "Language"}
            themeLabel={dict.nav.theme}
            widthClassName="w-56"
          />
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 md:px-8 md:pt-32 overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-0 -translate-x-1/2 h-[700px] w-[700px] bg-teal-600/10 blur-[140px] rounded-full opacity-60 dark:opacity-40" />
        <div className="pointer-events-none absolute top-1/4 right-0 translate-x-1/3 h-[500px] w-[500px] bg-indigo-600/10 blur-[120px] rounded-full opacity-40 dark:opacity-30" />

        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center relative z-10">
          <div className="flex gap-6">
            <div className="hidden md:block w-[3px] min-h-full rounded-full bg-gradient-to-b from-teal-400 via-cyan-500 to-transparent self-stretch accent-line flex-shrink-0" />

            <div>
              <ScrollReveal delay={0}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-8 shadow-sm backdrop-blur-md">
                  <Sparkles className="w-3 h-3" />
                  <span>{dict.hero.badge}</span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={1}>
                <h1 className="text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl mb-8 leading-[1.05]">
                  {dict.hero.title_line1} <br />
                  <span className="text-gradient-brand">{dict.hero.title_line2}</span>
                </h1>
              </ScrollReveal>

              <ScrollReveal delay={2}>
                <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-lg">
                  {dict.hero.description}
                </p>
              </ScrollReveal>

              <ScrollReveal delay={3}>
                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full text-base px-8 h-14 shadow-xl shadow-teal-500/25 bg-primary text-primary-foreground hover:scale-105 transition-transform"
                  >
                    <Link href={primaryCtaHref}>{dict.hero.primary_cta}</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full text-base px-8 h-14 bg-transparent border-white/10 hover:bg-white/5 hover:border-white/20 text-foreground transition-all"
                  >
                    <Link href={sampleHref}>{dict.hero.secondary_cta}</Link>
                  </Button>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={4}>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-8 w-8 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-[10px] text-white/50"
                      >
                        U
                      </div>
                    ))}
                  </div>
                  <span>
                    {dict.hero.validated_prefix}{" "}
                    <span className="font-semibold text-foreground">{dict.hero.validated_emphasis}</span>
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>

          <ScrollReveal delay={3} className="w-full">
            <InteractiveDemo />
          </ScrollReveal>
        </div>
      </section>

      <section className="border-y border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-black/30 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { target: 40, suffix: " hrs", label: "saved per week" },
              { target: 4, suffix: " sec", label: "to scan a document" },
              { target: 3, suffix: "×", label: "more bids submitted" },
              { target: 0, suffix: "", prefix: "", label: "training needed", isZero: true },
            ].map((stat, index) => (
              <ScrollReveal key={stat.label} delay={index as 0 | 1 | 2 | 3 | 4 | 5}>
                <div className="group">
                  <div className="text-4xl md:text-5xl font-extrabold text-gradient-brand tabular-nums">
                    {stat.isZero ? (
                      <span>Zero</span>
                    ) : (
                      <StatCounter target={stat.target} suffix={stat.suffix} prefix={stat.prefix} />
                    )}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground font-medium">{stat.label}</div>
                  <div className="mt-3 mx-auto w-8 h-[2px] rounded-full bg-teal-500/40 group-hover:w-12 group-hover:bg-teal-400 transition-all duration-300" />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-28 md:px-8">
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-6">
              <Zap className="w-3 h-3" />
              <span>What you get</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{dict.features.section_title}</h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">{dict.features.section_subtitle}</p>
          </div>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { card: dict.features.cards.executive, icon: <FileSearch className="h-5 w-5" />, delay: 1 },
            { card: dict.features.cards.mandatory, icon: <ListChecks className="h-5 w-5" />, delay: 2 },
            { card: dict.features.cards.risks, icon: <ShieldAlert className="h-5 w-5" />, delay: 3 },
            { card: dict.features.cards.execution, icon: <CheckCircle2 className="h-5 w-5" />, delay: 4 },
          ].map(({ card, icon, delay }) => (
            <ScrollReveal key={card.title} delay={delay as 0 | 1 | 2 | 3 | 4 | 5}>
              <FeatureCard
                title={card.title}
                subtitle={card.subtitle}
                bullets={card.bullets}
                icon={icon}
              />
            </ScrollReveal>
          ))}
        </div>

        <div className="mt-16">
          <ScrollReveal>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start mb-8">
              <div>
                <h3 className="text-xl font-semibold">{dict.roi.header}</h3>
                <p className="text-muted-foreground">{dict.roi.subheader}</p>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
            {[
              { icon: <Clock className="h-6 w-6 text-teal-400" />, data: dict.roi.cards.time, delay: 1 },
              { icon: <Euro className="h-6 w-6 text-emerald-400" />, data: dict.roi.cards.margin, delay: 2 },
              { icon: <ShieldCheck className="h-6 w-6 text-purple-400" />, data: dict.roi.cards.compliance, delay: 3 },
            ].map(({ icon, data, delay }) => (
              <ScrollReveal key={data.title} delay={delay as 0 | 1 | 2 | 3 | 4 | 5}>
                <div className="h-full rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800/20 p-6 backdrop-blur-sm hover:border-teal-500/20 hover:bg-teal-500/5 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    {icon}
                    <div>
                      <div className="font-bold text-foreground">{data.title}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{data.desc}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal className="mt-20 flex justify-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm hover:bg-emerald-500/10 transition-colors cursor-default">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-muted-foreground">
              <span className="text-foreground font-semibold">{dict.zero_training.title}</span>{" "}
              {dict.zero_training.text}
            </span>
          </div>
        </ScrollReveal>
      </section>

      {accessMode === "public" ? (
        <section className="relative mx-auto max-w-7xl px-4 pb-40 md:px-8 overflow-hidden">
          <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-b from-transparent via-teal-50 dark:via-teal-950/20 to-transparent -z-10 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />

          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                {dict.get_started.title}
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                {dict.get_started.description}
              </p>
            </ScrollReveal>

            <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
              {dict.get_started.bullets.map((bullet, index) => (
                <ScrollReveal key={index} delay={(index + 1) as 0 | 1 | 2 | 3 | 4 | 5}>
                  <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/30 backdrop-blur-md p-5 text-left hover:border-teal-500/20 hover:bg-teal-500/5 transition-all duration-300">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-foreground leading-relaxed">{bullet}</div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={4} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full px-10 h-12 shadow-lg shadow-teal-500/25 bg-primary text-primary-foreground hover:scale-105 transition-transform">
                <Link href={primaryCtaHref}>{dict.nav.cta}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-10 h-12 border-white/10 hover:bg-white/5">
                <Link href={sampleHref}>{dict.hero.secondary_cta}</Link>
              </Button>
            </ScrollReveal>

            <ScrollReveal delay={5}>
              <p className="mt-6 text-xs text-center text-muted-foreground">{dict.get_started.note}</p>
            </ScrollReveal>
          </div>
        </section>
      ) : (
        <section id="early-access" className="relative mx-auto max-w-7xl px-4 pb-40 md:px-8 scroll-mt-24 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />
          <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-b from-transparent via-teal-950/20 to-transparent -z-10 pointer-events-none" />

          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                {dict.early_access.title}
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                {dict.early_access.description}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <div className="max-w-md mx-auto bg-white/5 dark:bg-zinc-800/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
                <WaitlistInline source="landing" />
                <p className="mt-6 text-xs text-center text-muted-foreground">{dict.early_access.limited}</p>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      <footer className="border-t border-zinc-200 dark:border-white/5 py-12 bg-zinc-50 dark:bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="text-sm text-zinc-500">
            © {new Date().getFullYear()} {nav.title}
          </div>
          <div className="flex flex-wrap items-center gap-8 text-sm font-medium">
            <Link href={howItWorksHref} className="text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">{nav.howItWorks}</Link>
            <Link href={sampleHref} className="text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">{nav.sample}</Link>
            <Link href="/tenders/software" className="text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">{dict.footer.browse}</Link>
            <Link href={primaryCtaHref} className="text-teal-400 hover:text-teal-300 transition-colors">{dict.nav.cta}</Link>
            <Link href="/privacy" className="text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">{dict.footer.privacy}</Link>
            <Link href="/terms" className="text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">{dict.footer.terms}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
