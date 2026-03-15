import type { Metadata } from "next";
import { LandingPageContent } from "@/components/marketing/LandingPageContent";

export const metadata: Metadata = {
  title: "TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs — Analyse d’appels d’offres & RFP par IA",
  description:
    "Analysez appels d’offres et RFP en minutes : exigences obligatoires, risques, checklist et structure de réponse pour des décisions go/no-go plus rapides.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/fr",
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

export default async function LandingPageFr() {
  const dict = (await import("@/dictionaries/fr.json")).default as any;

  return <LandingPageContent localePrefix="/fr" nav={dict.nav} dict={dict.landing} />;
}
