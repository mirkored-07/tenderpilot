import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      de: "/de",
	  it: "/it",
	  es: "/es",
	  fr: "/fr",
    }
  },
  openGraph: {
    locale: "fr_FR"
  }
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
