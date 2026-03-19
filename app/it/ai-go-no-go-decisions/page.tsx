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
  title: "Decisioni Go/No-Go con l'IA per Bandi e Gare | TenderPilot",
  description: "Scopri come prendere decisioni in modo rapido e consapevole riducendo i rischi e i costi di prevendita.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/it/ai-go-no-go-decisions",
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
  const dict = (await import("@/dictionaries/it.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    description: "Software IA per decisioni Go/No-Go e gestione gare rapide e sicure.",
    featureList: [
      "Decisioni Go/No-Go automatizzate",
      "Estrazione requisiti per bandi di gara",
      "Identificazione dei rischi",
      "Creazione istantanea di Matrici di Compliance",
    ],
    url: "https://www.trytenderpilot.com/it/ai-go-no-go-decisions",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/it" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/it/how-it-works" className="hover:text-foreground">Come funziona</Link>
            <Link href="/it/sample" className="hover:text-foreground">Vedi esempio</Link>
          </nav>
          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Inizia ora</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            Modello IA specializzato per le gare
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Decisioni Go/No-Go con l'IA <br />
            <span className="text-gradient-brand">per Bandi e RFP</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Smetti di perdere tempo leggendo migliaia di pagine non pertinenti. Prendi decisioni informate e trasparenti in un batter d'occhio.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 items-center">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href="/it/sample">Vedi un esempio</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              Utilizzato da numerosi consulenti per le gare pubbliche
            </span>
          </div>
        </section>

        {/* Content cards */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard title="Perché i Go/No-Go sono così complessi?" icon={<ShieldAlert className="w-6 h-6 text-blue-400" />}>
            <p className="mb-6">
              Ottenere una chiara comprensione delle richieste d'offerta e del reale dispendio ingegneristico necessario richiede ore di interpretazione.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Requisiti critici nascosti tra i meandri dei PDF lunghissimi.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Metodi di qualificazione poco espliciti.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Clusole contrattuali penalizzanti scoperte troppo tardi.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Tempi sfavorevoli per coinvolgere in tempo il Team Tecnico.</li>
            </ul>
          </GlassCard>

          <GlassCard title="Come l'IA aiuta il Processo Decisore" icon={<Sparkles className="w-6 h-6 text-purple-400" />}>
            <p className="mb-4">
              La IA è uno strumento di acceleratore delle informazioni determinanti. Non è deputata alla decisione per se stessa, bensì alla comprensione immediata.
            </p>
            <p className="mb-8">
              Oltre l'estrazione l'IA classifica le insidie.{" "}
              <Link href="/it/how-to-automate-go-no-go-decisions" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                Guida su come automatizzare la qualificazione dell'offerta.
              </Link>
            </p>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Requisiti</div>
                <div>L'IA ordina secondo un indice di importanza le clausole imprescindibili.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Rischi</div>
                <div>L'algoritmo avvisa istantaneamente se una certa clausola contrattuale rappresenta un Dealbreaker.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Criteri Decisionali</div>
                <div>I riassunti generati dall'AGI vanno al punto evitando futili distorsioni dell'attenzione.</div>
              </div>
            </div>
          </GlassCard>

          <div className="md:col-span-2">
            <GlassCard title="In che modo TenderPilot supporta le decisioni con L'IA" icon={<ListChecks className="w-6 h-6 text-emerald-400" />}>
              <p className="mb-8">
                TenderPilot è studiato espressamente per farti risparmiare tempo ed evitare spiacevoli conseguenze per un lavoro che avresti rifiutato se solo ne avessi colto le dinamiche nascoste in tempo.
              </p>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Riassunto per C-Level</div>
                  <div>Consegna a un Manager solo il succo del discorso.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Piena aderenza al capitolato</div>
                  <div>Verifica tutti i must ed evita squalifiche dell'offerta dopo giorni di lavoro.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Identificazione proattiva dei pericoli</div>
                  <div>Fatti avvisare di incongruenze per tempo ed informati tramite contenzioso sul disciplinare.</div>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="md:col-span-2">
            <GlassCard title="Per chi è raccomandato il modello decisonale basato sull'IA di TenderPilot?">
              <div className="grid gap-6 md:grid-cols-2">
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Bid Manager con decine di Gare</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Agenzie di consulenze sul MePA</li>
                </ul>
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Dirigenti operativi della Pubblica Amministrazione.</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> PMI interessate al Mercato Pubblico Mepa.</li>
                </ul>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-8">
          <GlassCard title="Domande Frequenti sulla IA per i Bandi">
            <div className="grid gap-6 md:grid-cols-2 mt-4">
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">TenderPilot è il software migliore per i Go/No-Go?</div>
                <div>
                  Noi ne siamo fermamente convinti. È stato modellato con cura per questo preciso unico scopo. Non è un tool generico in grado di fare tutto male, ma eccelle nel suo lavoro. 
                  <Link href="/it/tenderpilot-vs-traditional-rfp-software" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Compara TenderPilot alle vecchie glorie.
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">TenderPilot accetta PDF di grandi dimensioni Scannerizzati?</div>
                <div>
                  Assolutamente sì. Accetta qualsiasi tipo di Documento Testuale o OCR, fino a centinaia di Pagine per volta, evidenziando ciò che ti nascondono.
                  <Link href="/it/how-to-automate-go-no-go-decisions" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Approfondisci le tecniche del programma.
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">Migliora lo screening dei Capitolati d'Appalto</h3>
            <p className="text-muted-foreground mb-8">Nessun umano sa elaborare tante info assieme simultaneamente. Prendi la palla al balzo.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
