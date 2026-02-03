import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TenderPilot - Analyse d'Appels d'Offres IA & Gestion des Risques",
  description: "Téléchargez des PDF d'appels d'offres complexes et obtenez une aide à la décision go/no-go instantanée, une analyse des risques et des listes de conformité.",
  alternates: {
    canonical: "/fr", // Points to itself
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
    locale: "fr_FR",
    title: "TenderPilot - Arrêtez de Lire. Commencez à Décider.",
    description: "Analyse instantanée des risques et listes de contrôle de conformité pour les marchés publics.",
  },
};

export default function FrenchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}