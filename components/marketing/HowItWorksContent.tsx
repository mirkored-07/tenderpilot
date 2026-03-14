import Link from "next/link";
import { ArrowRight, UploadCloud, ScanLine, ListChecks, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { ModeToggle } from "@/components/mode-toggle";
import LanguageSwitcherSlot from "@/components/marketing/LanguageSwitcherSlot";
import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";
import { loginWithNextHref } from "@/lib/access-mode";
import { ScrollReveal } from "@/components/marketing/ScrollReveal";

type HowItWorksDict = {
  header: { sample: string; cta: string; language?: string; theme?: string; menu?: string };
  hero: { titleA: string; highlight: string; subtitle: string };
  steps: Array<{ step: string; title: string; desc: string }>;
  bottomCta: { title: string; desc: string; button: string; footnote: string };
  footer: { privacy: string; terms: string };
};

const STEP_META = [
  {
    icon: <UploadCloud className="w-6 h-6 text-teal-400" />,
    glow: "from-teal-500/20 via-teal-500/5",
    accent: "text-teal-400",
    border: "border-teal-500/20",
    bg: "bg-teal-500/10",
  },
  {
    icon: <ScanLine className="w-6 h-6 text-purple-400" />,
    glow: "from-purple-500/20 via-purple-500/5",
    accent: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/10",
  },
  {
    icon: <ListChecks className="w-6 h-6 text-emerald-400" />,
    glow: "from-emerald-500/20 via-emerald-500/5",
    accent: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
  },
  {
    icon: <FileText className="w-6 h-6 text-amber-400" />,
    glow: "from-amber-500/20 via-amber-500/5",
    accent: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
  },
];

function StepCard({
  icon, step, title, desc, glow, accent, border, bg, bullets,
}: {
  icon: React.ReactNode; step: string; title: string; desc: string;
  glow: string; accent: string; border: string; bg: string; bullets?: string[];
}) {
  return (
    <div className="relative group h-full">
      {/* Hover glow */}
      <div className={`absolute inset-0 bg-gradient-to-b ${glow} to-transparent rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

      <div className="relative h-full rounded-3xl border border-white/8 bg-zinc-900/60 backdrop-blur-sm overflow-hidden flex flex-col p-7 hover:border-white/15 transition-colors duration-300">
        {/* Ghost step number */}
        <span className="absolute top-5 right-6 text-7xl font-black text-white/[0.04] font-mono select-none pointer-events-none">
          {step}
        </span>

        {/* Icon */}
        <div className={`h-12 w-12 rounded-2xl ${bg} border ${border} flex items-center justify-center mb-6 shadow-inner`}>
          {icon}
        </div>

        <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed flex-grow">{desc}</p>

        {bullets && bullets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-zinc-500">
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${accent}`} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function HowItWorksContent({
  localePrefix,
  dict,
}: {
  localePrefix: "" | "/en" | "/de" | "/it" | "/fr" | "/es";
  dict: HowItWorksDict;
}) {
  const homeHref = localePrefix || "/";
  const sampleHref = `${localePrefix}/sample`;
  const primaryCtaHref = loginWithNextHref("/app/upload");

  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-teal-500/30 overflow-x-hidden">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
          <Link href={homeHref} className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <BrandIcon size={35} className="h-8 w-8" />
            <span>TenderPilot</span>
          </Link>

          <div className="hidden sm:flex items-center gap-4">
            <Link href={sampleHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {dict.header.sample}
            </Link>
            <Button asChild className="rounded-full shadow-lg shadow-teal-500/20 bg-primary text-primary-foreground">
              <Link href={primaryCtaHref}>{dict.header.cta}</Link>
            </Button>
            <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2">
              <LanguageSwitcherSlot />
              <ModeToggle />
            </div>
          </div>

          <details className="relative sm:hidden z-50">
            <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm font-medium text-foreground backdrop-blur-md [&::-webkit-details-marker]:hidden">
              {dict.header.menu ?? "Menu"}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl">
              <Link href={sampleHref} className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground">{dict.header.sample}</Link>
              <Link href={primaryCtaHref} className="block rounded-xl px-3 py-2 text-sm font-medium text-teal-400 hover:bg-teal-500/10">{dict.header.cta}</Link>
              <div className="mt-2 space-y-3 border-t border-white/10 px-3 pt-3 pb-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{dict.header.language ?? "Language"}</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{dict.header.theme ?? "Theme"}</span>
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
          {/* blob */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-[400px] w-[700px] bg-teal-600/10 blur-[100px] rounded-full opacity-60" />

          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-8 shadow-sm backdrop-blur-md">
              <Sparkles className="w-3 h-3" />
              <span>How it works</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={1}>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              {dict.hero.titleA}{" "}
              <span className="text-gradient-brand">{dict.hero.highlight}</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={2}>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">{dict.hero.subtitle}</p>
          </ScrollReveal>

          <ScrollReveal delay={3} className="mt-10 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-10 h-12 shadow-xl shadow-teal-500/20">
              <Link href={primaryCtaHref}>{dict.header.cta} <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-10 h-12 border-white/10 hover:bg-white/5">
              <Link href={sampleHref}>{dict.header.sample}</Link>
            </Button>
          </ScrollReveal>
        </div>

        {/* ── STEP CARDS ── */}
        <div className="mt-24 grid gap-6 md:grid-cols-2">
          {dict.steps.slice(0, 4).map((s, idx) => {
            const meta = STEP_META[idx] || STEP_META[0];
            return (
              <ScrollReveal key={s.step} delay={(idx % 4) as 0 | 1 | 2 | 3 | 4 | 5}>
                <StepCard
                  step={s.step}
                  icon={meta.icon}
                  title={s.title}
                  desc={s.desc}
                  glow={meta.glow}
                  accent={meta.accent}
                  border={meta.border}
                  bg={meta.bg}
                />
              </ScrollReveal>
            );
          })}
        </div>

        {/* ── BOTTOM CTA ── */}
        <ScrollReveal className="mt-28">
          <div className="relative rounded-3xl border border-white/10 bg-white/5 dark:bg-zinc-900/40 backdrop-blur-sm p-12 max-w-4xl mx-auto text-center overflow-hidden">
            {/* glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-6">
                <Sparkles className="w-3 h-3" />
                <span>Ready to start?</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{dict.bottomCta.title}</h3>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">{dict.bottomCta.desc}</p>
              <Button asChild size="lg" className="rounded-full px-12 h-14 text-lg shadow-xl shadow-teal-500/25 bg-primary text-primary-foreground hover:scale-105 transition-transform">
                <Link href={primaryCtaHref}>
                  {dict.bottomCta.button} <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <p className="mt-4 text-sm text-zinc-500">{dict.bottomCta.footnote}</p>
            </div>
          </div>
        </ScrollReveal>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} TenderPilot</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">{dict.footer.privacy}</Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">{dict.footer.terms}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
