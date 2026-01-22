import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Wand2,
  AlertTriangle,
  Home,
} from "lucide-react";

const WAITLIST_URL =
  process.env.NEXT_PUBLIC_WAITLIST_URL || "https://tally.so/r/gD9bkM";



const STEPS = [
  {
    icon: FileText,
    title: "Upload a tender PDF",
    text: "Add the tender document. TenderPilot extracts and structures the text for analysis.",
  },
  {
    icon: Wand2,
    title: "Get a clear structure",
    text: "You receive an executive summary, MUST items, and risks so you can plan the bid quickly.",
  },
  {
    icon: ShieldCheck,
    title: "Validate critical points",
    text: "Use the extracted source text to verify the MUST items and risk reasoning before submission.",
  },
  {
    icon: CheckCircle2,
    title: "Draft an outline",
    text: "Generate a draft outline to speed up preparation. Final content stays your responsibility.",
  },
];

const GUARANTEES = [
  {
    title: "Minimal, practical output",
    text: "No long essays. Just what helps you decide next actions and avoid missing MUST items.",
  },
  {
    title: "Always traceable to the source",
    text: "Outputs are paired with excerpts so you can verify quickly and confidently.",
  },
  {
    title: "Built for real deadlines",
    text: "Designed to help you move from document to plan fast, especially under time pressure.",
  },
];

const FAQ = [
  {
    q: "Is this a final proposal generator?",
    a: "No. TenderPilot helps you structure work, highlight MUST items and risks, and create a draft outline. You still review and finalize everything.",
  },
  {
    q: "Can I trust the MUST items automatically?",
    a: "Treat MUST items as a checklist suggestion. Always verify against the source text and original PDF before submitting.",
  },
  {
    q: "What about confidentiality?",
    a: "Use your internal process. If your organization has strict rules, validate with your compliance and IT policies before uploading sensitive tenders.",
  },
];

function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Soft “landing-like” glow */}
      <div className="absolute left-1/2 top-[-140px] h-[540px] w-[920px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
      <div className="absolute right-[-180px] top-[160px] h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute left-[-200px] top-[420px] h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Subtle vignette to keep it clean */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen">
      <Background />

      <header className="mx-auto max-w-6xl px-4 pt-10 md:px-8">
        <div className="flex items-center justify-between">
          {/* Removed logo/icon near title */}
          <Link href="/" className="font-semibold">
            TenderPilot
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/sample"
              className="hidden text-sm text-muted-foreground hover:text-foreground md:inline"
            >
              Sample
            </Link>

            {/* Replaced Try it with Back to home */}
            <Link href="/" className="text-sm">
              <Button size="sm" className="rounded-xl" variant="secondary">
                <Home className="mr-2 h-4 w-4" />
                Back to home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 md:px-8">
        <div className="grid gap-6 md:grid-cols-[1.1fr_.9fr] md:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              Practical workflow, minimal noise
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              How it works
            </h1>
            <p className="mt-2 max-w-xl text-base text-muted-foreground">
              TenderPilot helps you go from a long tender PDF to a structured plan:
              MUST items, risks, and a draft outline. It is designed to speed up
              decision-making, not replace final review.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                MUST items
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                Risks
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                Draft outline
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                Source excerpt
              </Badge>
            </div>

            <div className="mt-7 rounded-2xl border bg-background/60 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-medium">What you get</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A clean, action-oriented view of the tender: key requirements,
                    what can disqualify you, what looks risky, and a structured
                    outline to start your bid response.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">See an example</CardTitle>
              <p className="text-sm text-muted-foreground">
                Check the sample output to understand the format.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Separator className="my-4" />
              <Link href="/sample">
                <Button variant="secondary" className="w-full rounded-xl">
                  Open sample <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <div className="mt-4 rounded-2xl border bg-background/60 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Always verify MUST items against the source and the original
                    PDF before submitting.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {/* Replaced Try with your PDF -> Join early access (Tally) */}
                <a href={WAITLIST_URL} target="_blank" rel="noreferrer">
                  <Button className="w-full rounded-xl">Join early access</Button>
                </a>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Designed for speed. Built for traceability.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step by step</CardTitle>
            <p className="text-sm text-muted-foreground">
              A simple flow that matches how teams actually work.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="my-4" />
            <div className="grid gap-4 md:grid-cols-2">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <div key={idx} className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{s.title}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What this is</CardTitle>
              <p className="text-sm text-muted-foreground">
                A fast assistant for structuring tender work.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Separator className="my-4" />
              <div className="space-y-3">
                {GUARANTEES.map((g, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="text-sm font-medium">{g.title}</div>
                      <div className="text-sm text-muted-foreground">{g.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Common questions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Short answers, aligned with the product intent.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Separator className="my-4" />
              <ScrollArea className="h-[260px] rounded-2xl border bg-background/60">
                <div className="space-y-4 p-4">
                  {FAQ.map((f, idx) => (
                    <div key={idx}>
                      <div className="text-sm font-medium">{f.q}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{f.a}</div>
                      {idx < FAQ.length - 1 ? <Separator className="my-3" /> : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ready to test interest?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ship the marketing pages, then measure registrations and engagement in production.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="my-4" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Start simple. The goal is to validate interest and collect early access signups.
              </div>
              <div className="flex gap-2">
                <Link href="/sample">
                  <Button variant="secondary" className="rounded-xl">
                    View sample
                  </Button>
                </Link>
                <a href={WAITLIST_URL} target="_blank" rel="noreferrer">
                  <Button className="rounded-xl">
                    Join early access <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Drafting support only. Always verify against the original tender document.
        </p>
      </footer>
    </main>
  );
}
