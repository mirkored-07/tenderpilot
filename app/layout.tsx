import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // The "Template" puts your brand at the end of every page automatically
  // e.g. "Software Tenders | TenderPilot"
  title: {
    default: "TenderPilot - AI Bid Writing & Proposal Software",
    template: "%s | TenderPilot",
  },
  description: "Automate your public procurement. TenderPilot helps Austrian, German, and Italian SMEs analyze tenders, assess risks, and write proposals 10x faster with AI.",
  keywords: [
    "Tender Management Software",
    "AI Bid Writer",
    "Proposal Automation",
    "RFP Response Tool",
    "Tenders Electronic Daily",
    "Opentender Austria",
    "Gare d'appalto IA" // Italian Keyword
  ],
  openGraph: {
    title: "TenderPilot - Win More Tenders with AI",
    description: "Stop reading 200-page PDFs. Upload them to TenderPilot and get a risk analysis in seconds.",
    url: "https://www.trytenderpilot.com",
    siteName: "TenderPilot",
    locale: "en_EU",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
