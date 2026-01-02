import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      {/* Top nav */}
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
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/app/upload">Upload RFP</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 md:px-8 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Decide whether to bid in minutes.
            </h1>

            <p className="mt-4 text-base text-muted-foreground leading-relaxed md:text-lg">
              Upload an RFP and quickly spot disqualifiers, delivery risks, and
              the questions to ask the buyer before you commit time or money.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href="/app/upload">Upload RFP</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              You’ll sign in via magic link. No password.
            </p>
          </div>

          {/* Minimal proof card */}
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Built for go / no go</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                TenderPilot turns an RFP into a clean review workspace so you can
                decide fast and reduce surprises.
              </p>

              <Separator className="my-5" />

              <div className="grid gap-3">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Requirements</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    MUST / SHOULD items grouped for fast scanning.
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Risks</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    High, medium, low risks with clear wording.
                  </div>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Clarifications</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Practical questions to ask the buyer early.
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

      {/* Bottom CTA (short) */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <Card className="rounded-2xl">
          <CardContent className="p-6 md:p-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold">Stop wasting time on bad bids.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload an RFP and get a bid review in minutes.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full">
                <Link href="/app/upload">Upload RFP</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Drafting support only. Always verify against the original RFP.
        </p>
      </section>
    </main>
  );
}
