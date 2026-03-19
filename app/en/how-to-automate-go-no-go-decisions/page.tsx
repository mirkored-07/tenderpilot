import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import {
  FileText,
  ScanSearch,
  AlertTriangle,
  Target,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "How to Automate Go/No-Go Decisions for Proposals | TenderPilot",
  description:
    "A step-by-step guide on how to automate RFP Go/No-Go decisions. Learn how to extract requirements and surface risks in minutes with AI.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/en/how-to-automate-go-no-go-decisions",
  },
};

function GlassCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="glass-card p-8 rounded-3xl border border-white/10 overflow-hidden">
      <div className="flex items-start gap-4 mb-5">
        {icon ? (
          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground shadow-inner">
            {icon}
          </div>
        ) : null}
        <h2 className="text-xl font-bold tracking-tight leading-snug">{title}</h2>
      </div>
      <div className="text-muted-foreground leading-relaxed text-sm md:text-base">
        {children}
      </div>
    </div>
  );
}

export default async function HowToGuidePage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Automate Go/No-Go Decisions for Tenders & RFPs",
    description: "A step-by-step guide to using AI to instantly qualify bids and tenders, extracting compliance matrices and risks.",
    step: [
      {
        "@type": "HowToStep",
        name: "Upload your RFP documents",
        text: "Gather all tender PDFs, technical specs, and legal clauses. Upload them securely into an AI bid qualification tool like TenderPilot."
      },
      {
        "@type": "HowToStep",
        name: "Extract the Compliance Matrix",
        text: "Let the AI parse the documents to identify every 'MUST' and 'SHALL' requirement automatically, grouping them logically."
      },
      {
        "@type": "HowToStep",
        name: "Identify Commercial & Legal Risks",
        text: "The AI highlights ambiguous terms, extreme penalties, tight deadlines, or deal-breaking constraints."
      },
      {
        "@type": "HowToStep",
        name: "Make a Data-Driven Go/No-Go Decision",
        text: "Review the automatically generated executive summary. If the risks outweigh your capabilities, make a safe 'No-Go' decision without wasting days of manual reading."
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/en"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <div className="h-8 w-8 flex items-center justify-center bg-transparent">
              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>{nav.title}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/en/how-it-works" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="/en/sample" className="hover:text-foreground">
              Sample output
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full">
            <Link href={primaryCtaHref}>Start now</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-purple-400/80" />
            Step-by-Step Guide
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            How to Automate <br />
            <span className="text-gradient-brand">Go/No-Go Decisions</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mt-4">
            Learn how modern bid teams use Generative AI to slash qualification times from days to minutes.
          </p>
        </section>

        {/* Steps */}
        <section className="space-y-12 mb-20">
          <h2 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">The 4-Step Process</h2>

          <div className="relative border-l border-white/10 pl-8 ml-4 space-y-12">
            
            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-400" />
                Upload Your RFP Documents
              </h3>
              <p className="text-muted-foreground">
                The traditional way required distributing 150-page PDFs across your team and opening massive Excel spreadsheets. The automated way? Simply drag and drop the primary tender specs, attachments, and legal frameworks securely into your AI processing engine.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-blue-400">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <ScanSearch className="w-5 h-5 text-blue-400" />
                Auto-Extract the Compliance Matrix
              </h3>
              <p className="text-muted-foreground">
                TenderPilot's specialized model scans the documents specifically looking for obligations (e.g., words like "Must", "Shall", "Required"). It instantly generates a clean, structured compliance matrix itemizing exactly what the buyer demands, removing the human-error risk of missed requirements.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-orange-400">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Surface Commercial &amp; Legal Risks
              </h3>
              <p className="text-muted-foreground">
                It isn't just about what they want you to build; it's about what you lose if you fail. The AI flags hidden dealbreakers, such as unlimited liability clauses, unbalanced intellectual property rights, or impossible implementation deadlines, allowing your legal and technical leads to evaluate them immediately.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-[54px] top-1 bg-background border border-white/20 h-10 w-10 rounded-full flex items-center justify-center shadow-lg">
                <span className="font-bold text-purple-400">4</span>
              </div>
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-400" />
                Make the Final Decision Fast
              </h3>
              <p className="text-muted-foreground">
                Armed with an executive summary, a structured compliance matrix, and a list of flagged risks, your bid committee can meet on day 1 instead of day 5. If it's a "No-Go," you've just saved tens of thousands of dollars in wasted bid-writing hours. If it's a "Go," you proceed with crystal clarity.
              </p>
            </div>

          </div>
        </section>

        <section className="mt-12">
          <GlassCard title="Ready to try it yourself?">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4">
              <p className="text-sm">
                TenderPilot automates this entire Go/No-Go process natively. Stop guessing and start qualifying your bids securely today.
              </p>
              <Button asChild className="rounded-full shrink-0">
                <Link href={primaryCtaHref}>Try TenderPilot <ArrowRight className="w-4 h-4 ml-2"/></Link>
              </Button>
            </div>
          </GlassCard>
        </section>
      </main>
    </div>
  );
}
