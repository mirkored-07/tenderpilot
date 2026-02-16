import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trytenderpilot.com"),
  title: {
    default: "TenderPilot — Analisi Gare & RFP con AI",
    template: "%s | TenderPilot",
  },
  description:
    "Analisi di gare d’appalto e RFP con AI per supportare decisioni go/no-go e preparare l’offerta in pochi minuti.",
  alternates: {
    canonical: "/it",
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
    title: "TenderPilot — Analisi Gare & RFP con AI",
    description:
      "Carica una gara/RFP e ottieni requisiti, rischi e una struttura offerta pronta in pochi minuti.",
    url: "/it",
    siteName: "TenderPilot",
    locale: "it_IT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderPilot — Analisi Gare & RFP con AI",
    description:
      "Analizza gare/RFP in pochi minuti: requisiti, rischi e struttura offerta pronta.",
  },
};

export default function ItalianLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.trytenderpilot.com/it",
    inLanguage: "it",
    description:
      "Analisi di gare d’appalto e RFP con AI per supportare decisioni go/no-go e preparare l’offerta in pochi minuti.",
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
