import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      de: "/de",
	  it: "/it",
	  es: "/es",
    }
  },
  openGraph: {
    locale: "es_ES"
  }
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
