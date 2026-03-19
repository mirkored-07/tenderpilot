import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import { FileText, ScanSearch, AlertTriangle, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Comment automatiser les décisions Go/No-Go | TenderPilot",
  alternates: { canonical: "https://www.trytenderpilot.com/fr/how-to-automate-go-no-go-decisions" },
};

export default async function HowToGuidePage() {
  const dict = (await import("@/dictionaries/fr.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/fr" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent"><BrandIcon size={35} className="h-8 w-8" /></div>
            <span>{nav.title}</span>
          </Link>
          <Button asChild size="sm" className="rounded-full"><Link href={primaryCtaHref}>Démarrer</Link></Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-center">Comment automatiser les décisions <br /><span className="text-gradient-brand">Go/No-Go</span></h1>
        <section className="space-y-12 mt-16">
          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><FileText className="w-5 h-5 text-emerald-400" />1. Téléchargez vos documents</h3>
              <p className="text-muted-foreground">Transférez tous les documents de l'appel d'offres de manière sécurisée.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><ScanSearch className="w-5 h-5 text-blue-400" />2. Extrayez la Matrice de Conformité</h3>
              <p className="text-muted-foreground">L'IA génère instantanément une matrice structurée des exigences de l'acheteur.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-orange-400" />3. Identifiez les Risques</h3>
              <p className="text-muted-foreground">Mettez en lumière les clauses cachées, les pénalités et les contraintes légales.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><Target className="w-5 h-5 text-purple-400" />4. Décision Rapide</h3>
              <p className="text-muted-foreground">Si c'est un "No-Go", vous venez d'économiser des milliers d'euros en heures de rédaction.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
