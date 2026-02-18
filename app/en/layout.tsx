import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trytenderpilot.com"),
  title: "TenderPilot - AI Tender Analysis & Risk Assessment",
  description:
    "Upload complex tender PDFs and get instant go/no-go decision support, risk analysis, and compliance checklists.",
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      de: "/de",
      it: "/it",
      fr: "/fr",
      es: "/es",
      "x-default": "/en",
    },
  },
  openGraph: {
    locale: "en_US",
    title: "TenderPilot - Stop Reading. Start Deciding.",
    description: "Instant risk analysis and compliance checklists for public tenders.",
    url: "/en",
    siteName: "TenderPilot",
    type: "website",
  },
};

export default function EnglishLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.trytenderpilot.com/en",
    inLanguage: "en",
    description:
      "AI-powered tender and RFP analysis to support go/no-go decisions and proposal preparation.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
