import type { Metadata } from "next";
import { LandingPageContent } from "@/components/marketing/LandingPageContent";

export const metadata: Metadata = {
  title: "TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs — Analisi Gare & RFP con AI",
  description:
    "Analizza bandi e RFP in pochi minuti: requisiti obbligatori, rischi, checklist e struttura dell’offerta per decisioni go/no-go più rapide.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/it",
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

export default async function LandingPageIt() {
  const dict = (await import("@/dictionaries/it.json")).default as any;

  return <LandingPageContent localePrefix="/it" nav={dict.nav} dict={dict.landing} />;
}
