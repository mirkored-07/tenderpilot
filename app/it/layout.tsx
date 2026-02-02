import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TenderPilot - Analisi Gare IA & Valutazione Rischi",
  description: "Carica PDF di gare complesse e ottieni supporto decisionale go/no-go immediato, analisi dei rischi e liste di controllo conformità.",
  alternates: {
    canonical: "/it", // Points to itself (Italian)
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
    locale: "it_IT",
    title: "TenderPilot - Smetti di Leggere. Inizia a Decidere.",
    description: "Analisi immediata dei rischi e checklist di conformità per appalti pubblici.",
  },
};

export default function ItalianLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}