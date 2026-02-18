import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trytenderpilot.com"),
  title: {
    default: "TenderPilot — Análisis de licitaciones y RFP con IA",
    template: "%s | TenderPilot",
  },
  description:
    "Análisis de licitaciones y RFP con IA para apoyar decisiones go/no-go y preparar una propuesta estructurada en minutos.",
  alternates: {
    canonical: "/es",
    languages: {
      en: "/en",
      de: "/de",
      it: "/it",
      fr: "/fr",
      es: "/es",
      "x-default": "/en",
    },
  },
  openGraph: {
    title: "TenderPilot — Análisis de licitaciones y RFP con IA",
    description:
      "Carga una licitación o RFP y obtén requisitos, riesgos y una estructura de propuesta lista en minutos.",
    url: "/es",
    siteName: "TenderPilot",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderPilot — Análisis de licitaciones y RFP con IA",
    description:
      "Analiza licitaciones y RFP en minutos: requisitos, riesgos y estructura de propuesta.",
  },
};

export default function SpanishLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.trytenderpilot.com/es",
    inLanguage: "es",
    description:
      "Análisis de licitaciones y RFP con IA para apoyar decisiones go/no-go y preparar una propuesta estructurada en minutos.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
