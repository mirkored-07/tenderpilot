import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trytenderpilot.com"),
  title: {
    default: "TenderPilot — KI für Ausschreibungs- & RFP-Analyse",
    template: "%s | TenderPilot",
  },
  description:
    "KI-gestützte Analyse von Ausschreibungen und RFPs: Anforderungen, Risiken und Go/No-Go-Entscheidungen in Minuten.",
  alternates: {
    canonical: "/de",
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
    title: "TenderPilot — KI für Ausschreibungs- & RFP-Analyse",
    description:
      "Ausschreibung/RFP hochladen und in Minuten Anforderungen, Risiken und eine Angebotsstruktur erhalten.",
    url: "/de",
    siteName: "TenderPilot",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderPilot — KI für Ausschreibungs- & RFP-Analyse",
    description:
      "Ausschreibungen/RFPs in Minuten analysieren: Anforderungen, Risiken und Angebotsstruktur.",
  },
};

export default function GermanLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.trytenderpilot.com/de",
    inLanguage: "de",
    description:
      "KI-gestützte Analyse von Ausschreibungen und RFPs, um Go/No-Go-Entscheidungen und die Angebotserstellung in Minuten zu unterstützen.",
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
