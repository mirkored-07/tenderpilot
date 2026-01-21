import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm font-semibold">
            {n}
          </div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">{text}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WhatYouGetItem({
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
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2 text-sm text-muted-foreground">
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

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            TenderPilot
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/how-it-works">How it works</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/sample">Sample output</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/app/upload">Upload file</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8 md:px-8 md:pt-16">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">How TenderPilot works</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed md:text-lg">
          TenderPilot creates a tender review workspace from your tender document so you can decide
          faster and reduce surprises.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-full">
            <Link href="/app/upload">Upload file</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Step n="1" title="Upload" text="PDF or DOCX in. No templates. No setup." />
          <Step
            n="2"
            title="Review what matters"
            text="Requirements, risks, and questions grouped for fast scanning."
          />
          <Step
            n="3"
            title="Decide and draft"
            text="Make a call, then start from a short structured outline."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">What you get</h2>
          <p className="mt-2 text-sm text-muted-foreground">Designed for clarity. Optimized for decision making.</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <WhatYouGetItem
            title="Requirements"
            subtitle="Disqualifiers and obligations"
            bullets={[
              "MUST items are shown first to prevent disqualification.",
              "SHOULD items highlight expectations that affect scoring.",
              "Each item is phrased to be actionable, not academic.",
            ]}
          />
          <WhatYouGetItem
            title="Risks"
            subtitle="Gaps, assumptions, and delivery threats"
            bullets={[
              "Severity helps prioritize what to resolve first.",
              "Focus on ambiguity, dependencies, and delivery impact.",
              "Mitigation wording stays short and practical.",
            ]}
          />
          <WhatYouGetItem
            title="Clarifications"
            subtitle="Questions to ask the buyer"
            bullets={[
              "A ready-to-send list for the Q&A window.",
              "Reduces scope ambiguity before you submit.",
              "Helps avoid hidden obligations and acceptance traps.",
            ]}
          />
          <WhatYouGetItem
            title="Draft outline"
            subtitle="A structured starting point"
            bullets={[
              "Not a full proposal, a clean outline you can refine.",
              "Keeps effort proportional to bid likelihood.",
              "Improves consistency and reduces blank-page time.",
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Good to know</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Drafting support only. Always verify requirements and legal language against the original tender
                  document.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/sample">View sample output</Link>
                </Button>
                <Button asChild className="rounded-full">
                  <Link href="/app/upload">Upload file</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Drafting support only. Always verify against the original tender document.
        </p>
      </section>
    </main>
  );
}
