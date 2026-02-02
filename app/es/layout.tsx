import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TenderPilot - Análisis de Licitaciones con IA y Evaluación de Riesgos",
  description: "Suba PDFs de licitaciones complejas y obtenga soporte instantáneo para decisiones go/no-go, análisis de riesgos y listas de verificación de cumplimiento.",
  alternates: {
    canonical: "/es", // Points to itself
    languages: {
      "en": "/en",
      "de": "/de",
      "it": "/it",
      "fr": "/fr",
      "es": "/es",
      "x-default": "/en",
    },
  },
  openGraph: {
    locale: "es_ES",
    title: "TenderPilot - Deja de Leer. Empieza a Decidir.",
    description: "Análisis instantáneo de riesgos y listas de verificación de cumplimiento para licitaciones públicas.",
  },
};

export default function SpanishLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}