import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ShieldCheck,
  Scale,
} from "lucide-react";

export const metadata: Metadata = {
  title: "TenderPilot vs Software RFP Tradicional | Comparación",
  description: "Compara TenderPilot con las herramientas RFP tradicionales...",
  alternates: {
    canonical: "https://www.trytenderpilot.com/es/tenderpilot-vs-traditional-rfp-software",
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

export default async function ComparisonPage() {
  const dict = (await import("@/dictionaries/es.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    description: "TenderPilot comparado a...",
    url: "https://www.trytenderpilot.com/es/tenderpilot-vs-traditional-rfp-software",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/es" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/es/how-it-works" className="hover:text-foreground">Cómo funciona</Link>
            <Link href="/es/sample" className="hover:text-foreground">Ejemplo</Link>
          </nav>
          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Empezar ahora</Link>
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-blue-400/80" />
            Comparación de Software
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            TenderPilot vs. <br />
            <span className="text-gradient-brand">Software RFP Tradicional</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Por qué la extracción de requisitos nativa de IA lo cambia todo.
          </p>
        </section>

        <section className="grid gap-8 mb-20 md:grid-cols-2">
          {/* TRADITIONAL */}
          <div className="glass-card p-8 rounded-3xl border border-red-500/20 overflow-hidden relative">
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Bibliotecas de contenido</strong>
                  <span className="text-muted-foreground text-sm">Requiere horas de gestión manual.</span>
                </div>
              </li>
            </ul>
          </div>
          {/* TENDERPILOT */}
          <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 overflow-hidden relative">
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Extracción Automatizada</strong>
                  <span className="text-muted-foreground text-sm">La IA lo hace todo de forma automática y al instante.</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">Listo para intentar?</h3>
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href={primaryCtaHref}>Probar TenderPilot</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
