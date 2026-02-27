import Link from "next/link";
import { ArrowRight, UploadCloud, ScanLine, ListChecks, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";

type HowItWorksDict = {
  header: { sample: string; cta: string };
  hero: { titleA: string; highlight: string; subtitle: string };
  steps: Array<{ step: string; title: string; desc: string }>;
  bottomCta: { title: string; desc: string; button: string; footnote: string };
  footer: { privacy: string; terms: string };
};

function StepCard({
  icon,
  step,
  title,
  desc,
  colorClass,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  desc: string;
  colorClass: string;
}) {
  return (
    <div className="relative group">
      <div
        className={`absolute inset-0 bg-gradient-to-b ${colorClass} to-transparent rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}
      />
      <div className="relative h-full glass-card p-8 rounded-3xl border border-white/10 overflow-hidden flex flex-col">
        <div className="flex items-start justify-between mb-8">
          <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground shadow-inner">
            {icon}
          </div>
          <span className="text-5xl font-bold text-white/[0.05] font-mono">{step}</span>
        </div>

        <h3 className="text-xl font-bold mb-4">{title}</h3>
        <p className="text-muted-foreground leading-relaxed mb-6 flex-grow">{desc}</p>
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

  const icons = [
    <UploadCloud key="i1" className="w-7 h-7 text-blue-400" />,
    <ScanLine key="i2" className="w-7 h-7 text-purple-400" />,
    <ListChecks key="i3" className="w-7 h-7 text-emerald-400" />,
    <FileText key="i4" className="w-7 h-7 text-amber-300" />,
  ];

  const colors = ["from-blue-500", "from-purple-500", "from-emerald-500", "from-amber-500"];

  return (
    <div className="min-h-screen bg-background aurora-bg overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
              <BrandIcon className="h-7 w-7" />
              <span>TenderPilot</span>
            </Link>

            <div className="flex items-center gap-3">
              <Link href={sampleHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {dict.header.sample}
              </Link>
              <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-primary text-primary-foreground">
                <Link href={primaryCtaHref}>{dict.header.cta}</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-10">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-zinc-200">Workflow</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            {dict.hero.titleA} <span className="text-primary">{dict.hero.highlight}</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">{dict.hero.subtitle}</p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href={primaryCtaHref}>
                {dict.header.cta} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-10 h-12 border-white/10">
              <Link href={sampleHref}>{dict.header.sample}</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-2">
          {dict.steps.slice(0, 4).map((s, idx) => (
            <StepCard
              key={s.step}
              step={s.step}
              icon={icons[idx] || icons[0]}
              title={s.title}
              desc={s.desc}
              colorClass={colors[idx] || "from-blue-500"}
            />
          ))}
        </div>

        <div className="mt-24 text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
          <h3 className="text-2xl font-bold mb-4">{dict.bottomCta.title}</h3>
          <p className="text-muted-foreground mb-8">{dict.bottomCta.desc}</p>

          <Button asChild size="lg" className="rounded-full px-12 h-14 text-lg bg-white text-black hover:bg-gray-200">
            <Link href={primaryCtaHref}>
              {dict.bottomCta.button} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <p className="mt-4 text-sm text-zinc-500">{dict.bottomCta.footnote}</p>
        </div>
      </main>

      <footer className="border-t border-white/5 py-10 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 md:px-8 flex items-center justify-between text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} TenderPilot</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-zinc-300">
              {dict.footer.privacy}
            </Link>
            <Link href="/terms" className="hover:text-zinc-300">
              {dict.footer.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
