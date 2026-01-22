import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { OutputPreview } from "@/app/app/_components/output-preview";

function FeatureCard({ title, subtitle, bullets }: { title: string; subtitle: string; bullets: string[] }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
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
                Join early access
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 md:px-8 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">AI models tailored for tender and RFP analysis</p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Tender reviews, distilled.</h1>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
              TenderPilot uses AI models designed specifically for tender and RFP review. Get a clear executive
              summary, a structured requirements checklist, risk flags, and a draft proposal outline in one place.
            </p>

            <div className="mt-6">
              <WaitlistInline source="hero" />
            </div>

            <div className="mt-4 flex items-center gap-3 text-sm">
              <Link
                href="/sample"
                className="text-foreground underline underline-offset-4"
                data-umami-event="cta_sample_hero"
              >
                View sample output
              </Link>
              <span className="text-muted-foreground">Private beta. No spam.</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                AI tender review
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                AI RFP analysis
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Requirements checklist
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Risk flags
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Draft outline
              </span>
            </div>
          </div>

          <OutputPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Executive summary"
            subtitle="A fast, structured view of what matters and what to decide."
            bullets={["Scope and context", "Decision points", "Key constraints"]}
          />
          <FeatureCard
            title="Checklist"
            subtitle="Requirements extracted and laid out in a format you can actually work with."
            bullets={["Mandatory vs optional items", "Scannable structure", "Review-ready format"]}
          />
          <FeatureCard
            title="Risks"
            subtitle="Ambiguities, gaps, and potential blockers highlighted early."
            bullets={["Consistent severity labels", "Open points", "Escalation guidance"]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">Why this is different</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  General AI tools are not built for tenders. TenderPilot uses AI models tailored for tender and RFP
                  analysis, so the output is structured, consistent, and aligned with how tender teams work.
                </p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-5">
                <p className="text-sm font-semibold">What you get</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-3 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>Executive summary</span>
                  </li>
                  <li className="flex gap-3 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>Requirements checklist</span>
                  </li>
                  <li className="flex gap-3 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>Risk flags and open points</span>
                  </li>
                  <li className="flex gap-3 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>Draft proposal outline</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-3 md:items-start">
              <div className="md:col-span-1">
                <p className="text-sm font-semibold">How it works</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Built around the tender workflow, with AI models tailored for this document type.
                </p>
              </div>

              <div className="md:col-span-2 grid gap-3">
                {[
                  { t: "Submit a tender", d: "Private beta. You will get access when we open." },
                  { t: "Extract and analyze", d: "TenderPilot reads structure, requirements, and evaluation logic." },
                  { t: "Review and export", d: "Clear outputs and next steps, ready to share." },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl border bg-background/60 p-5">
                    <div className="text-sm font-semibold">{x.t}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{x.d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/sample" data-umami-event="cta_sample_mid">
                  View sample output
                </Link>
              </Button>
              
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="early-access" className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div>
                <p className="text-sm font-semibold">Early access</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Join early access and get notified when the private beta opens. You will receive a single email when
                  access is available.
                </p>
              </div>

              <div>
                <WaitlistInline source="landing" />
                <p className="mt-3 text-xs text-muted-foreground">
                  By joining, you agree to be contacted about TenderPilot early access. See{" "}
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                    Privacy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="text-sm text-muted-foreground">© {new Date().getFullYear()} TenderPilot</div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/sample" className="text-muted-foreground hover:text-foreground">
              Sample output
            </Link>
            <Link href="#early-access" className="text-muted-foreground hover:text-foreground" data-umami-event="cta_waitlist_footer">
              Join early access
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
