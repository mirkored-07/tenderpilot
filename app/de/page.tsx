import type { Metadata } from "next";
import { LandingPageContent } from "@/components/marketing/LandingPageContent";

export const metadata: Metadata = {
  title: "TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs — KI für Ausschreibungs- & RFP-Analyse",
  description:
    "Ausschreibungen und RFPs in Minuten analysieren: Muss-Anforderungen, Risiken, Checklisten und Angebotsstruktur für schnellere Go/No-Go-Entscheidungen.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/de",
    languages: {
      en: "https://www.trytenderpilot.com/en",
      de: "https://www.trytenderpilot.com/de",
      it: "https://www.trytenderpilot.com/it",
      fr: "https://www.trytenderpilot.com/fr",
      es: "https://www.trytenderpilot.com/es",
      "x-default": "https://www.trytenderpilot.com/",
    },
  },
};

export default async function LandingPageDe() {
  const dict = (await import("@/dictionaries/de.json")).default as any;

  return <LandingPageContent localePrefix="/de" nav={dict.nav} dict={dict.landing} />;
}
