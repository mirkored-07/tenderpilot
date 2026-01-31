import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CircleCheck,
  CircleX,
  Clock,
  Euro,
  FileSearch,
  ListChecks,
  Sparkles,
  Upload,
  Users,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { OutputPreview } from "@/app/app/_components/output-preview";

function FeatureCard({
  title,
  subtitle,
  bullets,
  icon,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  icon?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
              {icon}
            </div>
          ) : null}

          <div>
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>

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

function RoiBenefitGraphic() {
  return (
    <div className="mt-8">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
		  <div>
			<h3 className="text-sm font-semibold">Time and cost impact</h3>
			<p className="mt-1 text-sm text-muted-foreground">
			  Built to reduce non-billable review effort and help you avoid low-fit bids earlier.
			</p>
		  </div>

		  <span className="text-xs text-muted-foreground sm:pt-1">
			Illustrative only · varies by document complexity
		  </span>
		</div>


      <div className="mt-5 grid gap-4 md:grid-cols-3 md:items-stretch">
        <div className="h-full rounded-2xl border bg-background/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
              <Clock className="h-4 w-4 text-foreground/80" />
            </div>
            <div>
              <div className="text-sm font-semibold">Save review time</div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Less manual extraction and reformatting. Faster first-pass understanding.
              </p>
            </div>
          </div>
        </div>

        <div className="h-full rounded-2xl border bg-background/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
              <Euro className="h-4 w-4 text-foreground/80" />
            </div>
            <div>
              <div className="text-sm font-semibold">Protect bid margin</div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Spend fewer paid hours on tenders that do not fit. Focus effort where it counts.
              </p>
            </div>
          </div>
        </div>

        <div className="h-full rounded-2xl border bg-background/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
              <ShieldCheck className="h-4 w-4 text-foreground/80" />
            </div>
            <div>
              <div className="text-sm font-semibold">Reduce costly misses</div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Surface disqualifiers and open points earlier so fewer surprises land late.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-background/60 p-5">
        <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
		  <div className="text-sm font-semibold">
			A clearer first pass supports better go/no-go decisions
		  </div>
		  <div className="text-sm text-muted-foreground md:text-right">
			Less admin work · earlier clarity · cleaner internal handoffs
		  </div>
		</div>

        <p className="mt-3 text-xs text-muted-foreground">
          This section explains intended benefits. It is not a guarantee of time or money saved.
        </p>
      </div>
    </div>
  );
}

export default function Page() {
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

          {/* Mobile nav */}
          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none rounded-full border bg-background/60 px-3 py-2 text-sm font-medium text-foreground/90 [&::-webkit-details-marker]:hidden">
              Menu
            </summary>

            <div className="absolute right-0 mt-2 w-56 rounded-2xl border bg-background p-2 shadow-lg">
              <Link
                href="/how-it-works"
                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                data-umami-event="cta_how_header"
              >
                How it works
              </Link>
              <Link
                href="/sample"
                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                data-umami-event="cta_sample_header"
              >
                Sample output
              </Link>
              <Link
                href="#early-access"
                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                data-umami-event="cta_waitlist_header"
              >
                Get early access
              </Link>
            </div>
          </details>
        </div>
      </header>

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 md:px-8 md:pt-16 overflow-hidden">
        {/* Premium background glow (no assets, motion-safe) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-foreground/5 blur-3xl motion-safe:animate-pulse"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-foreground/5 blur-3xl motion-safe:animate-pulse"
        />

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              Go/no-go decision support for tender consultants and SMEs.
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Understand tenders faster.
              <br className="hidden sm:block" />
              Decide whether to bid with confidence.
            </h1>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
              TenderPilot helps you turn a tender into a structured first-pass review pack:
              an executive summary, a checklist of mandatory requirements, and key risks or ambiguities to verify — so you can decide earlier where to invest bid effort.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5">
                <Clock className="h-4 w-4" />
                <span>Less manual review work</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5">
                <Euro className="h-4 w-4" />
                <span>Better use of paid hours</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span>Earlier risk visibility</span>
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Decision-support only. No legal advice. You always verify against the original tender.
            </p>

            <div className="mt-6">
              <WaitlistInline source="hero" />
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Private beta · No spam · One email when access opens
            </div>
          </div>

          {/* Output preview with premium frame */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-3xl bg-foreground/5 blur-2xl"
            />
            <div className="relative rounded-3xl border bg-background/60 p-2 shadow-sm transition-all duration-200 hover:shadow-md">
              <OutputPreview />
            </div>
          </div>
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold">Who TenderPilot is for</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                <BriefcaseBusiness className="h-4 w-4 text-foreground/80" />
              </div>
              <span>Tender consultants reviewing multiple tenders for clients</span>
            </li>
            <li className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                <Building2 className="h-4 w-4 text-foreground/80" />
              </div>
              <span>SMEs deciding where to invest limited bid resources</span>
            </li>
            <li className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                <Users className="h-4 w-4 text-foreground/80" />
              </div>
              <span>Small teams preparing bids under tight deadlines</span>
            </li>
            <li className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                <BadgeCheck className="h-4 w-4 text-foreground/80" />
              </div>
              <span>Freelance bid and procurement support handling complex RFPs</span>
            </li>
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            If you regularly read long tender documents to understand what really matters, this is for you.
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
            subtitle="A concise, decision-oriented summary to support early go/no-go decisions and faster stakeholder alignment."
            bullets={["Scope and context", "Key constraints", "Decision points"]}
            icon={<FileSearch className="h-4 w-4 text-foreground/80" />}
          />
          <FeatureCard
            title="Mandatory requirements checklist"
            subtitle="Requirements extracted and structured to reduce the risk of missing disqualifying conditions and avoid rework."
            bullets={[
              "Mandatory vs optional items",
              "Clear pass / review structure",
              "Verification-ready",
            ]}
            icon={<ListChecks className="h-4 w-4 text-foreground/80" />}
          />
          <FeatureCard
            title="Risks and ambiguities"
            subtitle="Unclear clauses, gaps, and potential delivery or cost risks highlighted early so you can clarify sooner."
            bullets={["Severity labels", "Open points", "Clarification prompts"]}
            icon={<Sparkles className="h-4 w-4 text-foreground/80" />}
          />
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Designed to support go/no-go decisions and early drafting. It does not replace expert review.
        </p>

        {/* ROI */}
        <RoiBenefitGraphic />
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
                <div className="rounded-2xl border bg-background/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                      <Upload className="h-4 w-4 text-foreground/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Upload a tender or RFP</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        PDF or DOCX documents supported.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                      <Sparkles className="h-4 w-4 text-foreground/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">TenderPilot analyzes the document</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Requirements, evaluation structure (when stated), risks, and document structure.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/40">
                      <ListChecks className="h-4 w-4 text-foreground/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Review a structured review pack</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        So you can decide whether to proceed and how to structure your response.
                      </p>
                    </div>
                  </div>
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
                  <li className="flex gap-3">
                    <CircleCheck className="mt-0.5 h-4 w-4 text-foreground/70" />
                    <span>Decision support for tender review</span>
                  </li>
                  <li className="flex gap-3">
                    <CircleCheck className="mt-0.5 h-4 w-4 text-foreground/70" />
                    <span>Flags mandatory requirements and disqualifiers for review</span>
                  </li>
                  <li className="flex gap-3">
                    <CircleCheck className="mt-0.5 h-4 w-4 text-foreground/70" />
                    <span>Aligned with real bid workflows</span>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold">What it is not</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <CircleX className="mt-0.5 h-4 w-4 text-foreground/60" />
                    <span>Tender search and alerts</span>
                  </li>
                  <li className="flex gap-3">
                    <CircleX className="mt-0.5 h-4 w-4 text-foreground/60" />
                    <span>Legal advice</span>
                  </li>
                  <li className="flex gap-3">
                    <CircleX className="mt-0.5 h-4 w-4 text-foreground/60" />
                    <span>Procurement consulting</span>
                  </li>
                  <li className="flex gap-3">
                    <CircleX className="mt-0.5 h-4 w-4 text-foreground/60" />
                    <span>Automated bid submission</span>
                  </li>
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
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  If you join, we may ask one short question about your current tender review workflow so we can prioritize what the review pack should include.
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
			<Link  href="/tenders/software" className="text-sm text-muted-foreground hover:text-foreground">
			  Browse Software Tenders
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
