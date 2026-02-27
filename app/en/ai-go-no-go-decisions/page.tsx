import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";
import {
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  ListChecks,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Go/No-Go Decisions for Tenders & RFPs | TenderPilot",
  description:
    "Learn why Go/No-Go decisions are hard in tenders and how TenderPilot helps teams extract requirements and risks to decide faster and with more confidence.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/en/ai-go-no-go-decisions",
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

export default async function AIGoNoGoDecisionsPage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;
  const primaryCtaHref = loginWithNextHref("/app/upload");
  const nav = dict.nav as { title: string };

  return (
    <div className="min-h-screen bg-background aurora-bg">
      {/* Header (same shell style as your glass pages) */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/en"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            {/* transparent icon wrapper (no gradient background) */}
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
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            Specialized Tender AI Model
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            AI Go/No-Go Decisions <br />
            <span className="text-gradient-brand">for Tenders &amp; RFPs</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Stop reading hundreds of pages. Start deciding with clarity.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 items-center">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href="/en/sample">Try a sample</Link>
            </Button>

            {/* <Button
			  asChild
			  size="lg"
			  variant="outline"
			  className="rounded-full px-10 h-12 border-white/15 bg-transparent hover:bg-white/5"
			>
			  <Link href="/app">Upload a tender</Link>
			</Button> */}


            <span className="text-sm text-muted-foreground">
              Trusted by tender and bid consultants
            </span>
          </div>
        </section>

        {/* Content cards */}
        <section className="grid gap-8 md:grid-cols-2">
          <GlassCard
            title="Why Go/No-Go decisions are so difficult in tenders"
            icon={<ShieldAlert className="w-6 h-6 text-blue-400" />}
          >
            <p className="mb-6">
              Making a Go/No-Go decision for a tender or RFP is rarely
              straightforward. Decision-makers must quickly assess hundreds of
              pages covering legal clauses, technical requirements, compliance
              rules, timelines, and commercial risks — often under tight
              deadlines and with incomplete information.
            </p>

            <ul className="space-y-3">
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                Hidden mandatory requirements buried deep in documents
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                Unclear evaluation criteria and scoring logic
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                Legal or contractual risks discovered too late
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                Limited time to involve all stakeholders
              </li>
            </ul>
          </GlassCard>

          <GlassCard
            title="How AI improves Go/No-Go decision-making"
            icon={<Sparkles className="w-6 h-6 text-purple-400" />}
          >
            <p className="mb-4">
              AI is not about replacing human judgment in tender decisions. It
              is about reducing uncertainty and surfacing what matters early.
            </p>
            <p className="mb-8">
              When applied correctly, AI can extract requirements, highlight
              risks, and structure complex tender documents into clear decision
              categories — enabling faster and more confident decisions.
            </p>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">
                  Requirements
                </div>
                <div>Extract and structure decision-critical obligations.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">Risks</div>
                <div>Surface deal-breakers early to avoid late surprises.</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="font-semibold text-foreground mb-1">
                  Decision signals
                </div>
                <div>
                  Summaries aligned to Go/No-Go reasoning, not generic analysis.
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="md:col-span-2">
            <GlassCard
              title="How TenderPilot supports AI Go/No-Go decisions"
              icon={<ListChecks className="w-6 h-6 text-emerald-400" />}
            >
              <p className="mb-8">
                TenderPilot is built specifically to support early-stage Go/No-Go
                decisions — not proposal writing and not generic document
                analysis. By uploading tender or RFP documents, teams can
                quickly identify key requirements, constraints, and potential
                deal-breakers, gaining decision clarity within minutes instead
                of days.
              </p>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">
                    Executive summary
                  </div>
                  <div>
                    A concise, decision-oriented summary to align stakeholders
                    faster.
                  </div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">
                    Mandatory requirements
                  </div>
                  <div>
                    Extracted and structured to reduce the risk of missing
                    disqualifying conditions.
                  </div>
                </div>
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
                  <div className="font-semibold text-foreground mb-2">
                    Risks and ambiguities
                  </div>
                  <div>
                    Clauses, gaps, and cost risks highlighted early so you can
                    clarify sooner.
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="md:col-span-2">
            <GlassCard title="Who uses AI Go/No-Go decision tools">
              <div className="grid gap-6 md:grid-cols-2">
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                    Tender and bid consultants managing multiple opportunities
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                    SMEs evaluating public-sector or large corporate tenders
                  </li>
                </ul>

                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                    Sales and business development teams handling RFPs
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
                    Organizations with limited time to assess complex
                    requirements
                  </li>
                </ul>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20">
          <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-12 max-w-4xl mx-auto backdrop-blur-sm">
            <h3 className="text-2xl font-bold mb-4">
              Make better Go/No-Go decisions in minutes
            </h3>
            <p className="text-muted-foreground mb-8">
              Upload a tender document and get structured decision signals —
              requirements, risks, and key constraints — without manual reading.
            </p>

            {/* <Button asChild ...>
			  <Link href="/app">
				Upload your document <ArrowRight className="ml-2 w-5 h-5" />
			  </Link>
			</Button> */}

          </div>
        </section>
      </main>
    </div>
  );
}
