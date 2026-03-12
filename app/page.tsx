import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldAlert, Zap, Clock, Euro, XCircle, Check, Search, FileText, ShieldCheck, Sparkles, FileSearch, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandIcon } from "@/components/brand-icon";
import LanguageSwitcherSlot from "@/components/marketing/LanguageSwitcherSlot";
import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";
import { getAccessMode, loginWithNextHref } from "@/lib/access-mode";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";
import { ScrollProgressRing } from "@/components/marketing/ScrollProgressRing";
import { StatCounter } from "@/components/marketing/StatCounter";

type LandingDict = {
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

// --- 3D SCANNER HERO ---
function ScannerHero({ riskBadge }: { riskBadge: string }) {
  return (
    <div className="relative w-full max-w-[340px] mx-auto aspect-[210/297] perspective-[2000px] group select-none mt-8 md:mt-0">
      {/* Document Shadow/Glow */}
      <div className="absolute -inset-4 bg-blue-500/20 blur-3xl opacity-20 rounded-full" />

      {/* FLOATING RISK BADGE */}
      <div
        className="absolute top-[45%] -right-12 z-50 flex items-center gap-2 opacity-0 pointer-events-none"
        style={{ animation: "cycle-risk-badge 4s ease-in-out infinite" }}
      >
        <div className="w-8 h-px bg-red-500/50" />
        <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-[0_10px_20px_rgba(220,38,38,0.4)] flex items-center gap-2 border border-red-400/50 backdrop-blur-md">
          <ShieldAlert className="w-4 h-4 text-white" />
          <span>{riskBadge}</span>
        </div>
      </div>

      {/* 3D Paper Container */}
      <div className="absolute inset-0 bg-[#ffffff] dark:bg-[#0d1117] rounded-md shadow-2xl overflow-hidden transform rotate-x-2 rotate-y-2 border border-white/10 ring-1 ring-white/5">
        {/* Paper Header */}
        <div className="h-16 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-400/80" />
            <div className="h-3 w-3 rounded-full bg-amber-400/80" />
            <div className="h-3 w-3 rounded-full bg-green-400/80" />
          </div>
          <div className="h-2 w-16 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Paper Content */}
        <div className="p-8 space-y-6 opacity-90 relative z-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
          <div className="space-y-2">
            <div className="h-5 w-3/4 bg-zinc-800/20 dark:bg-zinc-100/20 rounded animate-pulse" style={{ animationDuration: "3s" }} />
            <div className="h-5 w-1/2 bg-zinc-800/20 dark:bg-zinc-100/20 rounded animate-pulse" style={{ animationDuration: "4s" }} />
          </div>

          <div className="space-y-2 pt-4">
            <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
            <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
            <div className="h-2 w-5/6 bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
          </div>

          <div className="space-y-2 pt-2 relative">
            <div className="relative p-1 -m-1 rounded transition-all duration-500 animate-reveal-risk">
              <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
              <div className="h-2 w-11/12 bg-zinc-500/20 dark:bg-zinc-400/10 rounded mt-2" />
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
            <div className="h-2 w-4/5 bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
          </div>

          <div className="pt-8 flex items-end justify-between opacity-50">
            <div className="h-8 w-24 border-b-2 border-zinc-300 dark:border-zinc-700" />
            <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </div>
        </div>

        {/* OPTICAL SCANNER BEAM */}
        <div className="absolute inset-x-0 h-[80px] -translate-y-[80px] animate-scanner-bar z-20 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_20px_2px_rgba(59,130,246,1)]" />
          <div className="absolute bottom-[2px] left-0 right-0 h-full bg-gradient-to-t from-blue-500/20 to-transparent" />
        </div>
      </div>
    </div>
  );
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
          {bullets.map((b) => (
            <li key={b} className="flex gap-3 text-sm text-zinc-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function LandingPage() {
  const accessMode = getAccessMode();
  const primaryCtaHref = accessMode === "public" ? loginWithNextHref("/app/upload") : "#early-access";

  const dict = (await import("@/dictionaries/en.json")).default as any;
  const t = dict.landing as LandingDict;
  const nav = dict.nav as {
    howItWorks: string;
    sample: string;
    pricing: string;
    title: string;
    menu: string;
  };

  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-teal-500/30 overflow-x-hidden">

      {/* Scroll progress ring */}
      <ScrollProgressRing />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {nav.howItWorks}
            </Link>
            <Link href="/sample" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {nav.sample}
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {nav.pricing}
            </Link>
            <Button asChild className="rounded-full shadow-lg shadow-teal-500/20 bg-primary text-primary-foreground ml-2">
              <Link href={primaryCtaHref}>{t.nav.cta}</Link>
            </Button>
            <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2">
              <LanguageSwitcherSlot />
              <ModeToggle />
            </div>
          </div>

          {/* Mobile nav */}
          <details className="relative md:hidden z-50">
            <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm font-medium text-foreground backdrop-blur-md [&::-webkit-details-marker]:hidden">
              {nav.menu}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl ring-1 ring-black/5">
              <Link href="/how-it-works" className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground">{nav.howItWorks}</Link>
              <Link href="/sample" className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground">{nav.sample}</Link>
              <Link href="/pricing" className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground">{nav.pricing}</Link>
              <Link href={primaryCtaHref} className="block rounded-xl px-3 py-2 text-sm font-medium text-teal-400 hover:bg-teal-500/10">{t.nav.cta}</Link>
              <div className="mt-2 space-y-3 border-t border-white/10 px-3 pt-3 pb-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{t.nav.language ?? "Language"}</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{t.nav.theme}</span>
                  <ModeToggle />
                </div>
              </div>
            </div>
          </details>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 md:px-8 md:pt-32 overflow-hidden">
        {/* Background glow blobs */}
        <div className="pointer-events-none absolute top-1/2 left-0 -translate-x-1/2 h-[700px] w-[700px] bg-teal-600/10 blur-[140px] rounded-full opacity-60 dark:opacity-40" />
        <div className="pointer-events-none absolute top-1/4 right-0 translate-x-1/3 h-[500px] w-[500px] bg-indigo-600/10 blur-[120px] rounded-full opacity-40 dark:opacity-30" />

        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center relative z-10">
          <div className="flex gap-6">
            {/* Vertical teal accent line */}
            <div className="hidden md:block w-[3px] min-h-full rounded-full bg-gradient-to-b from-teal-400 via-cyan-500 to-transparent self-stretch accent-line flex-shrink-0" />

            <div>
              <ScrollReveal delay={0}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-8 shadow-sm backdrop-blur-md">
                  <Sparkles className="w-3 h-3" />
                  <span>{t.hero.badge}</span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={1}>
                <h1 className="text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl mb-8 leading-[1.05]">
                  {t.hero.title_line1} <br />
                  <span className="text-gradient-brand">{t.hero.title_line2}</span>
                </h1>
              </ScrollReveal>

              <ScrollReveal delay={2}>
                <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-lg">
                  {t.hero.description}
                </p>
              </ScrollReveal>

              <ScrollReveal delay={3}>
                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full text-base px-8 h-14 shadow-xl shadow-teal-500/25 bg-primary text-primary-foreground hover:scale-105 transition-transform"
                  >
                    <Link href={primaryCtaHref}>{t.hero.primary_cta}</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full text-base px-8 h-14 bg-transparent border-white/10 hover:bg-white/5 hover:border-white/20 text-foreground transition-all"
                  >
                    <Link href="/sample">{t.hero.secondary_cta}</Link>
                  </Button>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={4}>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 w-8 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-[10px] text-white/50"
                      >
                        U
                      </div>
                    ))}
                  </div>
                  <span>
                    {t.hero.validated_prefix}{" "}
                    <span className="font-semibold text-foreground">{t.hero.validated_emphasis}</span>
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* Scanner */}
          <ScrollReveal delay={2} direction="right" className="relative pl-4 lg:pl-12">
            <ScannerHero riskBadge={t.scanner.risk_badge} />
          </ScrollReveal>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-white/5 bg-zinc-950/40 dark:bg-black/30 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { target: 40, suffix: " hrs", label: "saved per week" },
              { target: 4, suffix: " sec", label: "to scan a document" },
              { target: 3, suffix: "×", label: "more bids submitted" },
              { target: 0, suffix: "", prefix: "", label: "training needed", isZero: true },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={(i as 0 | 1 | 2 | 3 | 4 | 5)}>
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

      {/* ── FEATURES ── */}
      <section className="mx-auto max-w-7xl px-4 py-28 md:px-8">
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-6">
              <Zap className="w-3 h-3" />
              <span>What you get</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">{t.features.section_title}</h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">{t.features.section_subtitle}</p>
          </div>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { card: t.features.cards.executive, icon: <FileSearch className="h-5 w-5" />, delay: 1 },
            { card: t.features.cards.mandatory, icon: <ListChecks className="h-5 w-5" />, delay: 2 },
            { card: t.features.cards.risks,     icon: <ShieldAlert className="h-5 w-5" />, delay: 3 },
            { card: t.features.cards.execution, icon: <CheckCircle2 className="h-5 w-5" />, delay: 4 },
          ].map(({ card, icon, delay }) => (
            <ScrollReveal key={card.title} delay={delay as 0|1|2|3|4|5}>
              <FeatureCard
                title={card.title}
                subtitle={card.subtitle}
                bullets={card.bullets}
                icon={icon}
              />
            </ScrollReveal>
          ))}
        </div>

        {/* ROI section */}
        <div className="mt-16">
          <ScrollReveal>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start mb-8">
              <div>
                <h3 className="text-xl font-semibold">{t.roi.header}</h3>
                <p className="text-muted-foreground">{t.roi.subheader}</p>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
            {[
              { icon: <Clock className="h-6 w-6 text-teal-400" />, data: t.roi.cards.time, delay: 1 },
              { icon: <Euro className="h-6 w-6 text-emerald-400" />, data: t.roi.cards.margin, delay: 2 },
              { icon: <ShieldCheck className="h-6 w-6 text-purple-400" />, data: t.roi.cards.compliance, delay: 3 },
            ].map(({ icon, data, delay }) => (
              <ScrollReveal key={data.title} delay={delay as 0|1|2|3|4|5}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 dark:bg-zinc-800/20 p-6 backdrop-blur-sm hover:border-teal-500/20 hover:bg-teal-500/5 transition-all duration-300">
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

        {/* ZERO TRAINING BADGE */}
        <ScrollReveal className="mt-20 flex justify-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm hover:bg-emerald-500/10 transition-colors cursor-default">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-muted-foreground">
              <span className="text-foreground font-semibold">{t.zero_training.title}</span>{" "}
              {t.zero_training.text}
            </span>
          </div>
        </ScrollReveal>
      </section>

      {/* ── CTA / EARLY ACCESS ── */}
      {accessMode === "public" ? (
        <section className="relative mx-auto max-w-7xl px-4 pb-40 md:px-8 overflow-hidden">
          {/* Full-width dark band */}
          <div className="absolute inset-x-0 inset-y-0 bg-gradient-to-b from-transparent via-teal-950/20 to-transparent -z-10 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />

          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <ScrollReveal>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                {t.get_started.title}
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                {t.get_started.description}
              </p>
            </ScrollReveal>

            <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
              {t.get_started.bullets.map((b, i) => (
                <ScrollReveal key={i} delay={(i + 1) as 0|1|2|3|4|5}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-zinc-900/30 backdrop-blur-md p-5 text-left hover:border-teal-500/20 hover:bg-teal-500/5 transition-all duration-300">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-foreground leading-relaxed">{b}</div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={4} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="rounded-full px-10 h-12 shadow-lg shadow-teal-500/25 bg-primary text-primary-foreground hover:scale-105 transition-transform">
                <Link href={primaryCtaHref}>{t.nav.cta}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-10 h-12 border-white/10 hover:bg-white/5">
                <Link href="/sample">{t.hero.secondary_cta}</Link>
              </Button>
            </ScrollReveal>

            <ScrollReveal delay={5}>
              <p className="mt-6 text-xs text-center text-muted-foreground">{t.get_started.note}</p>
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
                {t.early_access.title}
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                {t.early_access.description}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <div className="max-w-md mx-auto bg-white/5 dark:bg-zinc-800/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
                <WaitlistInline source="landing" />
                <p className="mt-6 text-xs text-center text-muted-foreground">{t.early_access.limited}</p>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="text-sm text-zinc-500">
            © {new Date().getFullYear()} {nav.title}
          </div>
          <div className="flex flex-wrap items-center gap-8 text-sm font-medium">
            <Link href="/how-it-works" className="text-zinc-400 hover:text-white transition-colors">{nav.howItWorks}</Link>
            <Link href="/sample"         className="text-zinc-400 hover:text-white transition-colors">{nav.sample}</Link>
            <Link href="/tenders/software" className="text-zinc-400 hover:text-white transition-colors">{t.footer.browse}</Link>
            <Link href={primaryCtaHref}  className="text-teal-400 hover:text-teal-300 transition-colors">{t.nav.cta}</Link>
            <Link href="/privacy"        className="text-zinc-400 hover:text-white transition-colors">{t.footer.privacy}</Link>
            <Link href="/terms"          className="text-zinc-400 hover:text-white transition-colors">{t.footer.terms}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
