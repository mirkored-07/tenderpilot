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
  // CRITICAL FOR SEO: This resolves all relative social image URLs
  metadataBase: new URL("https://www.trytenderpilot.com"),
  
  title: {
    default: "TenderPilot - AI Tender Analysis & Risk Assessment",
    template: "%s | TenderPilot",
  },
  description: "The Friday 4PM solution. Upload complex tender PDFs and get instant go/no-go decision support, risk analysis, and compliance checklists.",
  keywords: [
    "Tender Analysis AI",
    "RFP Review Software",
    "Bid/No-Bid Decision",
    "Procurement Risk Assessment",
    "Automated Tender Summary",
    "Proposal Management Tool",
  ],
  authors: [{ name: "TenderPilot Team" }],
  creator: "TenderPilot",
  publisher: "TenderPilot",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Stop Reading. Start Deciding.",
    description: "Instant risk analysis and compliance checklists for public tenders. Make your Go/No-Go decision in minutes, not hours.",
    url: "https://www.trytenderpilot.com",
    siteName: "TenderPilot",
    locale: "en_US",
    type: "website",
    // Images will now resolve correctly because of metadataBase
    images: [
      {
        url: "/og-image.jpg", // Make sure you have an image at public/og-image.jpg
        width: 1200,
        height: 630,
        alt: "TenderPilot Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderPilot - AI Tender Analysis",
    description: "Automated risk analysis for RFPs and Tenders.",
    creator: "@tenderpilot", 
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}