import type { Metadata } from "next";
import { PricingContent } from "@/components/marketing/PricingContent";

export const metadata: Metadata = {
  title: "Pricing | TenderPilot",
  description:
    "Simple pricing for TenderPilot: start free, upgrade when you need more volume. Credits map to tender reviews and decision-grade outputs.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/pricing",
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

export default async function PricingPage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;
  return <PricingContent localePrefix="" nav={dict.nav} dict={dict.pricingPage} />;
}
