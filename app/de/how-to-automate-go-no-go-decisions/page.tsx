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
  title: "So automatisieren Sie Go/No-Go-Entscheidungen | TenderPilot",
  description:
    "Eine Schritt-für-Schritt-Anleitung zur Automatisierung von RFP-Go/No-Go-Entscheidungen. Erfahren Sie, wie Sie mit KI Anforderungsextrahieren und Risiken aufdecken.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/de/how-to-automate-go-no-go-decisions",
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
  const dict = (await import("@/dictionaries/de.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "So automatisieren Sie Go/No-Go-Entscheidungen für Ausschreibungen",
    description: "Eine Schritt-für-Schritt-Anleitung zur Nutzung von KI zur sofortigen Qualifizierung von Angeboten.",
    step: [
      {
        "@type": "HowToStep",
        name: "Laden Sie Ihre RFP-Dokumente hoch",
        text: "Sammeln Sie alle Ausschreibungs-PDFs, technischen Spezifikationen und juristischen Klauseln. Laden Sie sie sicher hoch."
      },
      {
        "@type": "HowToStep",
        name: "Extrahieren Sie die Compliance-Matrix",
        text: "Lassen Sie die KI die Dokumente analysieren, um jede Anforderung automatisch zu identifizieren."
      },
      {
        "@type": "HowToStep",
        name: "Identifizieren Sie kommerzielle und rechtliche Risiken",
        text: "Die KI hebt mehrdeutige Begriffe, extreme Strafen oder enge Fristen hervor."
      },
      {
        "@type": "HowToStep",
        name: "Treffen Sie eine datengesteuerte Go/No-Go-Entscheidung",
        text: "Überprüfen Sie die Zusammenfassung. Treffen Sie eine sichere Entscheidung, ohne tagelang lesen zu müssen."
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
            href="/de"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/de/how-it-works" className="hover:text-foreground">
              So funktioniert's
            </Link>
            <Link href="/de/sample" className="hover:text-foreground">
              Beispiel
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Jetzt starten</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-purple-400/80" />
            Schritt-für-Schritt-Anleitung
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            So automatisieren Sie <br />
            <span className="text-gradient-brand">Go/No-Go-Entscheidungen</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mt-4">
            Erfahren Sie, wie moderne Bid-Teams Generative KI nutzen, um Qualifizierungszeiten drastisch zu verkürzen.
          </p>
        </section>

        {/* Steps */}
        <section className="space-y-12 mb-20">
          <h2 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">Der 4-Schritte-Prozess</h2>

          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            
            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-400" />
                Ihre RFP-Dokumente hochladen
              </h3>
              <p className="text-muted-foreground">
                Der traditionelle Weg erforderte massive PDFs. Der automatisierte Weg? Einfaches Drag-and-Drop in TenderPilot.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-blue-400">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <ScanSearch className="w-5 h-5 text-blue-400" />
                Compliance-Matrix automatisch extrahieren
              </h3>
              <p className="text-muted-foreground">
                Das spezialisierte Modell sucht gezielt nach Verpflichtungen und generiert eine strukturierte Compliance-Matrix.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-orange-400">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Kommerzielle und rechtliche Risiken aufdecken
              </h3>
              <p className="text-muted-foreground">
                Die KI markiert versteckte Dealbreaker wie unbegrenzte Haftungsklauseln, damit Sie diese sofort bewerten können.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-purple-400">4</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-400" />
                Die finale Entscheidung schnell treffen
              </h3>
              <p className="text-muted-foreground">
                Mit Zusammenfassung und Risikoliste kann Ihr Bid-Komitee sofort entscheiden. Sparen Sie viel Zeit und Geld.
              </p>
            </div>

          </div>
        </section>

        <section className="mt-12">
          <GlassCard title="Bereit, es selbst auszuprobieren?">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4">
              <p className="text-sm">
                TenderPilot automatisiert diesen Prozess. Starten Sie noch heute.
              </p>
              <Button asChild className="rounded-full shrink-0">
                <Link href={primaryCtaHref}>TenderPilot testen <ArrowRight className="w-4 h-4 ml-2"/></Link>
              </Button>
            </div>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
