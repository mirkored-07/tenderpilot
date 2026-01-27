import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { OutputPreview } from "@/app/app/_components/output-preview";

function FeatureCard({
  title,
  subtitle,
  bullets,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-3 leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            TenderPilot
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/how-it-works" data-umami-event="cta_how_header">
                How it works
              </Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/sample" data-umami-event="cta_sample_header">
                Sample output
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="#early-access" data-umami-event="cta_waitlist_header">
                Get early access
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 md:px-8 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
			  Go/no-go decision support for tender consultants and SMEs.
			</p>

			<h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
			  Understand tenders faster.
			  <br />
			  Decide whether to bid with confidence.
			</h1>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
			  TenderPilot helps tender consultants and SMEs review RFPs and public tenders, extract mandatory requirements,
			  risks, and evaluation criteria, and make a go/no-go decision in minutes, not days.
			</p>


            <p className="mt-3 text-sm text-muted-foreground">
              Decision-support only. No legal advice. You always verify against
              the original tender.
            </p>

            <div className="mt-6">
              <WaitlistInline source="hero" />
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Private beta · No spam · One email when access opens
            </div>
          </div>

          <OutputPreview />
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold">Who TenderPilot is for</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
			  <li>Tender consultants reviewing multiple tenders for clients</li>
			  <li>SMEs deciding where to invest limited bid resources</li>
			  <li>Small teams preparing bids under tight deadlines</li>
			  <li>Freelance bid and procurement support handling complex RFPs</li>
			</ul>

          <p className="mt-4 text-sm text-muted-foreground">
            If you regularly read long tender documents to understand what
            really matters, this is for you.
          </p>
        </div>
      </section>

      {/* SAMPLE OUTPUT FEATURES */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <h2 className="mb-6 text-xl font-semibold">
          What you get from a tender document
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Executive summary"
            subtitle="A concise, decision-oriented summary designed to support early go or no-go decisions."
            bullets={[
              "Scope and context",
              "Key constraints",
              "Decision points",
            ]}
          />
          <FeatureCard
            title="Mandatory requirements checklist"
            subtitle="Requirements extracted and structured to reduce the risk of missing disqualifying conditions."
            bullets={[
              "Mandatory vs optional items",
              "Clear pass / review structure",
              "Verification-ready",
            ]}
          />
          <FeatureCard
            title="Risks and ambiguities"
            subtitle="Unclear clauses, gaps, and potential delivery or cost risks highlighted early."
            bullets={[
              "Severity labels",
              "Open points",
              "Clarification prompts",
            ]}
          />
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
		  Designed to support go/no-go decisions and early drafting. It does not replace expert review.
		</p>

      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-3 md:items-start">
              <div className="md:col-span-1">
                <h2 className="text-sm font-semibold">How it works</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  A simple flow designed for real tender and RFP workflows.
                </p>
              </div>

              <div className="md:col-span-2 grid gap-3">
                <div className="rounded-2xl border bg-background/60 p-5">
                  <div className="text-sm font-semibold">
                    Upload a tender or RFP
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    PDF or DOCX documents supported.
                  </p>
                </div>

                <div className="rounded-2xl border bg-background/60 p-5">
                  <div className="text-sm font-semibold">
                    TenderPilot analyzes the document
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Requirements, evaluation logic, risks, and structure.
                  </p>
                </div>

                <div className="rounded-2xl border bg-background/60 p-5">
                  <div className="text-sm font-semibold">
                    Review a structured bid kit
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    So you can decide whether to proceed and how to structure
                    your response.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/sample" data-umami-event="cta_sample_mid">
                  View sample output
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* WHAT IT IS / IS NOT */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold">What TenderPilot is</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Decision support for tender review</li>
                  <li>Compliance-aware by design</li>
                  <li>Aligned with real bid workflows</li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold">What it is not</h2>
                <<ul className="mt-3 space-y-2 text-sm text-muted-foreground">
				  <li>Tender search and alerts</li>
				  <li>Legal advice</li>
				  <li>Procurement consulting</li>
				  <li>Automated bid submission</li>
				</ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* EARLY ACCESS */}
      <section
        id="early-access"
        className="mx-auto max-w-6xl px-4 pb-14 md:px-8"
      >
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div>
                <h2 className="text-sm font-semibold">Join the private beta</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
				  TenderPilot is currently in private beta. Early access is limited and focused on collecting real feedback from
				  tender consultants and SMEs working with public tenders and RFPs.
				</p>

              </div>

              <div>
                <WaitlistInline source="landing" />
                <p className="mt-3 text-xs text-muted-foreground">
                  You will receive one email when access becomes available.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TenderPilot
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/sample" className="text-muted-foreground hover:text-foreground">
              Sample output
            </Link>
            <Link
              href="#early-access"
              className="text-muted-foreground hover:text-foreground"
              data-umami-event="cta_waitlist_footer"
            >
              Get early access
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
