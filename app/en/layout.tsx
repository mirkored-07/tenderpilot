import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TenderPilot - AI Tender Analysis & Risk Assessment",
  description: "Upload complex tender PDFs and get instant go/no-go decision support, risk analysis, and compliance checklists.",
  alternates: {
    canonical: "/en", // Points to itself
    languages: {
      "en": "/en",
      "de": "/de",
      "it": "/it",
      "fr": "/fr",
      "es": "/es",
      "x-default": "/en", // Fallback for unmatched languages
    },
  },
  openGraph: {
    locale: "en_US",
    title: "TenderPilot - Stop Reading. Start Deciding.",
    description: "Instant risk analysis and compliance checklists for public tenders.",
  },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}