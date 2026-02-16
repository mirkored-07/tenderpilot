import Link from "next/link";
import React from "react";
import {
  ArrowLeft,
  Download,
  Trash2,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy
} from "lucide-react";

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
  if (sev === "high") return <Badge variant="destructive" className="rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/50">High</Badge>;
  if (sev === "medium") return <Badge variant="secondary" className="rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/50">Medium</Badge>;
  return <Badge variant="outline" className="rounded-full border-white/10">Low</Badge>;
}

type Tag = "MUST" | "SHOULD" | "INFO";

function asTag(value: string): Tag {
  const v = value.trim().toUpperCase();
  if (v === "MUST" || v === "SHOULD" || v === "INFO") return v;
  return "INFO";
}

function TagBadge({ tag }: { tag: "MUST" | "SHOULD" | "INFO" }) {
  if (tag === "MUST") return <Badge variant="destructive" className="rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/50">MUST</Badge>;
  if (tag === "SHOULD") return <Badge variant="secondary" className="rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/50">SHOULD</Badge>;
  return <Badge variant="outline" className="rounded-full border-white/10">INFO</Badge>;
}

export default function SamplePage() {
  return (
    <main className="min-h-screen aurora-bg bg-background text-foreground selection:bg-blue-500/30">
      {/* Sticky workspace-like header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-6">
          {/* Text only (no logo) */}
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
              TenderPilot - AI Go/No-Go Decisions for Tenders & RFPs
            </Link>

            <div className="hidden items-center gap-2 md:flex border-l border-white/10 pl-4">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                {SAMPLE.fileName}
              </span>
              <Badge variant="outline" className="rounded-full border-white/10 bg-blue-500/10 text-blue-400">
                {SAMPLE.status}
              </Badge>
            </div>
          </div>

          {/* Desktop / tablet actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button asChild variant="ghost" className="rounded-full hover:bg-white/5">
              <Link href="/"><ArrowLeft className="w-4 h-4 mr-2"/> Back to home</Link>
            </Button>

            <Button variant="outline" className="rounded-full border-white/10 hover:bg-white/5" disabled title="Disabled on sample page">
              <Download className="w-4 h-4 mr-2" /> Export PDF
            </Button>

            <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-primary text-primary-foreground hover:bg-primary/90">
              <a
                href={WAITLIST_URL}
                target="_blank"
                rel="noreferrer"
                data-umami-event="cta_join_early_access_sample"
              >
                Join early access
              </a>
            </Button>

            <Button variant="ghost" className="rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/10" disabled title="Disabled on sample page">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-2 md:hidden">
            <Button asChild variant="ghost" className="rounded-full h-9 w-9 p-0">
              <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>

            <Button asChild className="rounded-full text-xs h-8">
              <a
                href={WAITLIST_URL}
                target="_blank"
                rel="noreferrer"
                data-umami-event="cta_join_early_access_sample"
              >
                Join
              </a>
            </Button>

            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-white/5 p-2 text-foreground/90 [&::-webkit-details-marker]:hidden">
                <MoreVertical className="w-4 h-4" />
              </summary>

              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl backdrop-blur-xl z-50">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-50 cursor-not-allowed flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export sample
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 opacity-50 cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-6 md:grid-cols-12">
          {/* LEFT column (workspace cards) */}
          <div className="md:col-span-8 space-y-6">
            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Your tender workspace</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This is a static sample showing how TenderPilot structures a tender review. 
                      Always verify against the original PDF.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
				  {/* FIX: Changed text-amber-300 to text-amber-200 and added font-bold for max readability */}
				  <Badge className="rounded-full bg-amber-800/20 text-amber-200 font-medium border-amber-500/30 pointer-events-none">
					{SAMPLE.decision.badge}
				  </Badge>
				</div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-foreground/90 leading-relaxed">{SAMPLE.decision.line}</p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <p className="text-sm font-medium">Next actions</p>
                    </div>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {SAMPLE.nextActions.map((a) => (
                        <li key={a} className="flex gap-2 leading-relaxed">
                          <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-medium mb-3">Quick counts</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">MUST</p>
                        <p className="mt-1 text-xl font-bold">{SAMPLE.mustItems.length}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Risks</p>
                        <p className="mt-1 text-xl font-bold text-amber-400">{SAMPLE.risks.length}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Q&A</p>
                        <p className="mt-1 text-xl font-bold">{SAMPLE.questions.length}</p>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-muted-foreground leading-relaxed opacity-70">
                      Designed for speed. Built for traceability.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MUST items card */}
            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">MUST items</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Hard requirements that can disqualify you.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" disabled>
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {SAMPLE.mustItems.map((m) => (
                    <div key={m.id} className="group rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <TagBadge tag={asTag(m.tag)} />
                            <p className="text-sm font-semibold">{m.title}</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{m.detail}</p>
                        </div>

                        <Button variant="outline" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity border-white/10 bg-transparent hover:bg-white/10" size="sm" disabled>
                          Jump
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risks card */}
            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Top risks</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Ambiguities that can impact delivery or cost.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" disabled>
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {SAMPLE.risks.map((r) => (
                    <div key={r.id} className="group rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-sm font-semibold">{r.title}</p>
                        <SeverityBadge sev={r.severity} />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{r.detail}</p>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity border-white/10 bg-transparent hover:bg-white/10" size="sm" disabled>
                          Jump
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT column (deadline + bullets) */}
          <div className="md:col-span-4 space-y-6">
            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Deadline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-lg font-bold">{SAMPLE.submissionDeadline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirm timezone & portal rules
                  </p>
                </div>

                <Separator className="my-6 bg-white/10" />

                <Button asChild className="w-full rounded-xl shadow-lg shadow-blue-500/20">
                  <a
                    href={WAITLIST_URL}
                    target="_blank"
                    rel="noreferrer"
                    data-umami-event="cta_join_early_access_sample_sidebar"
                  >
                    Join early access
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Key bullets</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Quick scan of what matters.</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {SAMPLE.keyBullets.map((b) => (
                    <div key={b} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                      <p className="text-sm text-muted-foreground leading-relaxed">{b}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom tabs */}
        <div className="mt-12">
          <Tabs defaultValue="requirements">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="h-auto p-1 bg-white/5 border border-white/10 rounded-full overflow-x-auto justify-start w-full sm:w-auto">
                <TabsTrigger value="requirements" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Requirements
                </TabsTrigger>
                <TabsTrigger value="risks" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Risks
                </TabsTrigger>
                <TabsTrigger value="questions" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Clarifications
                </TabsTrigger>
                <TabsTrigger value="draft" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Outline
                </TabsTrigger>
                <TabsTrigger value="source" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Source
                </TabsTrigger>
              </TabsList>

              <div className="hidden sm:flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-full border-white/10 hover:bg-white/5" disabled>
                  <Copy className="w-4 h-4 mr-2" /> Copy all
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <TabsContent value="requirements">
                <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
                   {/* Content reused from above logic for brevity, matches structure */}
                   <CardHeader className="pb-4"><CardTitle className="text-lg">Detailed Requirements</CardTitle></CardHeader>
                   <CardContent className="pt-0 space-y-3">
                      {SAMPLE.mustItems.map((m) => (
                         <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex gap-4">
                            <TagBadge tag="MUST" />
                            <div>
                               <p className="text-sm font-medium">{m.title}</p>
                               <p className="text-sm text-muted-foreground mt-1">{m.detail}</p>
                            </div>
                         </div>
                      ))}
                   </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="risks">
                 <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
                   <CardHeader className="pb-4"><CardTitle className="text-lg">Risk Register</CardTitle></CardHeader>
                   <CardContent className="pt-0 grid gap-3 md:grid-cols-2">
                      {SAMPLE.risks.map((r) => (
                         <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex justify-between mb-2">
                               <p className="text-sm font-medium">{r.title}</p>
                               <SeverityBadge sev={r.severity} />
                            </div>
                            <p className="text-sm text-muted-foreground">{r.detail}</p>
                         </div>
                      ))}
                   </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="questions">
                <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Clarification questions</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ask these before committing to price, timeline, or SLA.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {SAMPLE.questions.map((q) => (
                      <div key={q} className="rounded-xl border border-white/10 bg-white/5 p-4 flex gap-3">
                         <HelpCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                         <p className="text-sm text-muted-foreground leading-relaxed">{q}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="draft">
                <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Tender outline</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A starting structure you can paste into your bid template.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-6 font-mono text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {SAMPLE.draftOutline}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="source">
                <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Source text</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Extracted text for traceability.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-6 font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                      {SAMPLE.sourceExcerpt}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </main>
  );
}