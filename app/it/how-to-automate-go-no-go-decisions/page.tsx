import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import { FileText, ScanSearch, AlertTriangle, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Come automatizzare le decisioni Go/No-Go | TenderPilot",
  alternates: { canonical: "https://www.trytenderpilot.com/it/how-to-automate-go-no-go-decisions" },
};

export default async function HowToGuidePage() {
  const dict = (await import("@/dictionaries/it.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/it" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent"><BrandIcon size={35} className="h-8 w-8" /></div>
            <span>{nav.title}</span>
          </Link>
          <Button asChild size="sm" className="rounded-full"><Link href={primaryCtaHref}>Inizia Ora</Link></Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-center">Come Automatizzare le Decisioni <br /><span className="text-gradient-brand">Go/No-Go</span></h1>
        <section className="space-y-12 mt-16">
          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><FileText className="w-5 h-5 text-emerald-400" />1. Carica i tuoi documenti</h3>
              <p className="text-muted-foreground">Trascina le specifiche tecniche e i documenti dell'appalto nell'IA.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><ScanSearch className="w-5 h-5 text-blue-400" />2. Estrai la Matrice di Conformità</h3>
              <p className="text-muted-foreground">Ottieni automaticamente un file strutturato con tutti i requisiti obbligatori.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-orange-400" />3. Identifica i Rischi Commerciali</h3>
              <p className="text-muted-foreground">Il sistema segnala penali, scadenze ristrette e vincoli legali non standard.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><Target className="w-5 h-5 text-purple-400" />4. Prendi la Decisione Finale</h3>
              <p className="text-muted-foreground">Grazie ai dati processati, se è "No-Go" eviti di sprecare risorse finanziarie preziose.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
