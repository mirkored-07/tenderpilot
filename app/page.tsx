import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
              <Link href="/how-it-works">How it works</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/app/upload">Upload file</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-14 md:px-8 md:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Make a go / no go call in minutes.
            </h1>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
              Upload a tender file (PDF or DOCX) to get requirements, risks, clarifications, and
              a short draft outline. Structured and easy to scan.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href="/app/upload">Upload file</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              You’ll sign in via magic link. No password.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                PDF or DOCX
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                One review per upload
              </span>
              <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                Private workspace
              </span>
            </div>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Requirements
                </span>
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Risks
                </span>
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Clarifications
                </span>
                <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
                  Draft
                </span>
              </div>

              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                A clean review workspace that highlights disqualifiers, delivery
                threats, and what to ask the buyer before you commit time.
              </p>

              <Separator className="my-5" />

              <div className="grid gap-3">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Requirements</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    MUST / SHOULD / Info grouped for fast scanning.
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Risks</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    High / Medium / Low risks with clear wording.
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Clarifications</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Practical questions to ask the buyer early.
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Short draft outline</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    A structured starting point you can refine.
                  </div>
                </div>
              </div>

              <div className="mt-5 text-sm">
                <Link
                  href="/how-it-works"
                  className="text-foreground underline underline-offset-4"
                >
                  See the full output →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <p className="text-center text-xs text-muted-foreground">
          Drafting support only. Always verify against the original tender document.
        </p>
      </footer>
    </main>
  );
}
