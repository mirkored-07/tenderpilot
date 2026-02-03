import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TenderPilot - KI-Ausschreibungsanalyse & Risikobewertung",
  description: "Laden Sie komplexe Ausschreibungs-PDFs hoch und erhalten Sie sofortige Go/No-Go-Entscheidungshilfen, Risikoanalysen und Compliance-Checklisten.",
  alternates: {
    canonical: "/de", // Points to itself (German)
    languages: {
      "en": "/en",
      "de": "/de",
      "it": "/it",
      "fr": "/fr",
      "es": "/es",
      "x-default": "/en",
    },
  },
  openGraph: {
    locale: "de_DE", // Important for German social sharing
    title: "TenderPilot - Schluss mit dem Lesen. Starten Sie das Entscheiden.",
    description: "Sofortige Risikoanalyse und Compliance-Checklisten für öffentliche Ausschreibungen.",
  },
};

export default function GermanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}