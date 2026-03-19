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
  title: "TenderPilot vs Software RFP Tradizionale | Confronto Completo",
  description:
    "Confronta TenderPilot con i tradizionali software RFP... Scopri perché l'estrazione dei requisiti basata sull'IA è migliore della ricerca tradizionale.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/it/tenderpilot-vs-traditional-rfp-software",
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
  const dict = (await import("@/dictionaries/it.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "TenderPilot a confronto con i tradizionali strumenti RFP. Scopri come l'estrazione dei requisiti guidata dall'IA fa la differenza.",
    url: "https://www.trytenderpilot.com/it/tenderpilot-vs-traditional-rfp-software",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/it"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/it/how-it-works" className="hover:text-foreground">
              Come funziona
            </Link>
            <Link href="/it/sample" className="hover:text-foreground">
              Vedi esempio
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Inizia ora</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-blue-400/80" />
            Confronto Software
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            TenderPilot vs. <br />
            <span className="text-gradient-brand">Software RFP Tradizionale</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Perché le librerie rigide falliscono per i team di gara moderni e come l'intelligenza artificiale cambia le carte in tavola.
          </p>
        </section>

        {/* Feature Comparison Grid */}
        <section className="grid gap-8 mb-20 md:grid-cols-2">
          {/* Traditional Software */}
          <div className="glass-card p-8 rounded-3xl border border-red-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
            <div className="flex items-start gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug">Software RFP Legacy</h2>
            </div>
            
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Librerie manuali</strong>
                  <span className="text-muted-foreground text-sm">Richiede ore di gestione manuale.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Lettura umana dei documenti</strong>
                  <span className="text-muted-foreground text-sm">Devi ancora leggere centinaia di pagine manualmente.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Decisioni lente</strong>
                  <span className="text-muted-foreground text-sm">Richiede giorni per valutare le opportunità.</span>
                </div>
              </li>
            </ul>
          </div>

          {/* TenderPilot */}
          <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <div className="flex items-start gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <Zap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug text-foreground">TenderPilot</h2>
            </div>
            
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Reality Check Automatico</strong>
                  <span className="text-muted-foreground text-sm">Nessuna libreria da mantenere. L'IA estrae automaticamente tutto.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Matrici di Compliance Istantanee</strong>
                  <span className="text-muted-foreground text-sm">Trova automaticamente i criteri critici e squalificanti.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Go/No-Go in pochi minuti</strong>
                  <span className="text-muted-foreground text-sm">Ottieni avvisi per i rischi in tempo reale.</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Feature Specifics */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard
            title="Focus sulla scrittura vs Focus sulla qualifica"
            icon={<ShieldCheck className="w-6 h-6 text-blue-400" />}
          >
            <p className="mb-4">
              I software tradizionali si concentrano sulla digitazione più veloce.
            </p>
            <p>
              TenderPilot si concentra su <strong>qualificazione ed estrazione del rischio.</strong>
            </p>
          </GlassCard>

          <GlassCard
            title="Fogli Excel rigidi vs IA Dinamica"
            icon={<Scale className="w-6 h-6 text-purple-400" />}
          >
            <p className="mb-4">
              I sistemi legacy ti bloccano su file Excel complessi.
            </p>
            <p>
              TenderPilot elabora enormi PDF non strutturati e capisce il contesto nativamente.
            </p>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">
              Pronto a migliorare la tua gestione delle gare d'appalto?
            </h3>
            <p className="text-muted-foreground mb-8">
              Dimentica le librerie manuali. Estrai ora la tua compliance.
            </p>

            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href={primaryCtaHref}>Prova TenderPilot Ora</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
