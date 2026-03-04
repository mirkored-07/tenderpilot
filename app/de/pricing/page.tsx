import type { Metadata } from "next";
import { PricingContent } from "@/components/marketing/PricingContent";

export const metadata: Metadata = {
  title: "Preise | TenderPilot",
  description:
    "Klare Preise für TenderPilot: kostenlos starten und upgraden, wenn mehr Volumen nötig ist. Credits entsprechen Tender-Analysen mit entscheidungsreifen Ergebnissen.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/de/pricing",
    languages: {
      en: "https://www.trytenderpilot.com/en/pricing",
      de: "https://www.trytenderpilot.com/de/pricing",
      it: "https://www.trytenderpilot.com/it/pricing",
      fr: "https://www.trytenderpilot.com/fr/pricing",
      es: "https://www.trytenderpilot.com/es/pricing",
      "x-default": "https://www.trytenderpilot.com/pricing",
    },
  },
};

export default async function PricingPageDe() {
  const dict = (await import("@/dictionaries/de.json")).default as any;
  return <PricingContent localePrefix="/de" nav={dict.nav} dict={dict.pricingPage} />;
}
