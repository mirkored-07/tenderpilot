import type { Metadata } from "next";
import { LandingPageContent } from "@/components/marketing/LandingPageContent";

export const metadata: Metadata = {
  title: "TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs — AI Tender & RFP Analysis",
  description:
    "Analyze tenders and RFPs in minutes: mandatory requirements, risks, checklists, and a proposal-ready outline for faster go/no-go decisions.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/en",
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

export default async function LandingPageEn() {
  const dict = (await import("@/dictionaries/en.json")).default as any;

  return <LandingPageContent localePrefix="/en" nav={dict.nav} dict={dict.landing} />;
}
