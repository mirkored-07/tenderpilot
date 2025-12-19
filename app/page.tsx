import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">TenderPilot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an RFP and get a complete Bid Kit plus a first proposal draft.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <a href="/login">Sign in</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/app">Open app</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
