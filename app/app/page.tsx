import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AppHome() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Turn complex RFPs into a structured Bid Kit and a first proposal draft.
          </p>
        </div>

        <Button asChild className="rounded-full">
          <Link href="/app/new">New Bid Kit</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Bid Kit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Requirements checklist, key dates, evaluation map, risks.
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Draft Proposal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Outline plus section drafts you can edit and export.
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Speed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Typical output in minutes, with evidence quotes and page references.
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-dashed">
  <CardHeader className="flex flex-row items-center justify-between">
    <div>
      <CardTitle className="text-base">Create a new Bid Kit</CardTitle>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload an RFP and get a structured Bid Kit plus a first proposal draft.
      </p>
    </div>
    <Badge variant="secondary" className="rounded-full">
      PDF or DOCX
    </Badge>
  </CardHeader>

  <CardContent className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
    <div className="flex flex-col gap-3 text-sm text-muted-foreground">
      <ul className="space-y-1">
        <li>• Mandatory requirements checklist</li>
        <li>• Key dates and deliverables</li>
        <li>• Evaluation criteria mapping</li>
        <li>• Draft proposal sections</li>
      </ul>

      <p className="text-xs">
        Files are processed securely and removed automatically.
      </p>
    </div>

    <Button asChild size="lg" className="rounded-full">
      <Link href="/app/new">Upload RFP</Link>
    </Button>
  </CardContent>
</Card>
 </div>
  );
}
