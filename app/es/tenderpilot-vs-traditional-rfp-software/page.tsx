import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import { CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "TenderPilot vs. Software RFP Tradicional | Comparación",
  alternates: { canonical: "https://www.trytenderpilot.com/es/tenderpilot-vs-traditional-rfp-software" },
};

export default async function ComparisonPage() {
  const dict = (await import("@/dictionaries/es.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/es" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent"><BrandIcon size={35} className="h-8 w-8" /></div>
            <span>{nav.title}</span>
          </Link>
          <Button asChild size="sm" className="rounded-full"><Link href={primaryCtaHref}>Empezar Ahora</Link></Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <section className="max-w-4xl mx-auto text-center mb-20">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">TenderPilot vs.<br /><span className="text-gradient-brand">Software RFP Tradicional</span></h1>
        </section>

        <section className="grid gap-8 mb-20 md:grid-cols-2">
          {/* Traditional Software */}
          <div className="glass-card p-8 rounded-3xl border border-red-500/20 overflow-hidden relative">
            <h2 className="text-2xl font-bold tracking-tight leading-snug mb-8">Software Tradicional</h2>
            <ul className="space-y-6">
              <li className="flex gap-4 items-start"><XCircle className="w-6 h-6 text-red-400 shrink-0" /><div><strong className="block text-foreground mb-1">Bibliotecas Manuales</strong><span className="text-muted-foreground text-sm">Requiere horas incontables configurando búsquedas guardadas.</span></div></li>
              <li className="flex gap-4 items-start"><XCircle className="w-6 h-6 text-red-400 shrink-0" /><div><strong className="block text-foreground mb-1">Lectura Humana</strong><span className="text-muted-foreground text-sm">Tienes que leer cientos de páginas para los requisitos legales.</span></div></li>
            </ul>
          </div>
          {/* TenderPilot */}
          <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 overflow-hidden relative">
            <h2 className="text-2xl font-bold tracking-tight leading-snug mb-8">TenderPilot</h2>
            <ul className="space-y-6">
              <li className="flex gap-4 items-start"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /><div><strong className="block text-foreground mb-1">Matriz de Cumplimiento Instantánea</strong><span className="text-muted-foreground text-sm">Calcula requisitos automáticamente.</span></div></li>
              <li className="flex gap-4 items-start"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /><div><strong className="block text-foreground mb-1">Go/No-Go Automático</strong><span className="text-muted-foreground text-sm">Destaca cláusulas comerciales peligrosas.</span></div></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
