import type { Metadata } from "next";
import { PricingContent } from "@/components/marketing/PricingContent";

export const metadata: Metadata = {
  title: "Tarifs | TenderPilot",
  description:
    "Tarifs simples pour TenderPilot: commencez gratuitement et passez à une offre supérieure lorsque vous avez besoin de plus de volume. Les crédits correspondent aux analyses d'appels d'offres avec un résultat prêt pour la décision.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/fr/pricing",
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

export default async function PricingPageFr() {
  const dict = (await import("@/dictionaries/fr.json")).default as any;
  return <PricingContent localePrefix="/fr" nav={dict.nav} dict={dict.pricingPage} />;
}
