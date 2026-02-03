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

function TagBadge({ tag }: { tag: "MUST" | "SHOULD" | "INFO" }) {
  if (tag === "MUST") return <Badge variant="destructive" className="rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/50">MUST</Badge>;
  if (tag === "SHOULD") return <Badge variant="secondary" className="rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/50">SHOULD</Badge>;
  return <Badge variant="outline" className="rounded-full border-white/10">INFO</Badge>;
}

function asTag(value: string): "MUST" | "SHOULD" | "INFO" {
  const v = value.trim().toUpperCase();
  if (v === "MUST" || v === "SHOULD" || v === "INFO") return v;
  return "INFO";
}

export default async function SamplePage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;
  const nav = dict.nav as { title: string };
  const t = dict.samplePage as any;
  const SAMPLE = t.data as any;

  function SeverityBadge({ sev }: { sev: "high" | "medium" | "low" }) {
    if (sev === "high") return <Badge variant="destructive" className="rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/50">{t.severity.high}</Badge>;
    if (sev === "medium") return <Badge variant="secondary" className="rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/50">{t.severity.medium}</Badge>;
    return <Badge variant="outline" className="rounded-full border-white/10">{t.severity.low}</Badge>;
  }

  return (
    <main className="min-h-screen aurora-bg bg-background text-foreground selection:bg-blue-500/30">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/en" className="font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
              {nav.title}
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

          <div className="hidden md:flex items-center gap-3">
            <Button asChild variant="ghost" className="rounded-full hover:bg-white/5">
              <Link href="/en"><ArrowLeft className="w-4 h-4 mr-2" /> {t.header.backToHome}</Link>
            </Button>

            <Button variant="outline" className="rounded-full border-white/10 hover:bg-white/5" disabled title="Disabled on sample page">
              <Download className="w-4 h-4 mr-2" /> {t.header.exportPdf}
            </Button>

            <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-primary text-primary-foreground hover:bg-primary/90">
              <a href={WAITLIST_URL} target="_blank" rel="noreferrer" data-umami-event="cta_join_early_access_sample">
                {t.header.joinEarlyAccess}
              </a>
            </Button>

            <Button variant="ghost" className="rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/10" disabled title="Disabled on sample page">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Button asChild variant="ghost" className="rounded-full h-9 w-9 p-0">
              <Link href="/en"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>

            <Button asChild className="rounded-full text-xs h-8">
              <a href={WAITLIST_URL} target="_blank" rel="noreferrer" data-umami-event="cta_join_early_access_sample">
                {t.header.join}
              </a>
            </Button>

            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-white/5 p-2 text-foreground/90 [&::-webkit-details-marker]:hidden">
                <MoreVertical className="w-4 h-4" />
              </summary>

              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-background/95 dark:bg-zinc-900 p-2 shadow-xl backdrop-blur-xl z-50">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-50 cursor-not-allowed flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> {t.header.exportSample}
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 opacity-50 cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> {t.header.delete}
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-8 space-y-6">
            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{t.workspace.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{t.workspace.desc}</p>
                  </div>

                  <div className="flex items-center gap-2">
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
                      <p className="text-sm font-medium">{t.nextActions.title}</p>
                    </div>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {SAMPLE.nextActions.map((a: string) => (
                        <li key={a} className="flex gap-2 leading-relaxed">
                          <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-medium mb-3">{t.counts.title}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.counts.must}</p>
                        <p className="mt-1 text-xl font-bold">{SAMPLE.mustItems.length}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.counts.risks}</p>
                        <p className="mt-1 text-xl font-bold text-amber-400">{SAMPLE.risks.length}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center hover:bg-white/10 transition-colors">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.counts.qa}</p>
                        <p className="mt-1 text-xl font-bold">{SAMPLE.questions.length}</p>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-muted-foreground leading-relaxed opacity-70">
                      {t.counts.microcopy}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{t.mustItems.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{t.mustItems.subtitle}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" disabled>
                    <Download className="w-4 h-4 mr-2" /> {t.mustItems.export}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {SAMPLE.mustItems.map((m: any) => (
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
                          {t.mustItems.jump}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{t.risks.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{t.risks.subtitle}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" disabled>
                    <Download className="w-4 h-4 mr-2" /> {t.risks.export}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {SAMPLE.risks.map((r: any) => (
                    <div key={r.id} className="group rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-sm font-semibold">{r.title}</p>
                        <SeverityBadge sev={r.severity} />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{r.detail}</p>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity border-white/10 bg-transparent hover:bg-white/10" size="sm" disabled>
                          {t.risks.jump}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-4 space-y-6">
            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> {t.deadline.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-lg font-bold">{SAMPLE.submissionDeadline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.deadline.helper}</p>
                </div>

                <Separator className="my-6 bg-white/10" />

                <Button asChild className="w-full rounded-xl shadow-lg shadow-blue-500/20">
                  <a href={WAITLIST_URL} target="_blank" rel="noreferrer" data-umami-event="cta_join_early_access_sample_sidebar">
                    {t.deadline.cta}
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">{t.keyBullets.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t.keyBullets.subtitle}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {SAMPLE.keyBullets.map((b: string) => (
                    <div key={b} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                      <p className="text-sm text-muted-foreground leading-relaxed">{b}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-12">
          <Tabs defaultValue="requirements">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="h-auto p-1 bg-white/5 border border-white/10 rounded-2xl sm:rounded-full flex flex-wrap sm:flex-nowrap gap-1 sm:gap-0 overflow-visible sm:overflow-x-auto justify-start w-full sm:w-auto">
				  <TabsTrigger value="requirements" className="rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm flex-1 sm:flex-none justify-center data-[state=active]:bg-blue-600 data-[state=active]:text-white">
					{t.tabs.requirements}
				  </TabsTrigger>
				  <TabsTrigger value="risks" className="rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm flex-1 sm:flex-none justify-center data-[state=active]:bg-blue-600 data-[state=active]:text-white">
					{t.tabs.risks}
				  </TabsTrigger>
				  <TabsTrigger value="questions" className="rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm flex-1 sm:flex-none justify-center data-[state=active]:bg-blue-600 data-[state=active]:text-white">
					{t.tabs.questions}
				  </TabsTrigger>
				  <TabsTrigger value="draft" className="rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm flex-1 sm:flex-none justify-center data-[state=active]:bg-blue-600 data-[state=active]:text-white">
					{t.tabs.draft}
				  </TabsTrigger>
				  <TabsTrigger value="source" className="rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm flex-1 sm:flex-none justify-center data-[state=active]:bg-blue-600 data-[state=active]:text-white">
					{t.tabs.source}
				  </TabsTrigger>
				</TabsList>


              <div className="hidden sm:flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-full border-white/10 hover:bg-white/5" disabled>
                  <Copy className="w-4 h-4 mr-2" /> {t.tabs.copyAll}
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <TabsContent value="requirements">
                <Card className="glass-card rounded-2xl border-white/10 bg-zinc-900/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{t.tabContent.detailedRequirements}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {SAMPLE.mustItems.map((m: any) => (
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
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{t.tabContent.riskRegister}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 grid gap-3 md:grid-cols-2">
                    {SAMPLE.risks.map((r: any) => (
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
                    <CardTitle className="text-lg">{t.tabContent.clarificationTitle}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{t.tabContent.clarificationDesc}</p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {SAMPLE.questions.map((q: string) => (
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
                    <CardTitle className="text-lg">{t.tabContent.outlineTitle}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{t.tabContent.outlineDesc}</p>
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
                    <CardTitle className="text-lg">{t.tabContent.sourceTitle}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{t.tabContent.sourceDesc}</p>
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
