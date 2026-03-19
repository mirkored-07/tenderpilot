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
  title: "Comment automatiser les décisions Go/No-Go pour les appels d'offres | TenderPilot",
  description:
    "Guide étape par étape sur la façon d'automatiser les décisions Go/No-Go RFP. Découvrez comment extraire les exigences et détecter les risques en quelques minutes avec l'IA.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/fr/how-to-automate-go-no-go-decisions",
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
  const dict = (await import("@/dictionaries/fr.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Comment automatiser les décisions Go/No-Go pour les appels d'offres et les RFP",
    description: "Un guide étape par étape pour utiliser l'IA afin de qualifier instantanément vos offres, en extrayant les matrices de conformité et les risques.",
    step: [
      {
        "@type": "HowToStep",
        name: "Téléchargez vos documents RFP",
        text: "Rassemblez tous les PDF d'appel d'offres, les spécifications techniques et les clauses juridiques. Téléchargez-les en toute sécurité dans un outil IA comme TenderPilot."
      },
      {
        "@type": "HowToStep",
        name: "Extrayez la matrice de conformité",
        text: "Laissez l'IA analyser les documents pour identifier automatiquement chaque exigence."
      },
      {
        "@type": "HowToStep",
        name: "Identifiez les risques commerciaux et juridiques",
        text: "L'IA met en évidence les termes ambigus, les pénalités extrêmes ou les délais serrés."
      },
      {
        "@type": "HowToStep",
        name: "Prenez une décision Go/No-Go",
        text: "Passez en revue le résumé exécutif généré automatiquement sans perdre des jours en lecture manuelle."
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
            href="/fr"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/fr/how-it-works" className="hover:text-foreground">
              Comment ça marche
            </Link>
            <Link href="/fr/sample" className="hover:text-foreground">
              Exemple
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Commencer</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-purple-400/80" />
            Guide étape par étape
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Comment Automatiser les <br />
            <span className="text-gradient-brand">Décisions Go/No-Go</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mt-4">
            Découvrez comment les équipes modernes d'appels d'offres utilisent l'IA générative pour réduire les temps de qualification de jours à quelques minutes.
          </p>
        </section>

        {/* Steps */}
        <section className="space-y-12 mb-20">
          <h2 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">Le Processus en 4 Étapes</h2>

          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            
            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-400" />
                Téléchargez Vos Documents RFP
              </h3>
              <p className="text-muted-foreground">
                Glissez-déposez simplement les spécifications techniques et les documents de l'appel d'offres dans votre IA de qualification.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-blue-400">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <ScanSearch className="w-5 h-5 text-blue-400" />
                Auto-Extrayez la Matrice de Conformité
              </h3>
              <p className="text-muted-foreground">
                TenderPilot recherche spécifiquement les obligations (par exemple, les termes tels que "Doit", "Exigé") et génère une matrice claire.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-orange-400">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Détectez les Risques Commerciaux
              </h3>
              <p className="text-muted-foreground">
                L'IA met en évidence les clauses cachées pour vous éviter de graves problèmes lors du projet.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-purple-400">4</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-400" />
                Prenez la Décision Finale
              </h3>
              <p className="text-muted-foreground">
                Armé d'un résumé détaillé, vous pouvez agir dès le premier jour de l'appel d'offres.
              </p>
            </div>

          </div>
        </section>

        <section className="mt-12">
          <GlassCard title="Prêt à l'essayer vous-même ?">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4">
              <p className="text-sm">
                TenderPilot automatise entièrement le processus Go/No-Go pour plus de sérénité.
              </p>
              <Button asChild className="rounded-full shrink-0">
                <Link href={primaryCtaHref}>Essayer TenderPilot <ArrowRight className="w-4 h-4 ml-2"/></Link>
              </Button>
            </div>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
