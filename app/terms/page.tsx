import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <main className="min-h-screen premium-bg bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
          <div className="text-sm text-muted-foreground">Terms</div>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          TenderPilot is in early access. These terms are a short summary of expected use during evaluation.
        </p>

        <div className="mt-8 grid gap-4">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Decision support only</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Outputs are generated to help review tenders faster. You are responsible for verifying requirements,
                legal language, and proposal content against the original tender document.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">No warranties</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                The service is provided “as is” during early access. Functionality and availability may change.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Confidentiality</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Do not upload documents you are not permitted to share. If you are evaluating with sensitive tenders,
                ensure you have the right to process them with third party tools.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-sm font-semibold">Feedback</div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Early access users may be contacted for feedback. Your feedback helps improve the product, but you are not
                required to provide it.
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
