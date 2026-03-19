import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import {
  FileText,
  ScanSearch,
  AlertTriangle,
  Target,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Cómo automatizar las decisiones Go/No-Go para RFP | TenderPilot",
  description:
    "Guía paso a paso sobre cómo automatizar decisiones Go/No-Go en RFP. Aprenda cómo extraer requisitos de una manera efectiva...",
  alternates: {
    canonical: "https://www.trytenderpilot.com/es/how-to-automate-go-no-go-decisions",
  },
};

function GlassCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="glass-card p-8 rounded-3xl border border-white/10 overflow-hidden">
      <div className="flex items-start gap-4 mb-5">
        {icon ? (
          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground shadow-inner">
            {icon}
          </div>
        ) : null}
        <h2 className="text-xl font-bold tracking-tight leading-snug">{title}</h2>
      </div>
      <div className="text-muted-foreground leading-relaxed text-sm md:text-base">
        {children}
      </div>
    </div>
  );
}

export default async function HowToGuidePage() {
  const dict = (await import("@/dictionaries/es.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo automatizar decisiones Go/No-Go en licitaciones",
    description: "Una guía para usar IA de forma óptima.",
    step: [
      {
        "@type": "HowToStep",
        name: "Sube tus documentos RFP",
        text: "Recopila todos los archivos..."
      },
      {
        "@type": "HowToStep",
        name: "Extraer la Matriz de Cumplimiento",
        text: "Deja que la IA busque..."
      },
      {
        "@type": "HowToStep",
        name: "Identifica Riesgos Legales y Comerciales",
        text: "Identifica problemas rápido..."
      },
      {
        "@type": "HowToStep",
        name: "Toma de decisiones Go/No-Go",
        text: "Ten el veredicto hoy..."
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/es"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/es/how-it-works" className="hover:text-foreground">
              Cómo funciona
            </Link>
            <Link href="/es/sample" className="hover:text-foreground">
              Ejemplo
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Empezar ahora</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-purple-400/80" />
            Guía Paso a Paso
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Cómo Automatizar Decisiones <br />
            <span className="text-gradient-brand">Go/No-Go</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mt-4">
            Aprenda a potenciar el poder de la IA.
          </p>
        </section>

        {/* Steps */}
        <section className="space-y-12 mb-20">
          <h2 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">El Proceso de 4 Pasos</h2>

          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            
            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-400" />
                Sube tus documentos RFP
              </h3>
              <p className="text-muted-foreground">
                Usa el menú de arrastrar y soltar de TenderPilot de forma rápida y segura.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-blue-400">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <ScanSearch className="w-5 h-5 text-blue-400" />
                Extraer la Matriz de Cumplimiento Automática
              </h3>
              <p className="text-muted-foreground">
                Identifica las obligaciones comerciales en un instante.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-orange-400">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Evalúa Riesgos Legales y Comerciales
              </h3>
              <p className="text-muted-foreground">
                Mantente a salvo de problemas futuros por el incumplimiento de una cláusula contractual que de otro modo te hubieras saltado.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-purple-400">4</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-400" />
                Decide de forma Activa y Rápida
              </h3>
              <p className="text-muted-foreground">
                Mejora tu toma de decisiones en el comité.
              </p>
            </div>

          </div>
        </section>

        <section className="mt-12">
          <GlassCard title="¿Listo para acelerar su próxima propuesta?">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4">
              <p className="text-sm">
                Comienza sin compromiso inicial y empieza a calificar.
              </p>
              <Button asChild className="rounded-full shrink-0">
                <Link href={primaryCtaHref}>Probar TenderPilot <ArrowRight className="w-4 h-4 ml-2"/></Link>
              </Button>
            </div>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
