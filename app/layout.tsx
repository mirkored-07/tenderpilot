import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageFixer } from "@/components/marketing/LanguageFixer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trytenderpilot.com"),
  title: {
    default: "TenderPilot - RFP Response Software & Automated Compliance Matrix",
    template: "%s | TenderPilot",
  },
  description:
    "TenderPilot is the premier AI-powered RFP response software and automated compliance matrix tool. Instantly extract MUST/SHOULD requirements, identify risks, and make Go/No-Go decisions in seconds.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  keywords: [
    "RFP response software",
    "Automated compliance matrix",
    "AI bid management",
    "Tender go/no-go tool",
    "Proposal automation software",
    "Bid qualification software",
    "Tender compliance software",
    "Go/no-go decision software",
    "Proposal compliance matrix",
    "Public tender response software",
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
    title: "TenderPilot - RFP Response Software & Automated Compliance Matrix",
    description:
      "TenderPilot is the premier AI-powered RFP response software and automated compliance matrix tool. Instantly extract MUST/SHOULD requirements, identify risks, and make Go/No-Go decisions in seconds.",
    url: "https://www.trytenderpilot.com",
    siteName: "TenderPilot",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "TenderPilot Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderPilot - RFP Response Software & Automated Compliance Matrix",
    description:
      "TenderPilot is the premier AI-powered RFP response software and automated compliance matrix tool. Instantly extract MUST/SHOULD requirements, identify risks, and make Go/No-Go decisions in seconds.",
    creator: "@tenderpilot",
    images: [
      {
        url: "/twitter-image.png",
        alt: "TenderPilot",
      },
    ],
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

// Blocking, pre-paint forward to /auth/callback when Supabase drops users on marketing routes.
const TP_AUTH_FORWARD_SCRIPT = `
(function () {
  try {
    // Avoid loops
    if (window.__tpAuthForwarded) return;

    var u = new URL(window.location.href);
    if (u.pathname.indexOf("/auth/callback") === 0) return;

    var sp = u.searchParams;

    // Supabase may provide different params depending on flow/config:
    // - PKCE: ?code=...
    // - older/other flows: ?token_hash=...&type=magiclink|recovery
    var code = sp.get("code");
    var tokenHash = sp.get("token_hash");
    var type = sp.get("type");

    var looksLikeAuth =
      (!!code && (code.length >= 12 || type === "magiclink" || type === "recovery")) ||
      (!!tokenHash && (tokenHash.length >= 12 || type === "magiclink" || type === "recovery"));

    if (!looksLikeAuth) return;

    window.__tpAuthForwarded = true;

    u.pathname = "/auth/callback";
    // keep query as-is (includes next= if present)
    window.location.replace(u.toString());
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TP_AUTH_FORWARD_SCRIPT }} />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageFixer />

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}