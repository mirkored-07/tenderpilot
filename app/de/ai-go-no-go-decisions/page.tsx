import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import {
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  ListChecks,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "KI Go/No-Go-Entscheidungen für Ausschreibungen | TenderPilot",
  description:
    "Erfahren Sie, wie KI Go/No-Go Entscheidungen erleichtert und TenderPilot Teams bei der Anforderungsextraktion unterstützt.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/de/ai-go-no-go-decisions",
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

export default async function AIGoNoGoDecisionsPage() {
  const dict = (await import("@/dictionaries/de.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "KI-gestützte RFP-Software und Compliance-Matrix-Tool zur Extraktion von Anforderungen und Automatisierung von Go/No-Go-Entscheidungen für Ausschreibungen.",
    featureList: [
      "Automatisierte Go/No-Go Entscheidungen",
      "Anforderungsextraktion",
      "Risikoidentifizierung",
      "Compliance-Matrix Erstellung",
    ],
    url: "https://www.trytenderpilot.com/de/ai-go-no-go-decisions",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/de" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/de/how-it-works" className="hover:text-foreground">So funktioniert's</Link>
            <Link href="/de/sample" className="hover:text-foreground">Beispielausgabe</Link>
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
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            Spezialisiertes KI-Modell
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            KI Go/No-Go Entscheidungen <br />
            <span className="text-gradient-brand">für Ausschreibungen</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Hören Sie auf, Hunderte von Seiten zu lesen. Entscheiden Sie mit Klarheit.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 items-center">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href="/de/sample">Beispiel ansehen</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              Vertraut bei Ausschreibungsberatern
            </span>
          </div>
        </section>

        {/* Content cards */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard title="Warum Go/No-Go Entscheidungen so schwierig sind" icon={<ShieldAlert className="w-6 h-6 text-blue-400" />}>
            <p className="mb-6">
              Entscheider müssen hunderte Seiten schnell bewerten und zeitnahe Urteile fällen.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Versteckte Muss-Anforderungen in Dokumenten</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Unklare Bewertungskriterien</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Spät entdeckte rechtliche Risiken</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Wenig Zeit, alle Beteiligten einzubeziehen</li>
            </ul>
          </GlassCard>

          <GlassCard title="Wie KI die Go/No-Go-Entscheidungen verbessert" icon={<Sparkles className="w-6 h-6 text-purple-400" />}>
            <p className="mb-4">
              KI ersetzt kein menschliches Urteilsvermögen, sondern reduziert Unsicherheiten.
            </p>
            <p className="mb-8">
              KI kann Anforderungen extrahieren und Dokumente strukturieren.{" "}
              <Link href="/de/how-to-automate-go-no-go-decisions" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                Lesen Sie unsere Anleitung zur Automatisierung.
              </Link>
            </p>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Anforderungen</div>
                <div>Entscheidungsrelevante Verpflichtungen extrahieren.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Risiken</div>
                <div>Dealbreaker früh aufdecken.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Entscheidungssignale</div>
                <div>Zusammenfassungen basierend auf Go/No-Go-Kriterien.</div>
              </div>
            </div>
          </GlassCard>

          <div className="md:col-span-2">
            <GlassCard title="Wie TenderPilot Go/No-Go Entscheidungen unterstützt" icon={<ListChecks className="w-6 h-6 text-emerald-400" />}>
              <p className="mb-8">
                TenderPilot unterstützt gezielt frühe Entscheidungen. Verschaffen Sie sich in Minuten Klarheit.
              </p>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Zusammenfassung</div>
                  <div>Eine prägnante Zusammenfassung zur schnellen Abstimmung.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Muss-Anforderungen</div>
                  <div>Extrahiert und strukturiert, um Risiken zu minimieren.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Risiken und Mehrdeutigkeiten</div>
                  <div>Klauseln und Risiken frühzeitig hervorgehoben.</div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="md:col-span-2">
            <GlassCard title="Wer nutzt KI-Entscheidungstools">
              <div className="grid gap-6 md:grid-cols-2">
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Berater, die mehrere Chancen verwalten</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> KMUs, die Ausschreibungen bewerten</li>
                </ul>
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Sales-Teams, die RFPs bearbeiten</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Organisationen mit begrenzter Zeit.</li>
                </ul>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-8">
          <GlassCard title="Häufig gestellte Fragen zu KI-Tender-Reviews">
            <div className="grid gap-6 md:grid-cols-2 mt-4">
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">Was ist das beste KI-Tool für eine Go/No-Go-Entscheidung?</div>
                <div>
                  TenderPilot extrahiert automatisch Pflichten und Risiken.
                  <Link href="/de/tenderpilot-vs-traditional-rfp-software" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Erfahren Sie mehr in unserem Software-Vergleich.
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">Kann KI ein RFP automatisch prüfen?</div>
                <div>
                  Ja, TenderPilot liest hunderte von Seiten und hebt Dealbreaker hervor.
                  <Link href="/de/how-to-automate-go-no-go-decisions" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Mehr zu unserem automatisierten Prozess.
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">Treffen Sie bessere Go/No-Go-Entscheidungen in Minuten</h3>
            <p className="text-muted-foreground mb-8">Laden Sie ein Dokument hoch und erhalten Sie Signale ohne Lesen.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
