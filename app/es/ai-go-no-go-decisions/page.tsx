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
  title: "Decisiones Go/No-Go con IA para Licitaciones y RFP | TenderPilot",
  description: "Descubre cómo las decisiones pueden ser guiadas y validadas mediante el análisis automatizado de requerimientos y riesgos.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/es/ai-go-no-go-decisions",
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
  const dict = (await import("@/dictionaries/es.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    description: "Software para gestión y evaluación de pliegos de licitaciones con IA.",
    featureList: [
      "Decisiones Go/No-Go Inteligentes",
      "Extracción Automática de Requisitos",
      "Prevención de Riesgos Ocultos",
      "Matriz de Cumplimiento Inmediata",
    ],
    url: "https://www.trytenderpilot.com/es/ai-go-no-go-decisions",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/es" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/es/how-it-works" className="hover:text-foreground">Cómo funciona</Link>
            <Link href="/es/sample" className="hover:text-foreground">Ejemplo</Link>
          </nav>
          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Empezar ahora</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            La Solución Tecnológica Perfecta
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Decisiones Go/No-Go IA <br />
            <span className="text-gradient-brand">para Pliegos y Licitaciones</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Evita malgastar horas escudriñando pliegos ambiguos. La Inteligencia Artificial aclara el panorama en segundos de forma profesional.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 items-center">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href="/es/sample">Pruébalo gratis de muestra</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              Utilizado con éxito por directores de desarrollo de negocio
            </span>
          </div>
        </section>

        {/* Content cards */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard title="¿Cuál es la raíz del problema en la pre-licitación?" icon={<ShieldAlert className="w-6 h-6 text-blue-400" />}>
            <p className="mb-6">
              El análisis requiere la intervención de recursos altamente cualificados que pierden su precioso tiempo analizando el papeleo en lugar de ejecutándolo.
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Exclusión por incumplimiento de una minúscula viñeta perdida en un PDF.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Discrepancias notables en documentos anexos y aclaraciones.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Cláusulas disuasorias ignoradas.</li>
              <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Cronogramas poco realistas no advertidos.</li>
            </ul>
          </GlassCard>

          <GlassCard title="El Nuevo Paradigma Definitivo para Decidir" icon={<Sparkles className="w-6 h-6 text-purple-400" />}>
            <p className="mb-4">
              En lugar de delegar el proceso cognitivo a un humano exhausto, usar el analizador IA garantiza rigurosidad mecánica infalible.
            </p>
            <p className="mb-8">
              Al someter el pliego base al examen meticuloso, arrojará reportes imparciales.{" "}
              <Link href="/es/how-to-automate-go-no-go-decisions" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                Domina este proceso como consultor de la IA.
              </Link>
            </p>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Obligaciones Relevantes</div>
                <div>Extrae instantáneamente las reglas críticas e indispensables del licitador.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Puntos Calientes / Riesgos</div>
                <div>Alertas que marcan la línea roja de penalizaciones y responsabilidades ilimitadas.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Resumen Gerencial del Asunto</div>
                <div>Señalización del go o del no go, o de un simple hold comercial justificable.</div>
              </div>
            </div>
          </GlassCard>

          <div className="md:col-span-2">
            <GlassCard title="La Metodología Propuesta por TenderPilot es Transparente" icon={<ListChecks className="w-6 h-6 text-emerald-400" />}>
              <p className="mb-8">
                TenderPilot te dota del conocimiento preciso para el comité evaluador en la reunión semanal. Aporta un valor diferencial espectacular a coste de cero esfuerzo manual repetitivo, desgranando la complejidad normativa para ti.
              </p>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Visión global</div>
                  <div>Conoce a tu competidor entendiendo las especificaciones demandadas plenamente.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Seguimiento garantizado</div>
                  <div>Evita sustos en los criterios ponderados restrictivos.</div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">Proactividad legal asegurada</div>
                  <div>Evidencia puntos de contacto e interpretaciones oscuras.</div>
                </div>
              </div>
            </GlassCard>
          </div>
          <div className="md:col-span-2">
            <GlassCard title="Destinado para la Élite de Contrataciones">
              <div className="grid gap-6 md:grid-cols-2">
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Especialistas Comerciales Senior</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Directores Técnicos de Operaciones Involucrados</li>
                </ul>
                <ul className="space-y-3">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Coordinadores Legales Corporativos</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" /> Pymes de servicios IT en búsqueda de expansión pública</li>
                </ul>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-8">
          <GlassCard title="Preguntas Técnicas Habituales">
            <div className="grid gap-6 md:grid-cols-2 mt-4">
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">¿Es justificable su uso para un departamento de tres personas?</div>
                <div>
                  Sobre todo si el equipo es pequeño, la eficiencia es obligatoria. Aligerando el flujo lograrás presentar el doble de ofertas ganadoras en el mismo período trimestral.
                  <Link href="/es/tenderpilot-vs-traditional-rfp-software" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Comprueba por qué superamos al enfoque antiguo y conservador aburrido.
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="font-semibold text-foreground mb-2">¿Qué fiabilidad demuestran estos algoritmos en contratos legales de cientos de pliegos gubernamentales?</div>
                <div>
                  Total confiabilidad apoyada en los modelos de base y contextualización extensa RAG. Extrae y mapea, y muestra siempre su fuente verídica original, permitiendo la trazabilidad.
                  <Link href="/es/how-to-automate-go-no-go-decisions" className="block mt-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
                    Descubre el panel operativo en acción sin compromiso.
                  </Link>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">La Confianza es la Llave al Éxito Organizacional de Ventas</h3>
            <p className="text-muted-foreground mb-8">Pasa de nivel con TenderPilot, comienza sin fricciones y sube tus primeros pdfs gratis.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
