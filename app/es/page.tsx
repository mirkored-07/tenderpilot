import type { Metadata } from "next";
import { LandingPageContent } from "@/components/marketing/LandingPageContent";

export const metadata: Metadata = {
  title: "TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs — Análisis de licitaciones y RFP con IA",
  description:
    "Analiza licitaciones y RFP en minutos: requisitos obligatorios, riesgos, checklist y estructura de propuesta para decisiones go/no-go más rápidas.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/es",
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

export default async function LandingPageEs() {
  const dict = (await import("@/dictionaries/es.json")).default as any;

  return <LandingPageContent localePrefix="/es" nav={dict.nav} dict={dict.landing} />;
}
