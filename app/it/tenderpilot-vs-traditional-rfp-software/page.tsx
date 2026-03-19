import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import { CheckCircle2, XCircle, Clock, Zap, ShieldCheck, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "TenderPilot vs. Software RFP Tradizionale | Confronto",
  alternates: { canonical: "https://www.trytenderpilot.com/it/tenderpilot-vs-traditional-rfp-software" },
};

function GlassCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="glass-card p-8 rounded-3xl border border-white/10 overflow-hidden">
      <div className="flex items-start gap-4 mb-5">
        {icon && <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground shadow-inner">{icon}</div>}
        <h2 className="text-xl font-bold tracking-tight leading-snug">{title}</h2>
      </div>
      <div className="text-muted-foreground leading-relaxed text-sm md:text-base">{children}</div>
    </div>
  );
}

export default async function ComparisonPage() {
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <section className="max-w-4xl mx-auto text-center mb-20">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">TenderPilot vs.<br /><span className="text-gradient-brand">Software RFP Tradizionale</span></h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Scopri perché l'estrazione IA dei requisiti è migliore della ricerca legacy per le gare d'appalto.
          </p>
        </section>

        <section className="grid gap-8 mb-20 md:grid-cols-2">
          {/* Traditional Software */}
          <div className="glass-card p-8 rounded-3xl border border-red-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
            <div className="flex items-start gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-inner"><Clock className="w-6 h-6" /></div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug">Software Legacy</h2>
            </div>
            <ul className="space-y-6">
              <li className="flex gap-4 items-start"><XCircle className="w-6 h-6 text-red-400 shrink-0" /><div><strong className="block text-foreground mb-1">Librerie Manuali</strong><span className="text-muted-foreground text-sm">Richiedono ore di aggiornamento.</span></div></li>
              <li className="flex gap-4 items-start"><XCircle className="w-6 h-6 text-red-400 shrink-0" /><div><strong className="block text-foreground mb-1">Lettura Umana</strong><span className="text-muted-foreground text-sm">Devi leggere centinaia di pagine per trovare i vincoli.</span></div></li>
            </ul>
          </div>
          {/* TenderPilot */}
          <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <div className="flex items-start gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner"><Zap className="w-6 h-6" /></div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug">TenderPilot</h2>
            </div>
            <ul className="space-y-6">
              <li className="flex gap-4 items-start"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /><div><strong className="block text-foreground mb-1">Matrici di Conformità</strong><span className="text-muted-foreground text-sm">Trova automaticamente DEVERÀ e DOVRÀ.</span></div></li>
              <li className="flex gap-4 items-start"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /><div><strong className="block text-foreground mb-1">Go/No-Go Immediato</strong><span className="text-muted-foreground text-sm">Evidenzia i rischi commerciali per bloccare offerte perdenti.</span></div></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
