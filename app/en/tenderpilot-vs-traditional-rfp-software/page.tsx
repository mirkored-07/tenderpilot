import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ShieldCheck,
  Scale,
} from "lucide-react";

export const metadata: Metadata = {
  title: "TenderPilot vs. Traditional RFP Software | Complete Comparison",
  description:
    "Compare TenderPilot with traditional RFP software and proposal management tools. See why AI-driven requirements extraction is better than legacy search.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/en/tenderpilot-vs-traditional-rfp-software",
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

export default async function ComparisonPage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "TenderPilot compared to traditional RFP tools. Learn how AI-powered requirements extraction differs from standard proposal management software.",
    url: "https://www.trytenderpilot.com/en/tenderpilot-vs-traditional-rfp-software",
  };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground mb-8">
            <span className="h-2 w-2 rounded-full bg-blue-400/80" />
            Software Comparison
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            TenderPilot vs. <br />
            <span className="text-gradient-brand">Traditional RFP Software</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Why rigid query-and-response libraries are failing modern bid teams, and how AI-native compliance extraction changes the game.
          </p>
        </section>

        {/* Feature Comparison Grid */}
        <section className="grid gap-8 mb-20 md:grid-cols-2">
          {/* Traditional Software */}
          <div className="glass-card p-8 rounded-3xl border border-red-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
            <div className="flex items-start gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug">Legacy RFP Software</h2>
            </div>
            
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Manual Content Libraries</strong>
                  <span className="text-muted-foreground text-sm">Requires hundreds of hours of manual tagging and library maintenance. Often returns outdated answers.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Human Document Reading</strong>
                  <span className="text-muted-foreground text-sm">You still have to manually read 100+ pages of the RFP to find the actual requirements and hidden legal constraints.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Slow Go/No-Go Decisions</strong>
                  <span className="text-muted-foreground text-sm">Takes days to evaluate an opportunity, risking sunk costs on un-winnable bids.</span>
                </div>
              </li>
            </ul>
          </div>

          {/* TenderPilot */}
          <div className="glass-card p-8 rounded-3xl border border-emerald-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <div className="flex items-start gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <Zap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight leading-snug text-foreground">TenderPilot</h2>
            </div>
            
            <ul className="space-y-6">
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Automated Reality Check</strong>
                  <span className="text-muted-foreground text-sm">No libraries to maintain. The AI instantly extracts the bespoke requirements for the exact document in front of you.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Instant Compliance Matrices</strong>
                  <span className="text-muted-foreground text-sm">Automatically finds every "MUST", "SHALL", and "SHOULD" so you don't miss disqualifying criteria.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-foreground mb-1">Go/No-Go in Minutes</strong>
                  <span className="text-muted-foreground text-sm">Surfaces show-stoppers and commercial risks instantly, rescuing hundreds of hours for your bid team.</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Feature Specifics */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard
            title="Focus on Writing vs. Focus on Qualifying"
            icon={<ShieldCheck className="w-6 h-6 text-blue-400" />}
          >
            <p className="mb-4">
              Traditional software focuses entirely on typing answers faster. They act as "autocomplete" for proposals. While helpful, it solves the wrong problem.
            </p>
            <p>
              TenderPilot focuses on <strong>qualification and risk extraction.</strong> We believe the hardest part of a tender is understanding what they actually want, creating a compliance matrix, and making the initial Go/No-Go decision.
            </p>
          </GlassCard>

          <GlassCard
            title="Rigid Spreadsheets vs. Dynamic AI"
            icon={<Scale className="w-6 h-6 text-purple-400" />}
          >
            <p className="mb-4">
              Legacy systems lock you into importing line-by-line Excel spreadsheets. But modern government RFPs are delivered in complex PDFs scattered with legal clauses.
            </p>
            <p>
              TenderPilot ingests massive, unstructured PDFs and natively understands the context, securely analyzing the entire document context simultaneously.
            </p>
          </GlassCard>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">
              Ready to upgrade your bid management?
            </h3>
            <p className="text-muted-foreground mb-8">
              Forget manual content libraries. Extract your first compliance matrix in seconds.
            </p>

            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href={primaryCtaHref}>Try TenderPilot Now</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
