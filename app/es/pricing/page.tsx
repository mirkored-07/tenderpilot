import type { Metadata } from "next";
import { PricingContent } from "@/components/marketing/PricingContent";

export const metadata: Metadata = {
  title: "Precios | TenderPilot",
  description:
    "Precios sencillos para TenderPilot: empieza gratis y sube de plan cuando necesites más volumen. Los créditos corresponden a análisis de licitaciones con un resultado listo para decidir.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/es/pricing",
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

export default async function PricingPageEs() {
  const dict = (await import("@/dictionaries/es.json")).default as any;
  return <PricingContent localePrefix="/es" nav={dict.nav} dict={dict.pricingPage} />;
}
