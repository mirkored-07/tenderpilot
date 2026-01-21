import Link from "next/link";

import ExecutiveSummary from "@/components/executive-summary/ExecutiveSummary";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

function normalizeWaitlistUrl(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "https://tally.so/r/gD9bkM";
  const doubled = "https://tally.so/r/https://tally.so/r/";
  if (v.startsWith(doubled)) return "https://tally.so/r/" + v.slice(doubled.length);
  if (!v.startsWith("http")) return `https://tally.so/r/${v.replace(/^\/+/, "")}`;
  return v;
}

const WAITLIST_URL = normalizeWaitlistUrl(process.env.NEXT_PUBLIC_WAITLIST_URL || "");


const SAMPLE = {
  tenderName: "Public sector IT services tender (sample)",
  submissionDeadline: "May 14, 2026 — 12:00 CET",
  executive: {
    decisionBadge: "Proceed with caution",
    decisionLine:
      "No clear disqualifier detected, but two points need clarification: submission format and acceptance criteria for the support SLA.",
    keyFindings: [
      "Submission via e-procurement portal; strict file naming rules.",
      "ISO 27001 evidence requested for data processing activities.",
      "Delivery timeline references milestones but acceptance tests are not fully defined.",
      "Evaluation weighted on price + technical approach + team experience.",
      "On-site support is mentioned; location and response time must be confirmed.",
    ],
    topRisks: [
      { severity: "high", text: "Acceptance criteria unclear — risk of scope creep during delivery." },
      { severity: "medium", text: "Support SLA wording ambiguous; confirm response windows and exclusions." },
      { severity: "low", text: "Reference project format may require a specific template." },
    ],
    nextActions: [
      "Confirm submission packaging rules (PDF set + signed declarations).",
      "Clarify acceptance tests and deliverable sign-off process.",
      "Validate ISO 27001 evidence requirements and acceptable alternatives.",
    ],
  },
  requirements: [
    { tag: "MUST", text: "Submit offer via the e-procurement portal before the deadline." },
    { tag: "MUST", text: "Provide evidence of ISO 27001 (or equivalent) for handling personal data." },
    { tag: "MUST", text: "Include signed declarations (eligibility, non-collusion, confidentiality)." },
    { tag: "SHOULD", text: "Provide at least 2 reference projects of comparable scope within the last 3 years." },
  ],
  risks: [
    {
      severity: "high",
      title: "Acceptance tests not fully defined",
      detail: "Acceptance testing is referenced but measurable pass/fail criteria and sign-off roles are not specified.",
    },
    {
      severity: "medium",
      title: "Support SLA ambiguity",
      detail: "Response times and exclusions are unclear (business hours vs 24/7, escalation, planned downtime).",
    },
    {
      severity: "low",
      title: "Reference template may be strict",
      detail: "The annex suggests a fixed structure for references; confirm whether your format is accepted.",
    },
  ],
  questions: [
    "Can you confirm the exact submission packaging rules (file naming, number of files, signatures)?",
    "What are the acceptance test criteria and who provides final sign-off?",
    "Is ISO 27001 mandatory, or are equivalent certifications/controls acceptable?",
  ],
  draft:
    "1. Executive summary\n2. Understanding of scope\n3. Proposed approach and methodology\n4. Delivery plan and milestones\n5. Team and references\n6. Security and data protection\n7. Service and support model (SLA)\n8. Pricing\n9. Compliance and declarations",
  extractedText:
    "1. Submission\nOffers must be submitted through the Authority e-procurement portal no later than 12:00 CET on 14 May 2026. The submission must include a technical offer and a commercial offer as separate PDF files. File naming conventions apply.\n\n2. Eligibility and declarations\nBidders shall include signed declarations regarding eligibility, non-collusion, and confidentiality. The Authority may request additional documentation during clarification.\n\n3. Data protection and security\nThe Contractor will process personal data. Evidence of information security controls (ISO 27001 certification or equivalent) is requested.\n\n4. Delivery and acceptance\nThe delivery shall follow the milestone schedule described in Annex B. Acceptance testing will be performed prior to go-live. Acceptance criteria are referenced but not specified in measurable terms.\n\n5. Support and SLA\nThe Contractor shall provide support services. The tender mentions response times and escalation paths but does not explicitly define whether service hours are business hours or 24/7.\n\n6. Evaluation\nAwards will be based on price (40%), technical approach (40%), and team experience (20%).",
};

function TagPill({ tag }: { tag: string }) {
  const variant = tag === "MUST" ? "destructive" : tag === "SHOULD" ? "secondary" : "outline";
  return (
    <Badge variant={variant as any} className="rounded-full">
      {tag}
    </Badge>
  );
}

function SeverityPill({ sev }: { sev: "high" | "medium" | "low" }) {
  if (sev === "high") return <Badge variant="destructive" className="rounded-full">High</Badge>;
  if (sev === "medium") return <Badge variant="secondary" className="rounded-full">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full">Low</Badge>;
}

export default function SampleOutputPage() {
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
            <Button asChild variant="outline" className="rounded-full">
              <a
                href={WAITLIST_URL}
                target="_blank"
                rel="noreferrer"
                data-umami-event="cta_early_access_header"
              >
                Join early access
              </a>
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

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6 md:px-8 md:pt-14">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Sample output
          </Badge>
          <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            {SAMPLE.submissionDeadline}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">See the review workspace format</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground leading-relaxed">
              This is a curated example of what you get after upload: decision snapshot, key MUST items, top risks,
              clarifications, and a short draft outline.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/">Back to landing</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <a
                href={WAITLIST_URL}
                target="_blank"
                rel="noreferrer"
                data-umami-event="cta_early_access_sample"
              >
                Join early access
              </a>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/app/upload" data-umami-event="cta_upload_sample">
                Upload file
              </Link>
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Example only. Always verify requirements and legal language against the original tender document.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <ExecutiveSummary
          decisionBadge={SAMPLE.executive.decisionBadge}
          decisionLine={SAMPLE.executive.decisionLine}
          keyFindings={SAMPLE.executive.keyFindings}
          topRisks={SAMPLE.executive.topRisks as any[]}
          nextActions={SAMPLE.executive.nextActions}
          submissionDeadline={SAMPLE.submissionDeadline}
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What’s inside</h2>
            <p className="mt-2 text-sm text-muted-foreground">A fast scan of the items that drive the bid decision.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Requirements</CardTitle>
              <p className="text-sm text-muted-foreground">MUST items surfaced first to avoid disqualification.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {SAMPLE.requirements.slice(0, 4).map((r, i) => (
                  <div key={i} className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-center gap-2">
                      <TagPill tag={r.tag} />
                      <p className="text-sm font-medium">{r.tag}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Risks</CardTitle>
              <p className="text-sm text-muted-foreground">Ambiguity and delivery threats prioritized by severity.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {SAMPLE.risks.map((r, i) => (
                  <div key={i} className="rounded-2xl border bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{r.title}</p>
                      <SeverityPill sev={r.severity as any} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clarifications</CardTitle>
              <p className="text-sm text-muted-foreground">Questions to resolve before committing effort.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {SAMPLE.questions.map((q, i) => (
                  <div key={i} className="rounded-2xl border bg-background/60 p-4">
                    <p className="text-sm leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Draft outline</CardTitle>
              <p className="text-sm text-muted-foreground">A structured starting point, not a final proposal.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-2xl border bg-background/60 p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{SAMPLE.draft}</pre>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Always verify MUST items against the source.</p>
                <Button asChild className="rounded-full">
                  <Link href="/app/upload">Upload file</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 md:px-8">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Source text excerpt</CardTitle>
            <p className="text-sm text-muted-foreground">
              A short excerpt of the extracted text. For real work, always validate against the original document.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="my-4" />
            <ScrollArea className="h-[240px] rounded-2xl border bg-background/60">
              <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap">{SAMPLE.extractedText}</div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-sm text-muted-foreground">TenderPilot</div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Landing
            </Link>
            <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
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
