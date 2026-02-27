import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, HelpCircle, FileText, ListChecks, FileSpreadsheet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandIcon } from "@/components/brand-icon";
import { loginWithNextHref } from "@/lib/access-mode";

type Severity = "BLOCKER" | "REVIEW" | "OK";

type SampleDict = {
  header: {
    backToHome: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  workspace: { title: string; desc: string };
  counts: { title: string; must: string; risks: string; qa: string; work: string; microcopy: string };
  sections: {
    mustTitle: string;
    risksTitle: string;
    bulletsTitle: string;
  };
  tabs: {
    compliance: string;
    bidroom: string;
    risks: string;
    questions: string;
    outline: string;
    exports: string;
    source: string;
  };
  tabContent: {
    complianceTitle: string;
    complianceDesc: string;
    bidroomTitle: string;
    bidroomDesc: string;
    exportsTitle: string;
    exportsDesc: string;
    sourceTitle: string;
    sourceDesc: string;
  };
  labels: {
    deadline: string;
    decision: string;
    must: string;
    risks: string;
    clarifications: string;
    workItems: string;
    evidence: string;
  };
  data: {
    fileName: string;
    submissionDeadline: string;
    decisionBadge: "GO" | "HOLD" | "NO-GO";
    decisionLine: string;
    mustItems: Array<{ title: string; status: Severity; evidence: string }>;
    risks: Array<{ title: string; severity: "High" | "Medium" | "Low" }>;
    questions: Array<{ q: string; why: string }>;
    outline: string[];
    bidRoom: Array<{ title: string; owner: string; due: string }>;
    exports: string[];
    sourceExcerpt: string;
  };
};

function severityBadge(s: Severity) {
  if (s === "BLOCKER") return <Badge variant="destructive">BLOCKER</Badge>;
  if (s === "REVIEW") return <Badge variant="secondary">REVIEW</Badge>;
  return <Badge variant="default">OK</Badge>;
}

function decisionBadge(decision: "GO" | "HOLD" | "NO-GO") {
  if (decision === "GO") return <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">GO</Badge>;
  if (decision === "HOLD") return <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">HOLD</Badge>;
  return <Badge className="bg-red-500/15 text-red-300 border border-red-500/30">NO-GO</Badge>;
}

export function SampleOutputContent({
  localePrefix,
  dict,
}: {
  localePrefix: "" | "/en" | "/de" | "/it" | "/fr" | "/es";
  dict: SampleDict;
}) {
  const homeHref = localePrefix || "/";
  const howItWorksHref = `${localePrefix}/how-it-works`;
  const primaryCtaHref = loginWithNextHref("/app/upload");

  const mustCount = dict.data.mustItems.length;
  const riskCount = dict.data.risks.length;
  const qaCount = dict.data.questions.length;
  const workCount = dict.data.bidRoom.length;

  return (
    <div className="min-h-screen bg-background aurora-bg overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/90 backdrop-blur-xl">
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
              <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-primary text-primary-foreground">
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

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          <Card className="glass-card border-white/10 lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{dict.workspace.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{dict.workspace.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  {decisionBadge(dict.data.decisionBadge)}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-400">{dict.labels.decision}</p>
                    <p className="text-lg font-semibold mt-1">{dict.data.decisionLine}</p>
                  </div>
                  <div className="text-sm text-zinc-400">
                    <span className="font-medium text-zinc-200">{dict.labels.deadline}:</span>{" "}
                    {dict.data.submissionDeadline}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-zinc-400">{dict.labels.must}</div>
                  <div className="mt-2 text-2xl font-bold">{mustCount}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-zinc-400">{dict.labels.risks}</div>
                  <div className="mt-2 text-2xl font-bold">{riskCount}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-zinc-400">{dict.labels.clarifications}</div>
                  <div className="mt-2 text-2xl font-bold">{qaCount}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-zinc-400">{dict.labels.workItems}</div>
                  <div className="mt-2 text-2xl font-bold">{workCount}</div>
                </div>
              </div>

              <p className="mt-4 text-sm text-zinc-500">{dict.counts.microcopy}</p>

              <Separator className="my-8 bg-white/10" />

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-emerald-300" />
                      {dict.sections.mustTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    {dict.data.mustItems.slice(0, 3).map((m, idx) => (
                      <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-medium">{m.title}</div>
                          {severityBadge(m.status)}
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">
                          <span className="text-zinc-300 font-medium">{dict.labels.evidence}:</span> {m.evidence}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                      {dict.sections.risksTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    {dict.data.risks.slice(0, 3).map((r, idx) => (
                      <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-medium">{r.title}</div>
                          <Badge variant="secondary">{r.severity}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-300" />
                {dict.sections.bulletsTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-3 text-sm text-zinc-300">
              {dict.data.questions.slice(0, 4).map((q, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="font-medium">{q.q}</div>
                  <div className="mt-1 text-xs text-zinc-400">{q.why}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-10">
          <Tabs defaultValue="compliance">
            <TabsList className="bg-white/5 border border-white/10 rounded-2xl p-1">
              <TabsTrigger value="compliance" className="rounded-xl">
                {dict.tabs.compliance}
              </TabsTrigger>
              <TabsTrigger value="bidroom" className="rounded-xl">
                {dict.tabs.bidroom}
              </TabsTrigger>
              <TabsTrigger value="exports" className="rounded-xl">
                {dict.tabs.exports}
              </TabsTrigger>
              <TabsTrigger value="outline" className="rounded-xl">
                {dict.tabs.outline}
              </TabsTrigger>
              <TabsTrigger value="source" className="rounded-xl">
                {dict.tabs.source}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compliance" className="mt-6">
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{dict.tabContent.complianceTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{dict.tabContent.complianceDesc}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dict.data.mustItems.map((m, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        <div className="mt-1 text-xs text-zinc-400">
                          <span className="text-zinc-300 font-medium">{dict.labels.evidence}:</span> {m.evidence}
                        </div>
                      </div>
                      {severityBadge(m.status)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bidroom" className="mt-6">
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{dict.tabContent.bidroomTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{dict.tabContent.bidroomDesc}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dict.data.bidRoom.map((w, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                      <div>
                        <div className="font-medium">{w.title}</div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {w.owner} · {w.due}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-zinc-500" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exports" className="mt-6">
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{dict.tabContent.exportsTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{dict.tabContent.exportsDesc}</p>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {dict.data.exports.map((e, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                      {idx === 0 ? (
                        <FileText className="h-5 w-5 text-blue-300" />
                      ) : (
                        <FileSpreadsheet className="h-5 w-5 text-emerald-300" />
                      )}
                      <div className="text-sm font-medium">{e}</div>
                    </div>
                  ))}
                  <div className="md:col-span-2 mt-2">
                    <Button asChild className="rounded-full">
                      <Link href={primaryCtaHref}>
                        {dict.header.primaryCta} <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="outline" className="mt-6">
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{dict.tabs.outline}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-zinc-300">
                  {dict.data.outline.map((o, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      {o}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="source" className="mt-6">
              <Card className="glass-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{dict.tabContent.sourceTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{dict.tabContent.sourceDesc}</p>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-zinc-300 rounded-xl border border-white/10 bg-black/30 p-4">
{dict.data.sourceExcerpt}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-14 text-center">
          <Button asChild size="lg" className="rounded-full px-12 h-14">
            <Link href={primaryCtaHref}>
              {dict.header.primaryCta} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </main>

      <footer className="border-t border-white/5 py-10 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 md:px-8 text-sm text-zinc-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} TenderPilot</span>
          <Link href={howItWorksHref} className="hover:text-zinc-300">
            {dict.header.secondaryCta}
          </Link>
        </div>
      </footer>
    </div>
  );
}
