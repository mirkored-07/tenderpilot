import type { Metadata } from "next";
import { PricingContent } from "@/components/marketing/PricingContent";

export const metadata: Metadata = {
  title: "Prezzi | TenderPilot",
  description:
    "Prezzi semplici per TenderPilot: inizia gratis e passa a un piano superiore quando ti serve più volume. I crediti corrispondono alle analisi dei bandi con output pronto per la decisione.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/it/pricing",
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

export default async function PricingPageIt() {
  const dict = (await import("@/dictionaries/it.json")).default as any;
  return <PricingContent localePrefix="/it" nav={dict.nav} dict={dict.pricingPage} />;
}
