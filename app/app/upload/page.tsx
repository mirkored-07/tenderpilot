import UploadForm from "./upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        {/* Left: Upload */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Upload tender document</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload your RFP to generate a bid review workspace with
              requirements, risks, and clarifications.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <UploadForm />
            <p className="mt-4 text-xs text-muted-foreground">
              Drafting support only. Always verify against the original RFP.
            </p>
          </CardContent>
        </Card>

        {/* Right: What happens next / Trust */}
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What happens next</CardTitle>
              <p className="text-sm text-muted-foreground">
                A clean bid kit is created automatically.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-semibold">1. Upload</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your file is stored securely in your workspace.
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-semibold">2. Processing</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We extract text and generate structured results.
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-semibold">3. Review</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You’ll see Requirements, Risks, Clarifications, and Draft.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Best practices</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <span>Upload the final RFP version you plan to respond to.</span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <span>Start with MUST items to avoid disqualification.</span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <span>Use Clarifications early during the Q&amp;A window.</span>
                </li>
              </ul>

              <Separator className="my-5" />

              <p className="text-xs text-muted-foreground leading-relaxed">
                Your documents are processed to generate drafting support and
                should be verified against the source.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
