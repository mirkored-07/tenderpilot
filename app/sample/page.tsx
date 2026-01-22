import Link from "next/link";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WAITLIST_URL =
  (process.env.NEXT_PUBLIC_WAITLIST_URL && process.env.NEXT_PUBLIC_WAITLIST_URL.trim()) ||
  "https://tally.so/r/gD9bkM";

const SAMPLE = {
  fileName: "standard-tender-document.pdf",
  status: "Review",
  submissionDeadline: "14 May 2026 — 12:00 CET",
  decision: {
    badge: "Proceed with caution",
    line:
      "No clear disqualifier detected, but two points need clarification: submission packaging and acceptance criteria for the support SLA.",
  },
  nextActions: [
    "Confirm submission packaging rules (PDF set + signed declarations).",
    "Clarify acceptance tests and deliverable sign-off process.",
    "Validate ISO 27001 evidence requirements and acceptable alternatives.",
  ],
  mustItems: [
    {
      id: "m1",
      title: "Submission method and deadline",
      detail:
        "Submit through the e-procurement portal before the deadline. Technical and commercial offers as separate PDFs. File naming conventions apply.",
      tag: "MUST",
    },
    {
      id: "m2",
      title: "Signed declarations and annexes",
      detail:
        "Include signed declarations (eligibility, non-collusion, confidentiality). Authority may request additional documentation during clarification.",
      tag: "MUST",
    },
    {
      id: "m3",
      title: "Security evidence (ISO 27001 or equivalent)",
      detail:
        "Tender requests evidence of security controls for processing personal data. Confirm whether ISO 27001 is strictly required or equivalence is accepted.",
      tag: "MUST",
    },
  ],
  risks: [
    {
      id: "r1",
      severity: "high" as const,
      title: "Acceptance criteria unclear",
      detail:
        "Acceptance testing is referenced but pass/fail criteria and sign-off roles are not defined. Risk of scope creep and late disputes.",
    },
    {
      id: "r2",
      severity: "medium" as const,
      title: "Support SLA ambiguity",
      detail:
        "Response times and service hours are unclear (business hours vs 24/7). Confirm escalation path, exclusions, and planned downtime handling.",
    },
    {
      id: "r3",
      severity: "low" as const,
      title: "Reference project template may be strict",
      detail:
        "Annex suggests a fixed structure for references. Confirm if your format is accepted or if a template is mandatory.",
    },
  ],
  keyBullets: [
    "Submission via portal; strict file naming rules.",
    "ISO 27001 evidence requested for data processing.",
    "Milestones exist but acceptance tests not defined.",
    "Evaluation weighted: price (40%), approach (40%), experience (20%).",
  ],
  questions: [
    "Can you confirm the exact submission packaging rules (file naming, number of files, signatures)?",
    "What are the acceptance test criteria and who provides final sign-off?",
    "Is ISO 27001 mandatory, or are equivalent certifications/controls acceptable?",
  ],
  draftOutline:
    "1. Executive summary\n2. Understanding of scope\n3. Proposed approach and methodology\n4. Delivery plan and milestones\n5. Team and references\n6. Security and data protection\n7. Service and support model (SLA)\n8. Pricing\n9. Compliance and declarations",
  sourceExcerpt:
    "1. Submission\nOffers must be submitted through the Authority e-procurement portal no later than 12:00 CET on 14 May 2026. The submission must include a technical offer and a commercial offer as separate PDF files. File naming conventions apply.\n\n2. Eligibility and declarations\nBidders shall include signed declarations regarding eligibility, non-collusion, and confidentiality. The Authority may request additional documentation during clarification.\n\n3. Data protection and security\nThe Contractor will process personal data. Evidence of information security controls (ISO 27001 certification or equivalent) is requested.\n\n4. Delivery and acceptance\nThe delivery shall follow the milestone schedule described in Annex B. Acceptance testing will be performed prior to go-live. Acceptance criteria are referenced but not specified in measurable terms.\n\n5. Support and SLA\nThe Contractor shall provide support services. The tender mentions response times and escalation paths but does not explicitly define whether service hours are business hours or 24/7.\n\n6. Evaluation\nAwards will be based on price (40%), technical approach (40%), and team experience (20%).",
};

function SeverityBadge({ sev }: { sev: "high" | "medium" | "low" }) {
  if (sev === "high") return <Badge variant="destructive" className="rounded-full">High</Badge>;
  if (sev === "medium") return <Badge variant="secondary" className="rounded-full">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full">Low</Badge>;
}
	type Tag = "MUST" | "SHOULD" | "INFO";

	function asTag(value: string): Tag {
	  const v = value.trim().toUpperCase();
	  if (v === "MUST" || v === "SHOULD" || v === "INFO") return v;
	  return "INFO";
	}


function TagBadge({ tag }: { tag: "MUST" | "SHOULD" | "INFO" }) {
  if (tag === "MUST") return <Badge variant="destructive" className="rounded-full">MUST</Badge>;
  if (tag === "SHOULD") return <Badge variant="secondary" className="rounded-full">SHOULD</Badge>;
  return <Badge variant="outline" className="rounded-full">INFO</Badge>;
}

export default function SamplePage() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      {/* Sticky workspace-like header */}
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          {/* Text only (no logo) */}
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              TenderPilot
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                {SAMPLE.fileName}
              </span>
              <Badge variant="secondary" className="rounded-full">
                {SAMPLE.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Match real app vibe: small, tight actions */}
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/">Back to home</Link>
            </Button>

            <Button variant="outline" className="rounded-full" disabled title="Disabled on sample page">
              Export tender list (PDF)
            </Button>

            <Button asChild className="rounded-full">
              <a href={WAITLIST_URL} target="_blank" rel="noreferrer" data-umami-event="cta_join_early_access_sample">
                Join early access
              </a>
            </Button>

            <Button variant="destructive" className="rounded-full" disabled title="Disabled on sample page">
              Delete
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="grid gap-4 md:grid-cols-12">
          {/* LEFT column (workspace cards) */}
          <div className="md:col-span-8 space-y-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Your tender workspace</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This is a static sample to preview the review format. Always verify against the original PDF.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="rounded-full">{SAMPLE.decision.badge}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{SAMPLE.decision.line}</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <p className="text-sm font-medium">Next actions</p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {SAMPLE.nextActions.map((a) => (
                        <li key={a} className="flex gap-2">
                          <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-foreground/40" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border bg-background/60 p-4">
                    <p className="text-sm font-medium">Quick counts</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border bg-background/80 p-3 text-center">
                        <p className="text-xs text-muted-foreground">MUST</p>
                        <p className="mt-1 text-lg font-semibold">{SAMPLE.mustItems.length}</p>
                      </div>
                      <div className="rounded-2xl border bg-background/80 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Risks</p>
                        <p className="mt-1 text-lg font-semibold">{SAMPLE.risks.length}</p>
                      </div>
                      <div className="rounded-2xl border bg-background/80 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Questions</p>
                        <p className="mt-1 text-lg font-semibold">{SAMPLE.questions.length}</p>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-muted-foreground">
                      Designed for speed. Built for traceability.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MUST items card */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">MUST items</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Hard requirements that can disqualify you.</p>
                  </div>
                  <Button variant="outline" className="rounded-full" disabled title="Sample page">
                    Export requirements
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {SAMPLE.mustItems.map((m) => (
                    <div key={m.id} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <TagBadge tag={asTag(m.tag)} />
                            <p className="text-sm font-medium">{m.title}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.detail}</p>
                        </div>

                        <Button variant="outline" className="rounded-full" size="sm" disabled title="Sample page">
                          Jump
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risks card */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Top risks</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Ambiguities that can impact delivery or cost.</p>
                  </div>
                  <Button variant="outline" className="rounded-full" disabled title="Sample page">
                    Export risks
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {SAMPLE.risks.map((r) => (
                    <div key={r.id} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{r.title}</p>
                        <SeverityBadge sev={r.severity} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.detail}</p>
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" className="rounded-full" size="sm" disabled title="Sample page">
                          Jump
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT column (deadline + bullets like in app) */}
          <div className="md:col-span-4 space-y-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Submission deadline</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Example only.</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-medium">{SAMPLE.submissionDeadline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Always confirm timezone and portal cut-off rules.
                  </p>
                </div>

                <Separator className="my-4" />

                <Button asChild className="w-full rounded-xl">
                  <a href={WAITLIST_URL} target="_blank" rel="noreferrer" data-umami-event="cta_join_early_access_sample_sidebar">
                    Join early access
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Key bullets</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Quick scan of what matters.</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {SAMPLE.keyBullets.map((b) => (
                    <div key={b} className="rounded-2xl border bg-background/60 p-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">{b}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom tabs like the real app section switcher */}
        <div className="mt-8">
          <Tabs defaultValue="requirements">
            <div className="flex items-center justify-between gap-3">
              <TabsList className="rounded-full">
                <TabsTrigger value="requirements" className="rounded-full">
                  Requirements
                </TabsTrigger>
                <TabsTrigger value="risks" className="rounded-full">
                  Risks
                </TabsTrigger>
                <TabsTrigger value="questions" className="rounded-full">
                  Clarifications
                </TabsTrigger>
                <TabsTrigger value="draft" className="rounded-full">
                  Tender outline
                </TabsTrigger>
                <TabsTrigger value="source" className="rounded-full">
                  Source text
                </TabsTrigger>
              </TabsList>

              <div className="hidden sm:flex items-center gap-2">
                <Button variant="outline" className="rounded-full" disabled title="Sample page">
                  Copy ready to send
                </Button>
                <Button variant="outline" className="rounded-full" disabled title="Sample page">
                  Copy risks
                </Button>
              </div>
            </div>

            <TabsContent value="requirements" className="mt-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Requirements</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These are the MUST/SHOULD items extracted from the tender.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {SAMPLE.mustItems.map((m) => (
                    <div key={m.id} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <TagBadge tag="MUST" />
                            <p className="text-sm font-medium">{m.title}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.detail}</p>
                        </div>
                        <Button variant="outline" className="rounded-full" size="sm" disabled title="Sample page">
                          Jump
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Risks</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Potential deal-breakers or cost drivers that need clarification.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 grid gap-3 md:grid-cols-2">
                  {SAMPLE.risks.map((r) => (
                    <div key={r.id} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{r.title}</p>
                        <SeverityBadge sev={r.severity} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.detail}</p>
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" className="rounded-full" size="sm" disabled title="Sample page">
                          Jump
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="questions" className="mt-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Clarification questions</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ask these before committing to price, timeline, or SLA.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {SAMPLE.questions.map((q) => (
                    <div key={q} className="rounded-2xl border bg-background/60 p-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{q}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="draft" className="mt-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tender outline</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A starting structure you can paste into your bid template.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                      {SAMPLE.draftOutline}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="source" className="mt-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Source text</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Example of extracted text for traceability (sample only).
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-2xl border bg-background/60 p-4">
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                      {SAMPLE.sourceExcerpt}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}
