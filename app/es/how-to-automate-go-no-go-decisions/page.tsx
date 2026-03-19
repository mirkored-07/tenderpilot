import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import { FileText, ScanSearch, AlertTriangle, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Cómo Automatizar las Decisiones Go/No-Go | TenderPilot",
  alternates: { canonical: "https://www.trytenderpilot.com/es/how-to-automate-go-no-go-decisions" },
};

export default async function HowToGuidePage() {
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-center">Cómo Automatizar las Decisiones <br /><span className="text-gradient-brand">Go/No-Go</span></h1>
        <section className="space-y-12 mt-16">
          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><FileText className="w-5 h-5 text-emerald-400" />1. Sube tus Documentos</h3>
              <p className="text-muted-foreground">Reúne todos los documentos RFP de licitaciones de forma segura.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><ScanSearch className="w-5 h-5 text-blue-400" />2. Extrae la Matriz de Cumplimiento</h3>
              <p className="text-muted-foreground">La IA genera las reglas del comprador al instante.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-orange-400" />3. Identifica Riesgos Legales</h3>
              <p className="text-muted-foreground">Identifica sanciones severas o cláusulas dudosas antes de invertir horas.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3"><Target className="w-5 h-5 text-purple-400" />4. Toma la Decisión Final</h3>
              <p className="text-muted-foreground">Toma una decisión rápida de Go/No-Go para guardar los recursos de tu equipo.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
