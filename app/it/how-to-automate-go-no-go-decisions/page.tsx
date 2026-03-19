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
  title: "Come automatizzare le decisioni Go/No-Go per le gare | TenderPilot",
  description:
    "Guida passo passo su come automatizzare le decisioni Go/No-Go RFP. Scopri come estrarre i requisiti ed evidenziare i rischi in pochi minuti con l'IA.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/it/how-to-automate-go-no-go-decisions",
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
  const dict = (await import("@/dictionaries/it.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Come automatizzare le decisioni Go/No-Go per le offerte e le RFP",
    description: "Una guida passo passo per usare l'IA ed estrarre le matrici di conformità e i rischi istantaneamente.",
    step: [
      {
        "@type": "HowToStep",
        name: "Carica i tuoi documenti RFP",
        text: "Raccogli tutti i PDF e le specifiche tecniche della gara. Caricali in sicurezza su TenderPilot."
      },
      {
        "@type": "HowToStep",
        name: "Estrai la matrice di compliance",
        text: "Lascia che l'IA analizzi i documenti per identificare tutti i requisiti obbligatori."
      },
      {
        "@type": "HowToStep",
        name: "Identifica i rischi commerciali e legali",
        text: "L'IA evidenzia i termini ambigui, le penali estreme o limiti impossibili."
      },
      {
        "@type": "HowToStep",
        name: "Prendi decisioni basate sui dati",
        text: "Esamina il riepilogo generato in automatico senza sprecare ore di lettura."
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-purple-400/80" />
            Guida passo passo
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Come Automatizzare <br />
            <span className="text-gradient-brand">Decisioni Go/No-Go</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mt-4">
            Scopri come i team di gara moderni utilizzano l'IA Generativa per abbattere i tempi da giorni a minuti.
          </p>
        </section>

        {/* Steps */}
        <section className="space-y-12 mb-20">
          <h2 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">Il percorso in 4 step</h2>

          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            
            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-400" />
                Carica i tuoi Documenti RFP
              </h3>
              <p className="text-muted-foreground">
                Il metodo tradizionale prevede l'invio di manuali di 150 pagine a tutto il team. Il metodo automatico? Basta trascinare i file in TenderPilot.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-blue-400">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <ScanSearch className="w-5 h-5 text-blue-400" />
                Estrai la Matrice di Compliance in Automatico
              </h3>
              <p className="text-muted-foreground">
                TenderPilot analizza tutti gli obblighi istantaneamente, escludendo gli errori umani.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-orange-400">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Mostra i Rischi Commerciali e Legali
              </h3>
              <p className="text-muted-foreground">
                Vengono estratti tempestivamente tutti i rischi, evitando sgradite sorprese nell'esecuzione.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-purple-400">4</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-400" />
                Prendi una Decisione Finale Velocemente
              </h3>
              <p className="text-muted-foreground">
                In un istinto il team è in grado di decidere il da farsi minimizzando i rischi e il tempo speso.
              </p>
            </div>

          </div>
        </section>

        <section className="mt-12">
          <GlassCard title="Pronto a provarlo di persona?">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4">
              <p className="text-sm">
                TenderPilot automatizza da solo queste decisioni con fiducia.
              </p>
              <Button asChild className="rounded-full shrink-0">
                <Link href={primaryCtaHref}>Prova TenderPilot Ora <ArrowRight className="w-4 h-4 ml-2"/></Link>
              </Button>
            </div>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
