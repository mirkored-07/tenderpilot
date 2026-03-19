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
  title: "TenderPilot vs. Traditionelle RFP-Software | Vollständiger Vergleich",
  description:
    "Vergleichen Sie TenderPilot mit traditioneller RFP-Software und Proposal-Management-Tools. Sehen Sie, warum KI-gesteuerte Anforderungsextraktion besser ist als herkömmliche Suche.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/de/tenderpilot-vs-traditional-rfp-software",
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
  const dict = (await import("@/dictionaries/de.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string; howItWorks?: string; sample?: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "TenderPilot im Vergleich zu traditionellen RFP-Tools. Erfahren Sie, wie sich KI-gesteuerte Anforderungsextraktion von Standard-Proposal-Management-Software unterscheidet.",
    url: "https://www.trytenderpilot.com/de/tenderpilot-vs-traditional-rfp-software",
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
              {nav.howItWorks || "So funktioniert's"}
            </Link>
            <Link href="/de/sample" className="hover:text-foreground">
              {nav.sample || "Beispielausgabe"}
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Jetzt starten</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-blue-400/80" />
            Software-Vergleich
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            TenderPilot vs. <br />
            <span className="text-gradient-brand">Traditionelle RFP-Software</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Warum starre Abfrage- und Antwortbibliotheken für moderne Bid-Teams versagen und wie KI-native Compliance-Extraktion das Spiel verändert.
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
              <h2 className="text-2xl font-bold tracking-tight leading-snug">Legacy RFP-Software</h2>
            </div>
            
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Manuelle Inhaltsbibliotheken</strong>
                  <span className="text-muted-foreground text-sm">Erfordert Hunderte von Stunden manuellen Taggings und Wartung der Bibliothek. Liefert oft veraltete Antworten.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Menschliches Lesen von Dokumenten</strong>
                  <span className="text-muted-foreground text-sm">Sie müssen immer noch manuell über 100 Seiten lesen, um die tatsächlichen Anforderungen und versteckten rechtlichen Einschränkungen zu finden.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Langsame Go/No-Go-Entscheidungen</strong>
                  <span className="text-muted-foreground text-sm">Es dauert Tage, eine Chance zu bewerten, was das Risiko von verlorenen Kosten für nicht gewinnbare Bids erhöht.</span>
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
                  <strong className="block text-foreground mb-1">Automatischer Realitätscheck</strong>
                  <span className="text-muted-foreground text-sm">Keine zu pflegenden Bibliotheken. Die KI extrahiert sofort die spezifischen Anforderungen genau des vorliegenden Dokuments.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Sofortige Compliance-Matrizen</strong>
                  <span className="text-muted-foreground text-sm">Findet automatisch jedes "MUSS", "SOLL" und "KANN", damit Sie keine disqualifizierenden Kriterien übersehen.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Go/No-Go in Minuten</strong>
                  <span className="text-muted-foreground text-sm">Deckt Show-Stopper und kommerzielle Risiken sofort auf und spart Ihrem Bid-Team Hunderte von Stunden.</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Feature Specifics */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard
            title="Schreiben vs. Qualifizieren"
            icon={<ShieldCheck className="w-6 h-6 text-blue-400" />}
          >
            <p className="mb-4">
              Traditionelle Software konzentriert sich ganz darauf, Antworten schneller einzutippen. Sie fungiert als "Autovervollständigung" für Angebote. Obwohl das hilfreich ist, löst es das falsche Problem.
            </p>
            <p>
              TenderPilot konzentriert sich auf <strong>Qualifizierung und Risiko-Extraktion.</strong> Wir glauben, dass der schwerste Teil einer Ausschreibung darin besteht, zu verstehen, was wirklich verlangt wird, eine Compliance-Matrix zu erstellen und die initiale Go/No-Go-Entscheidung zu treffen.
            </p>
          </GlassCard>

          <GlassCard
            title="Starre Tabellen vs. Dynamische KI"
            icon={<Scale className="w-6 h-6 text-purple-400" />}
          >
            <p className="mb-4">
              Veraltete Systeme zwingen Sie dazu, zeilenweise Excel-Tabellen zu importieren. Moderne öffentliche Ausschreibungen werden jedoch in komplexen PDFs voller juristischer Klauseln bereitgestellt.
            </p>
            <p>
              TenderPilot erfasst große, unstrukturierte PDFs und versteht nativ den Kontext, wobei das gesamte Dokument sicher und simultan analysiert wird.
            </p>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">
              Bereit, Ihr Bid-Management zu verbessern?
            </h3>
            <p className="text-muted-foreground mb-8">
              Vergessen Sie manuelle Inhaltsbibliotheken. Extrahieren Sie Ihre erste Compliance-Matrix in Sekunden.
            </p>

            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href={primaryCtaHref}>TenderPilot jetzt testen</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
