import Link from "next/link";
import { ArrowRight, UploadCloud, ScanLine, FileCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { BrandIcon } from "@/components/brand-icon";

export const metadata: Metadata = {
  title: "Cómo funciona TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs | Análisis de licitaciones con IA",
  description:
    "Descubre cómo TenderPilot convierte licitaciones y RFP en requisitos, riesgos y una estructura de propuesta lista en minutos.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/es/how-it-works",
    languages: {
      en: "https://www.trytenderpilot.com/en/how-it-works",
      de: "https://www.trytenderpilot.com/de/how-it-works",
      it: "https://www.trytenderpilot.com/it/how-it-works",
      fr: "https://www.trytenderpilot.com/fr/how-it-works",
      es: "https://www.trytenderpilot.com/es/how-it-works",
      "x-default": "https://www.trytenderpilot.com/en/how-it-works",
    },
  },
};


function StepCard({
  icon,
  step,
  title,
  desc,
  colorClass
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  desc: string;
  colorClass: string;
}) {
  return (
    <div className="relative group">
      <div className={`absolute inset-0 bg-gradient-to-b ${colorClass} to-transparent rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

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

export default async function HowItWorks() {
  const dict = (await import("@/dictionaries/es.json")).default as any;
  const nav = dict.nav as { title: string };
  const t = dict.howItWorksPage as any;

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/es" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-zinc-800 text-white rounded-lg flex items-center justify-center">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <Button asChild size="sm" variant="ghost" className="rounded-full">
            <Link href="/es" className="gap-2">
              {t.header.backToHome} <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-3xl mx-auto text-center mb-24">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
            {t.hero.titleA} <br /> {t.hero.titleB} <span className="text-gradient-brand">{t.hero.highlight}</span>
          </h1>
          <p className="text-xl text-muted-foreground">{t.hero.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-[28%] left-[16%] right-[16%] h-px bg-gradient-to-r from-blue-500/0 via-blue-500/30 to-blue-500/0 border-t border-dashed border-white/10 z-0" />

          <StepCard
            step={t.steps[0].step}
            icon={<UploadCloud className="w-7 h-7 text-blue-400" />}
            title={t.steps[0].title}
            desc={t.steps[0].desc}
            colorClass="from-blue-500"
          />

          <StepCard
            step={t.steps[1].step}
            icon={<ScanLine className="w-7 h-7 text-purple-400" />}
            title={t.steps[1].title}
            desc={t.steps[1].desc}
            colorClass="from-purple-500"
          />

          <StepCard
            step={t.steps[2].step}
            icon={<FileCheck className="w-7 h-7 text-emerald-400" />}
            title={t.steps[2].title}
            desc={t.steps[2].desc}
            colorClass="from-emerald-500"
          />
        </div>

        <div className="mt-32 text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
          <h3 className="text-2xl font-bold mb-4">{t.bottomCta.title}</h3>
          <p className="text-muted-foreground mb-8">{t.bottomCta.desc}</p>

          <Button asChild size="lg" className="rounded-full px-12 h-14 text-lg bg-white text-black hover:bg-gray-200">
            <Link href="/app/upload">
              {t.bottomCta.button} <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
