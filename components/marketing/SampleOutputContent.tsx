"use client";

import Link from "next/link";
import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Search,
  Send,
} from "lucide-react";

import { BrandIcon } from "@/components/brand-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { loginWithNextHref } from "@/lib/access-mode";

type LocalePrefix = "" | "/en" | "/de" | "/it" | "/fr" | "/es";

type Severity = "BLOCKER" | "REVIEW" | "OK";

type SampleDict = {
  header: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  data: {
    fileName: string;
    submissionDeadline: string;
    decisionBadge: "GO" | "HOLD" | "NO-GO";
    decisionLine: string;
    mustItems: Array<{ title: string; status: Severity; evidence: string }>;
    risks: Array<{ title: string; severity: "High" | "Medium" | "Low" }>;
    questions: Array<{ q: string; why: string }>;
    bidRoom: Array<{ title: string; owner: string; due: string }>;
    exports: string[];
    sourceExcerpt: string;
  };
};

type Evidence = {
  id: string;
  page: number;
  title: string;
  excerpt: string;
  query: string;
  locateSnippet: string;
};

function pillDecision(decision: "GO" | "HOLD" | "NO-GO") {
  if (decision === "GO") {
    return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25";
  }
  if (decision === "HOLD") {
    return "bg-rose-50 text-rose-900 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/25";
  }
  return "bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/20";
}

function chip(text: string, className?: string) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold",
        className || "",
      ].join(" ")}
    >
      {text}
    </span>
  );
}

function SoftButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-xs font-semibold",
        "transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SegTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ value: string; label: string }>; // keep tiny
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 p-1">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={[
              "h-9 rounded-full px-4 text-sm font-semibold transition",
              active ? "bg-foreground text-background shadow-sm" : "text-foreground/80 hover:bg-background/60",
            ].join(" ")}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function MiniRing({ value }: { value: number }) {
  // Simple visual ring placeholder (no charts, no extra deps)
  return (
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 rounded-full border-[8px] border-muted" />
      <div className="absolute inset-0 rounded-full border-[8px] border-primary" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }} />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{value}%</div>
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <>
      {before}
      <mark className="rounded bg-amber-200/70 px-1 text-foreground">{match}</mark>
      {after}
    </>
  );
}

export function SampleOutputContent({
  localePrefix,
  dict,
}: {
  localePrefix: LocalePrefix;
  dict: SampleDict;
}) {
  const homeHref = localePrefix || "/";
  const howItWorksHref = `${localePrefix}/how-it-works`;
  const primaryCtaHref = loginWithNextHref("/app/upload");

  const [view, setView] = useState<"cockpit" | "evidence" | "bidroom" | "compliance" | "dashboard">("cockpit");

  const evidenceById: Record<string, Evidence> = useMemo(() => {
    const must = dict.data.mustItems;
    const e004: Evidence = {
      id: "E004",
      page: 1,
      title: must[0]?.title || "Acceptance test criteria",
      excerpt:
        must[0]?.evidence ||
        "MUST: The supplier shall pass acceptance tests according to Annex 4. Acceptance is confirmed by written sign-off.",
      query: "MUST: The solution MUST support PDF and DOCX uploads and process one file per bid kit.",
      locateSnippet: "MUST: The solution MUST support PDF and DOCX uploads and process one file per bid kit.",
    };
    const e005: Evidence = {
      id: "E005",
      page: 1,
      title: must[1]?.title || "SLA penalties and service credits",
      excerpt:
        must[1]?.evidence ||
        "MUST: Service credits may be applied for each month below 99.5% availability. No maximum cap specified.",
      query: "MUST: The system MUST provide a list of requirements grouped as MUST / SHOULD / INFO.",
      locateSnippet: "MUST: The system MUST provide a list of requirements grouped as MUST / SHOULD / INFO.",
    };
    return { E004: e004, E005: e005 };
  }, [dict.data.mustItems]);

  const [evidenceId, setEvidenceId] = useState<"E004" | "E005">("E004");
  const [showEvidenceExcerpt, setShowEvidenceExcerpt] = useState(true);
  const [showLocate, setShowLocate] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchPhrase, setSearchPhrase] = useState(evidenceById[evidenceId]?.query || "");
  const referenceRef = useRef<HTMLDivElement | null>(null);

  const activeEvidence = evidenceById[evidenceId];

  const blockers = dict.data.mustItems.map((m) => m.title).slice(0, 3);

  function openEvidence(id: "E004" | "E005") {
    setEvidenceId(id);
    setSearchPhrase(evidenceById[id]?.query || "");
    setShowEvidenceExcerpt(true);
    setShowLocate(true);
    setView("evidence");
    window.setTimeout(() => referenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function safeCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  const tabs = useMemo(
    () => [
      { value: "cockpit", label: "Cockpit" },
      { value: "evidence", label: "Evidence & Source" },
      { value: "bidroom", label: "Bid Room" },
      { value: "compliance", label: "Proposal coverage" },
      { value: "dashboard", label: "Dashboard" },
    ],
    []
  );

  // Static reference text (kept short but looks real)
  const referenceText = useMemo(() => {
    return `[PAGE 1]\n\nTenderPilot Test RFP (v1)\n\nPurpose: This is a small synthetic tender document designed to test extraction of MUST / SHOULD / INFO requirements, risks, and clarifications.\n\n1. Scope\n\nThe supplier shall provide an in-vehicle data collection solution and a short implementation plan. The buyer will evaluate compliance, clarity, and delivery feasibility.\n\n2. Requirements (explicit keywords)\n\nMUST: The solution MUST support PDF and DOCX uploads and process one file per bid kit.\n\nMUST: The system MUST provide a list of requirements grouped as MUST / SHOULD / INFO.\n\nMUST: The supplier MUST deliver within 4 weeks from contract signature.\n\nSHOULD: The supplier SHOULD provide a short draft response outline with headings.\n\nSHOULD: The supplier SHOULD include a risk register with High / Medium / Low severity.\n\nINFO: The buyer prefers email communication and expects weekly status updates.\n\n3. Commercial & Legal\n\n${dict.data.sourceExcerpt}`;
  }, [dict.data.sourceExcerpt]);

  return (
    <div className="min-h-screen bg-background aurora-bg overflow-x-hidden">
      {/* Marketing header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
              <BrandIcon className="h-7 w-7" />
              <span>TenderPilot</span>
            </Link>

            <div className="flex items-center gap-3">
              <Button asChild variant="outline" className="rounded-full border-white/10">
                <Link href={howItWorksHref}>{dict.header.secondaryCta}</Link>
              </Button>
              <Button asChild className="rounded-full bg-primary text-primary-foreground">
                <Link href={primaryCtaHref}>
                  {dict.header.primaryCta} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{dict.header.title}</h1>
          <p className="mt-4 text-muted-foreground text-lg">{dict.header.subtitle}</p>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <SegTabs value={view} onChange={(v) => setView(v as any)} items={tabs} />
        </div>

        {/* App preview container */}
        <div className="mt-8 rounded-3xl border border-border bg-background/60 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/40 overflow-hidden">
          {/* Job header (matches app) */}
          <div className="px-6 py-5 border-b border-border bg-card/60">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-semibold truncate">{dict.data.fileName}</p>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/25">
                    Ready
                  </span>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/20">
                    Text extracted
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Your tender review is ready.</p>
                <p className="mt-1 text-xs text-muted-foreground">Drafting support only. Always verify against the original tender document.</p>
              </div>

              <div className="flex items-center gap-2 justify-start md:justify-end">
                <button
                  type="button"
                  onClick={() => setView("dashboard")}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted/30"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <Button className="rounded-full" disabled>
                  Download Bid Pack (Excel)
                </Button>

                <Button variant="outline" className="rounded-full" disabled>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 bg-muted/10">
            {/* Views */}
            {view === "cockpit" ? (
              <div className="space-y-6">
                {/* Decision card */}
                <Card className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
                  <CardContent className="p-7 md:p-10">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Decision</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={["inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", pillDecision(dict.data.decisionBadge)].join(" ")}
                          >
                            {dict.data.decisionBadge}
                          </span>
                          <div className={["inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", pillDecision(dict.data.decisionBadge)].join(" ")}
                          >
                            Fixable blockers remaining: 6
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-rose-200/40 bg-rose-500/5 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                          <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">Top blockers</p>
                          <ul className="mt-2 space-y-2 text-sm text-rose-950/90 dark:text-rose-100">
                            {blockers.map((t, i) => (
                              <li key={i} className="leading-relaxed">• {t}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Button className="rounded-full" onClick={() => setView("bidroom")}
                        >
                          Open Bid Room
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Decision drivers */}
                <Card className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
                  <CardContent className="p-7 md:p-10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Decision drivers</p>
                        <p className="mt-1 text-xs text-muted-foreground">Structured drivers only. Verify using Evidence & Source.</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-muted/30 p-4">
                        <p className="text-xs font-semibold">Blockers</p>
                        <div className="mt-3 space-y-2">
                          {dict.data.mustItems.slice(0, 5).map((m, i) => (
                            <div key={i} className="rounded-xl border border-border bg-card p-3">
                              <p className="text-sm text-foreground/90 leading-relaxed">• {m.title}</p>
                              <div className="mt-2 flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() => openEvidence(i % 2 === 0 ? "E004" : "E005")}
                                >
                                  Open evidence
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-muted/30 p-4">
                        <p className="text-xs font-semibold">Strategic risks</p>
                        <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                          {dict.data.risks.slice(0, 5).map((r, i) => (
                            <li key={i} className="leading-relaxed">• {r.title}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-border bg-muted/30 p-4">
                        <p className="text-xs font-semibold">Immediate actions</p>
                        <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                          <li className="leading-relaxed">• Confirm expected format of draft response (bullets vs narrative).</li>
                          <li className="leading-relaxed">• Clarify if mandatory templates exist for commercial and legal sections.</li>
                          <li className="leading-relaxed">• Verify deployment environment preference (buyer cloud vs SaaS).</li>
                        </ul>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="rounded-xl border border-border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold">Clarification questions</p>
                            <p className="mt-1 text-xs text-muted-foreground">Copy-ready list for the contracting authority.</p>
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={async () => {
                              const text = dict.data.questions.map((q) => `- ${q.q}`).join("\n");
                              const ok = await safeCopy(text);
                              if (ok) {
                                setCopied("questions");
                                window.setTimeout(() => setCopied(null), 1200);
                              }
                            }}
                          >
                            {copied === "questions" ? "Copied" : "Copy"}
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {dict.data.questions.slice(0, 4).map((q, i) => (
                            <div key={i} className="rounded-lg border border-border bg-card p-3">
                              <p className="text-sm text-foreground/90">{q.q}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">{q.why}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {view === "evidence" ? (
              <div className="space-y-6">
                <Card className="rounded-3xl border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
                  <CardContent className="p-7 md:p-10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Evidence & Source</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Verification-only reference. Use “Locate in source” as best-effort highlight, then confirm in the original PDF.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div ref={referenceRef} className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Reference text (verification only)</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Best-effort highlight. Always confirm exact wording and formatting in the original tender document.
                      </p>
                    </div>
                    <Button variant="outline" className="rounded-full" disabled>
                      Reference text
                    </Button>
                  </div>

                  {/* Evidence excerpt */}
                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">Evidence excerpt</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            ID: <span className="font-medium text-foreground">{activeEvidence.id}</span> • Page {activeEvidence.page}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">Switch evidence:</span>
                            {(["E004", "E005"] as const).map((eid) => {
                              const active = eid === evidenceId;
                              return (
                                <Button
                                  key={eid}
                                  type="button"
                                  size="sm"
                                  variant={active ? "default" : "outline"}
                                  className="rounded-full"
                                  onClick={() => {
                                    setEvidenceId(eid);
                                    setSearchPhrase(evidenceById[eid].query);
                                    setShowEvidenceExcerpt(true);
                                    setShowLocate(true);
                                  }}
                                >
                                  {eid}
                                </Button>
                              );
                            })}
                          </div>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Excerpt is authoritative (from the pipeline evidence map). “Locate in source” is best-effort—verify in the original PDF.
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            className="rounded-full"
                            onClick={() => {
                              setShowEvidenceExcerpt(true);
                            }}
                          >
                            Open evidence excerpt
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                              setShowLocate(true);
                              window.setTimeout(() => referenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                            }}
                          >
                            Locate in source (best-effort)
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={async () => {
                              const ok = await safeCopy(activeEvidence.excerpt);
                              if (ok) {
                                setCopied("excerpt");
                                window.setTimeout(() => setCopied(null), 1200);
                              }
                            }}
                          >
                            {copied === "excerpt" ? "Copied" : "Copy excerpt"}
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                              setShowEvidenceExcerpt(false);
                              setShowLocate(false);
                            }}
                          >
                            Close
                          </Button>
                        </div>
                      </div>

                      {showEvidenceExcerpt ? (
                        <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                          <p className="text-sm text-foreground/90 leading-relaxed">{activeEvidence.excerpt}</p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Locate */}
                  {showLocate ? (
                    <Card className="rounded-2xl">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold">Locate in source (best-effort)</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Match for: <span className="font-medium text-foreground">{activeEvidence.query}</span>
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              This view highlights a best-effort match in the extracted Source text. Use it as a pointer only: locate the same clause in the original PDF (search the phrase) and verify the exact wording and formatting.
                            </p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              className="rounded-full"
                              onClick={async () => {
                                const ok = await safeCopy(activeEvidence.locateSnippet);
                                if (ok) {
                                  setCopied("phrase");
                                  window.setTimeout(() => setCopied(null), 1200);
                                }
                              }}
                            >
                              {copied === "phrase" ? "Copied" : "Copy phrase"}
                            </Button>
                            <Button variant="outline" className="rounded-full" onClick={() => setShowLocate(false)}>
                              Close locate view
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                          <p className="text-sm text-foreground/90 leading-relaxed">{activeEvidence.locateSnippet}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* Search */}
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Search within reference text</p>
                      <p className="mt-1 text-xs text-muted-foreground">Best-effort highlight. Always confirm in the original PDF for legal wording.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                          value={searchPhrase}
                          onChange={(e) => setSearchPhrase(e.target.value)}
                          placeholder="Search phrase..."
                          className="w-[260px] bg-transparent text-sm outline-none"
                        />
                      </div>
                      <Button
                        className="rounded-full"
                        onClick={() => {
                          // scroll into view for the user
                          referenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Find
                      </Button>
                    </div>
                  </div>

                  {/* Reference text box */}
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="text-xs text-muted-foreground mb-3">Reference text</div>
                    <div className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/90">
                      {highlightText(referenceText, searchPhrase)}
                    </div>
                    <Separator className="my-4" />
                    <p className="text-xs text-muted-foreground">
                      Verification support only. Always confirm requirements and legal language against the original tender document.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {view === "bidroom" ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold">Bid Room</p>
                    <p className="mt-1 text-sm text-muted-foreground">Work view: assign owners, track tasks, and coordinate the bid.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Job: {dict.data.fileName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="rounded-full" onClick={() => setView("compliance")}
                    >
                      Compliance matrix
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={() => setView("cockpit")}
                    >
                      Back to job
                    </Button>
                  </div>
                </div>

                <Card className="rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Bid metadata</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deadline: Add deadline · Owner: Add owner · Portal: Add portal
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Operational context (team decision) is set on the job page.</p>
                      </div>
                      <Button variant="outline" className="rounded-full" disabled>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Bid Room</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Assign owners, track status, and leave short notes. This overlays the evidence-first results (it does not change them).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" className="rounded-full" disabled>
                          Open original PDF
                        </Button>
                        <Button variant="outline" className="rounded-full" disabled>
                          Export Bid Pack
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {chip("Items: 12")}
                      {chip("Done: 0")}
                      {chip("Blocked: 0")}
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">Search items…</div>
                        <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                          All types <ChevronDown className="h-4 w-4" />
                        </div>
                        <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                          All status <ChevronDown className="h-4 w-4" />
                        </div>
                        <Button variant="outline" className="rounded-full" disabled>
                          Hiding done
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border bg-card">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <p className="text-xs font-semibold">Work items</p>
                        <p className="text-xs text-muted-foreground">Operational overlay only. This does not change the AI decision.</p>
                      </div>

                      <div className="p-4 space-y-3">
                        {dict.data.mustItems.slice(0, 4).map((m, i) => (
                          <div key={i} className="rounded-2xl border border-border bg-background p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {chip("Requirement · MUST", "text-xs")}
                                  <span className="text-xs text-muted-foreground">requirement_{(1000 + i).toString(16)}</span>
                                </div>
                                <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{m.title}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button variant="outline" className="rounded-full" onClick={() => openEvidence(i % 2 === 0 ? "E004" : "E005")}
                                >
                                  Open evidence
                                </Button>
                                <Button variant="outline" className="rounded-full" disabled>
                                  Locate in PDF
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-2 md:grid-cols-4">
                              <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">Owner</div>
                              <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">Todo</div>
                              <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">dd/mm/yyyy</div>
                              <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">Add note</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {view === "compliance" ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold">Proposal coverage</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Audit lens for requirements. Set compliance stance and map where each requirement is addressed in the proposal.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This is not task tracking. Use Bid Room for owners, due dates, and operational status.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="rounded-full" onClick={() => setView("bidroom")}
                    >
                      Open Bid Room
                    </Button>
                    <Button variant="outline" className="rounded-full" disabled>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground">Gate</p>
                      <p className="mt-1 text-lg font-semibold">MUST gaps: 6</p>
                      <p className="mt-1 text-xs text-muted-foreground">MUST TBD: 0 · Partial: 0 · Non-compliant: 0</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground">Gaps</p>
                      <p className="mt-1 text-lg font-semibold">6 / 6</p>
                      <p className="mt-1 text-xs text-muted-foreground">TBD: 6 · Partial: 0 · Non-compliant: 0</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground">Covered</p>
                      <p className="mt-1 text-lg font-semibold">0 / 6</p>
                      <p className="mt-1 text-xs text-muted-foreground">Compliant: 0 · N/A: 0</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">Search requirement, proposal section, notes…</div>
                      <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                        All levels <ChevronDown className="h-4 w-4" />
                      </div>
                      <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                        All statuses <ChevronDown className="h-4 w-4" />
                      </div>
                      {chip("Rows: 6")}
                      {chip("Evidence map: 7")}
                      <Button variant="outline" className="rounded-full" disabled>
                        View
                      </Button>
                      <Button className="rounded-full" disabled>
                        Gaps
                      </Button>
                      <Button variant="outline" className="rounded-full" disabled>
                        Full
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold">Gaps queue</p>
                    <p className="mt-1 text-xs text-muted-foreground">Set stance, map proposal section, justify with evidence.</p>

                    <div className="mt-4 space-y-4">
                      {dict.data.mustItems.slice(0, 3).map((m, i) => (
                        <div key={i} className="rounded-2xl border border-border bg-background p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                                  MUST
                                </span>
                                <span className="text-xs text-muted-foreground">requirement_{(1000 + i).toString(16)}</span>
                                <span className="inline-flex items-center rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-semibold">
                                  Gap
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{m.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Evidence: 2 id(s) · PDF page 1</p>
                            </div>

                            <div className="w-full md:w-[340px] space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Compliance stance</p>
                                  <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground inline-flex items-center justify-between">
                                    TBD <ChevronDown className="h-4 w-4" />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Proposal section</p>
                                  <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">e.g. 2.1 / Annex A</div>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Audit note</p>
                                <div className="rounded-full border border-border bg-background px-4 py-2 text-xs text-muted-foreground">
                                  Why this stance (short, audit-friendly)
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" className="rounded-full" onClick={() => openEvidence(i % 2 === 0 ? "E004" : "E005")}
                                >
                                  Evidence
                                </Button>
                                <Button variant="outline" className="rounded-full" disabled>
                                  Locate in PDF
                                </Button>
                                <Button
                                  className="rounded-full ml-auto"
                                  onClick={() => {
                                    setView("bidroom");
                                  }}
                                >
                                  Send to Bid Room
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {view === "dashboard" ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold">Dashboard</p>
                    <p className="mt-1 text-sm text-muted-foreground">High-signal triage for decisions, deadlines, and execution.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild className="rounded-full">
                      <Link href={primaryCtaHref}>New bid</Link>
                    </Button>
                    <Button variant="outline" className="rounded-full" disabled>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold">Portfolio</p>
                      <div className="mt-4 flex items-center gap-3">
                        <MiniRing value={14} />
                        <div>
                          <p className="text-xs text-muted-foreground">basics present</p>
                          <p className="text-lg font-bold">14%</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">Deadline/decision from AI extraction unless overridden.</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold">Deadlines</p>
                      <div className="mt-4 flex items-center gap-3">
                        <MiniRing value={14} />
                        <div>
                          <p className="text-xs text-muted-foreground">% urgent</p>
                          <p className="text-lg font-bold">14%</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-muted" />
                      <p className="mt-2 text-xs text-muted-foreground">Overdue 1 · 0-7d 0 · 8-30d 0 · 31-90d 0 · Unknown 6</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold">Execution</p>
                      <div className="mt-4 flex items-center gap-3">
                        <MiniRing value={68} />
                        <div>
                          <p className="text-xs text-muted-foreground">% done</p>
                          <p className="text-lg font-bold">68%</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">Based on team work items.</p>
                      <p className="mt-1 text-xs text-muted-foreground">36 done · 17 open · 8 blocked</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold">Decisions</p>
                      <div className="mt-4 flex items-center gap-3">
                        <MiniRing value={100} />
                        <div>
                          <p className="text-xs text-muted-foreground">% decided</p>
                          <p className="text-lg font-bold">100%</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">AI suggestion unless overridden by team decision.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Go 2 · Hold 3 · No-Go 2 · Missing 0</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Operational queues</p>
                        <p className="mt-1 text-xs text-muted-foreground">Actionable queues for daily delivery. Works even when the tender PDF has no deadline or decision.</p>
                      </div>
                      <Button variant="outline" className="rounded-full" disabled>
                        Expand
                      </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {chip("Needs triage 0")}
                      {chip("Deadline unknown 6")}
                      {chip("Due next 7d 0")}
                      {chip("Overdue items 5")}
                      {chip("Blocked 8")}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">
            This is a static preview built to mirror the real app UX. Start a real workspace with your tender in under a minute.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full px-10 h-12">
              <Link href={primaryCtaHref}>
                {dict.header.primaryCta} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-10 h-12">
              <Link href={howItWorksHref}>{dict.header.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
