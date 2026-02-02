import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      de: "/de",
	  it: "/it",
    }
  },
  openGraph: {
    locale: "it_IT"
  }
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
