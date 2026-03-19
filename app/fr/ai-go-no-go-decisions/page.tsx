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
  title: "Décisions Go/No-Go IA pour Appels d'Offres | TenderPilot",
  description: "Découvrez pourquoi les décisions Go/No-Go sont difficiles et comment l'IA aide les équipes à extraire les exigences et les risques.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/fr/ai-go-no-go-decisions",
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
  const dict = (await import("@/dictionaries/fr.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    description: "Logiciel de réponse aux appels d'offres basé sur l'IA et matrice de conformité.",
    featureList: [
      "Décisions automatisées Go/No-Go",
      "Extraction des exigences d'appel d'offres",
      "Identification des risques RFP",
      "Génération de matrice de conformité",
    ],
    url: "https://www.trytenderpilot.com/fr/ai-go-no-go-decisions",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/fr" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/fr/how-it-works" className="hover:text-foreground">Comment ça marche</Link>
            <Link href="/fr/sample" className="hover:text-foreground">Exemple</Link>
          </nav>
          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Commencer</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            Modèle Décisionnel Spécialisé
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Décisions Go/No-Go IA <br />
            <span className="text-gradient-brand">pour Marchés Publics</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Cessez de gaspiller de l'argent et des ressources en qualifiant les offres de manière archaïque. Optez pour la clarté.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 items-center">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href="/fr/sample">Voir un exemple</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              La solution plébiscitée par les Bid Managers
            </span>
          </div>
        </section>

        {/* Content cards */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard title="Pourquoi les décisions s'avèrent si dures ?" icon={<ShieldAlert className="w-6 h-6 text-blue-400" />}>
            <p className="mb-6">
              Séparer le bon grain de l'ivraie lors de la lecture d'un cahier de charges volumineux est très compliqué.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Exigences cachées dans le volume d'informations.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Grilles mal configurées.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Délais impartis insuffisants.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Risques juridiques non décelés par des non-juristes.</li>
            </ul>
          </GlassCard>

          <GlassCard title="L'IA change la donne au bon moment" icon={<Sparkles className="w-6 h-6 text-purple-400" />}>
            <p className="mb-4">
              L'objectif de l'intelligence artificielle n'est pas de décider à notre place, mais de fournir de puissantes analyses.
            </p>
            <p className="mb-8">
              En filtrant et catégorisant les documents, l'outil débloque les goulots d'étranglement administratifs.{" "}
              <Link href="/fr/how-to-automate-go-no-go-decisions" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                Lire notre guide d'utilisation.
              </Link>
            </p>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Exigences</div>
                <div>L'IA ordonne et structure tous les 'Must'.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Risques</div>
                <div>Elle montre les clauses contractuelles potentiellement mortelles.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Signaux de Décision</div>
                <div>Pour une analyse synthétique au niveau comité.</div>
              </div>
            </div>
          </GlassCard>

          <div className="md:col-span-2">
            <GlassCard title="L'Apport de TenderPilot est Décisif" icon={<ListChecks className="w-6 h-6 text-emerald-400" />}>
              <p className="mb-8">
                TenderPilot élimine d'emblée les opportunités toxiques, maximisant votre taux de conversion pour les contrats auxquels vous choisissez de répondre en alignant l'équipe et les responsables commerciaux.
              </p>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Résumé exécutif</div>
                  <div>Rien que l'essentiel vital de la proposition.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Besoins exclusifs</div>
                  <div>Contrôle total sur l'adhérence technique.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Identification proactive</div>
                  <div>Alertes de non-conformité potentielles anticipées.</div>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="md:col-span-2">
            <GlassCard title="Qui est concerné par cet outil IA génératif dans ce secteur d'activité?">
              <div className="grid gap-6 md:grid-cols-2">
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Les Cabinets de consultants Appels d'Offres</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Les Responsables d'Offres IT/Telecom</li>
                </ul>
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Les directeurs commerciaux de l'industrie</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> PME européennes postulant à l'UE</li>
                </ul>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-8">
          <GlassCard title="Foire aux questions TenderPilot">
            <div className="grid gap-6 md:grid-cols-2 mt-4">
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">Cet outil est-il plus performant pour la prise de décision?</div>
                <div>
                  Il a été affiné sur des dizaines de milliers de processus d'achat. Il n'invente rien mais extrait habilement les clauses restrictives, accélérant grandement la validation humaine.
                  <Link href="/fr/tenderpilot-vs-traditional-rfp-software" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    TenderPilot face aux logiciels conventionnels.
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">Prend-il en charge l'analyse de gros contrats PDF?</div>
                <div>
                  Oui. Son architecture accepte d'énormes fichiers non structurés typiques des cahiers des clauses administratives et techniques.
                  <Link href="/fr/how-to-automate-go-no-go-decisions" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Voir notre système de revue en action.
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">La confiance dans vos opportunités s'accroît</h3>
            <p className="text-muted-foreground mb-8">Plus d'offres incertaines. Investissez sur de bons paris.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
