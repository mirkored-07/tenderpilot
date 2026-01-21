import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";

function FeatureCard({ title, subtitle, bullets }: { title: string; subtitle: string; bullets: string[] }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
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

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border bg-background/60 p-5">
      <div className="text-sm font-semibold">{q}</div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            TenderPilot
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/how-it-works" data-umami-event="cta_how_header">How it works</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/sample" data-umami-event="cta_sample_header">Sample output</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/login" data-umami-event="cta_signin_header">Sign in</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/app/upload" data-umami-event="cta_upload_header">Upload file</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 md:px-8 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Make a bid decision in minutes.
            </h1>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
              Upload a tender (PDF or DOCX) and get a structured review: requirements, risks,
              buyer questions, and a short draft outline.
            </p>

            <p className="mt-3 text-sm text-muted-foreground">
              Built for bid managers, sales engineers, and teams responding to customer RFPs.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                <span>Spot potential blockers early</span>
              </li>
              <li className="flex gap-3 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                <span>Group MUST, SHOULD, and info items for fast scanning</span>
              </li>
              <li className="flex gap-3 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                <span>Start drafting from a clean outline, not a blank page</span>
              </li>
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href="/app/upload" data-umami-event="cta_upload_hero">Upload file</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/sample" data-umami-event="cta_sample_hero">View sample output</Link>
              </Button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Magic link sign in. No passwords.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                PDF or DOCX
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Requirements, risks, questions
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Short draft outline
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Verify against source
              </span>
            </div>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Decision snapshot</div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    A clear workspace to review obligations, risks, and open questions.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Proceed
                </span>
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Proceed with caution
                </span>
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Hold – potential blocker
                </span>
              </div>

              <Separator className="my-5" />

              <div className="grid gap-3">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Requirements</div>
                  <div className="mt-1 text-sm text-muted-foreground">MUST: ISO 27001 evidence (by submission)</div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Risks</div>
                  <div className="mt-1 text-sm text-muted-foreground">Delivery window unclear, confirm milestones</div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Buyer questions</div>
                  <div className="mt-1 text-sm text-muted-foreground">Is an alternative warranty term acceptable?</div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Draft outline</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Executive summary, approach, plan, compliance
                  </div>
                </div>
              </div>

              <div className="mt-5 text-sm">
                <Link
                  href="/sample"
                  className="text-foreground underline underline-offset-4"
                  data-umami-event="cta_sample_preview"
                >
                  View sample output →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            title="Requirements"
            subtitle="Disqualifiers and obligations"
            bullets={[
              "MUST items shown first to prevent disqualification.",
              "SHOULD items highlight scoring expectations.",
              "Each item phrased to be actionable.",
            ]}
          />
          <FeatureCard
            title="Risks"
            subtitle="Gaps, assumptions, and delivery threats"
            bullets={[
              "Severity helps prioritize what to resolve.",
              "Focus on ambiguity and dependencies.",
              "Mitigation stays short and practical.",
            ]}
          />
          <FeatureCard
            title="Buyer questions"
            subtitle="What to clarify early"
            bullets={[
              "A ready to send list for the Q&A window.",
              "Reduce scope ambiguity before you commit.",
              "Avoid hidden obligations and acceptance traps.",
            ]}
          />
          <FeatureCard
            title="Draft outline"
            subtitle="A structured starting point"
            bullets={[
              "Not a full proposal, a clean outline.",
              "Keeps effort proportional to bid likelihood.",
              "Improves consistency and reduces blank page time.",
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div>
                <p className="text-sm font-semibold">Early access</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Get notified when early access opens. Planning to open access in about two weeks, inviting
                  small batches.
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

      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <p className="mt-2 text-sm text-muted-foreground">Clear answers. No hype.</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FaqItem q="Which files are supported?" a="PDF and DOCX tenders." />
          <FaqItem q="Do I need a template?" a="No. Upload your tender as is." />
          <FaqItem
            q="Is this a full proposal generator?"
            a="No. You get a short draft outline you can refine, plus requirements, risks, and buyer questions."
          />
          <FaqItem
            q="How accurate is it?"
            a="It is a decision support tool. Always verify against the original tender document."
          />
          <FaqItem
            q="Do I need an account?"
            a="Yes. You will sign in via magic link so your review stays in a private workspace."
          />
          <FaqItem q="Where do I start?" a="Upload a tender and review the workspace output." />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-sm text-muted-foreground">TenderPilot</div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/sample" className="text-muted-foreground hover:text-foreground">
              Sample output
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/app/upload" className="text-muted-foreground hover:text-foreground">
              Upload file
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Drafting support only. Always verify against the original tender document.
        </p>
      </footer>
    </main>
  );
}
