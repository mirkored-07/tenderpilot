import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
          <div className="text-sm text-muted-foreground">Privacy</div>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          TenderPilot is in early access. This page explains how we handle personal data when you join the waitlist
          and use the app.
        </p>

        <div className="mt-8 grid gap-4">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Waitlist emails</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                If you submit your email via the waitlist form, we use it only to contact you about TenderPilot early
                access and product updates related to early access.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>We do not sell your email.</li>
                <li>You can ask to be removed at any time.</li>
                <li>We keep the data only as long as needed for early access and onboarding.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">How submissions are processed</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                The waitlist can be hosted by a third party form provider (e.g., Tally/Typeform/Google Forms) depending
                on the deployment configuration. In that case, your submission is also processed under that provider’s
                privacy terms.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Product usage data</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                To evaluate engagement during early access, we may collect basic, aggregated usage metrics (for example:
                page views and button clicks). We do not need sensitive personal data for this.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Contact</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                If you want your data removed or have questions, contact the TenderPilot team.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Drafting support only. Always verify requirements and legal language against the original tender document.
        </p>
      </div>
    </main>
  );
}
