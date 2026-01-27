import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
				  <Link href="/" className="font-semibold text-lg tracking-tight">
					TenderPilot
				  </Link>

				  {/* Desktop / tablet nav */}
				  <div className="hidden md:flex items-center gap-2">
					<Button asChild variant="ghost" className="rounded-full">
					  <Link href="/" data-umami-event="cta_home_how_header">
						Back to home
					  </Link>
					</Button>
					<Button asChild variant="ghost" className="rounded-full">
					  <Link href="/sample" data-umami-event="cta_sample_how_header">
						Sample
					  </Link>
					</Button>
					<Button asChild className="rounded-full">
					  <Link href="#early-access" data-umami-event="cta_waitlist_how_header">
						Get early access
					  </Link>
					</Button>
				  </div>

				  {/* Mobile nav */}
				  <details className="relative md:hidden">
					<summary className="cursor-pointer list-none rounded-full border bg-background/60 px-3 py-2 text-sm font-medium text-foreground/90 [&::-webkit-details-marker]:hidden">
					  Menu
					</summary>

					<div className="absolute right-0 mt-2 w-56 rounded-2xl border bg-background p-2 shadow-lg">
					  <Link
						href="/"
						className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
						data-umami-event="cta_home_how_header"
					  >
						Back to home
					  </Link>
					  <Link
						href="/sample"
						className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
						data-umami-event="cta_sample_how_header"
					  >
						Sample
					  </Link>
					  <Link
						href="#early-access"
						className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
						data-umami-event="cta_waitlist_how_header"
					  >
						Get early access
					  </Link>
					</div>
				  </details>
				</div>

      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 md:px-8 md:pt-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-muted-foreground">Practical workflow. Minimal noise.</p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">How it works</h1>

          <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
			  TenderPilot helps you understand a tender fast so you can make a go/no-go decision with confidence. It
			  structures RFPs and public tenders into review-ready outputs: mandatory requirements, evaluation criteria,
			  risks and ambiguities, and a proposal outline.
			</p>

          <p className="mt-3 text-sm text-muted-foreground">
            Decision-support only. No legal or procurement advice. Always verify against the original tender document.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/sample" data-umami-event="cta_sample_how_hero">
                View sample output
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="#early-access" data-umami-event="cta_waitlist_how_hero">
                Join early access
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* OUTPUTS YOU'LL SEE */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div>
                <h2 className="text-sm font-semibold">Outputs you’ll see</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
				  A practical set of artifacts you can review quickly, built for traceability and verification.
				</p>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "Mandatory requirements checklist",
                  "Evaluation criteria and scoring",
                  "Risks, ambiguities, missing information",
                  "Source excerpts for traceability",
                  "Proposal outline starter",
                ].map((x) => (
                  <li key={x} className="flex gap-3 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* WHAT YOU GET */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-sm font-semibold">What you get</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              A practical view of what can disqualify you, what looks risky or unclear, what needs clarification, and
              how to structure your response.
            </p>

            <div className="mt-6">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/sample" data-umami-event="cta_sample_how_mid">
                  Open sample
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Always verify mandatory requirements against the source and the original tender document before
              submitting.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* STEP BY STEP */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-3 md:items-start">
              <div className="md:col-span-1">
                <h2 className="text-sm font-semibold">Step by step</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
				  A simple flow that matches how consultants and small teams actually work.
				</p>

              </div>

              <div className="md:col-span-2 grid gap-3">
                {[
                  {
                    t: "Upload a tender or RFP",
                    d: "PDF or DOCX. The goal is to move from document to clarity fast.",
                  },
                  {
                    t: "Get a structured bid kit",
                    d: "Summary, mandatory requirements, evaluation criteria, and risks organized for review.",
                  },
                  {
                    t: "Verify with source excerpts",
                    d: "Traceability for critical points so you can validate quickly and confidently.",
                  },
                  {
                    t: "Start with an outline",
                    d: "Speed up drafting. Final content and submission remain your responsibility.",
                  },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl border bg-background/60 p-5">
                    <div className="text-sm font-semibold">{x.t}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{x.d}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">The goal is clarity, especially when time is limited.</p>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-sm font-semibold">Common questions</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Short answers, aligned with the intent.</p>

            <div className="mt-6 grid gap-4">
              {[
                {
                  q: "Is this a final proposal generator?",
                  a: "No. TenderPilot helps you structure work, highlight mandatory requirements and risks, and create a draft outline. You still review and finalize everything.",
                },
                {
                  q: "Can I trust mandatory requirements automatically?",
                  a: "Treat them as a checklist suggestion. Always verify against the source excerpts and the original tender document before submitting.",
                },
                {
                  q: "What about confidentiality?",
                  a: "Use your internal process. If your organization has strict rules, validate fit with your compliance and IT policies before uploading sensitive tenders.",
                },
                {
                  q: "Is this suitable for public-sector and regulated tenders?",
                  a: "Yes, for structured review and drafting support. All outputs must be verified against the original tender documents. It does not provide legal or procurement advice.",
                },
              ].map((x) => (
                <div key={x.q} className="rounded-2xl border bg-background/60 p-5">
                  <div className="text-sm font-semibold">{x.q}</div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{x.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* EARLY ACCESS */}
      <section id="early-access" className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div>
                <h2 className="text-sm font-semibold">Join the private beta</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Early access is limited and focused on collecting feedback from professionals working with tenders and
                  RFPs.
                </p>
              </div>

              <div>
                <WaitlistInline source="how_it_works" />
                <p className="mt-3 text-xs text-muted-foreground">
                  Private beta · No spam · One email when access opens
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="text-sm text-muted-foreground">TenderPilot</div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link href="/sample" className="text-muted-foreground hover:text-foreground">
              Sample
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 md:px-8">
          <div className="text-xs text-muted-foreground">
            Drafting support only. Always verify against the original tender document.
          </div>
        </div>
      </footer>
    </main>
  );
}
