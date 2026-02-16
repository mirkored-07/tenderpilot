import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trytenderpilot.com"),
  title: {
    default: "TenderPilot — Analyse d’appels d’offres & RFP par IA",
    template: "%s | TenderPilot",
  },
  description:
    "Analyse des appels d’offres et RFP par IA pour aider aux décisions go/no-go et préparer une réponse structurée en quelques minutes.",
  alternates: {
    canonical: "/fr",
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
    title: "TenderPilot — Analyse d’appels d’offres & RFP par IA",
    description:
      "Téléversez un appel d’offres ou une RFP et obtenez exigences, risques et plan de réponse en quelques minutes.",
    url: "/fr",
    siteName: "TenderPilot",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderPilot — Analyse d’appels d’offres & RFP par IA",
    description:
      "Analysez appels d’offres/RFP en minutes : exigences, risques et structure de réponse.",
  },
};

export default function FrenchLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.trytenderpilot.com/fr",
    inLanguage: "fr",
    description:
      "Analyse des appels d’offres et RFP par IA pour aider aux décisions go/no-go et préparer une réponse structurée en quelques minutes.",
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
