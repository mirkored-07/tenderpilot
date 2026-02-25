import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setting things up</CardTitle>
          <p className="text-sm text-muted-foreground">
            Loading your tender review view.
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="rounded-2xl border bg-background/60 p-5">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="mt-3 h-3 w-full rounded bg-muted" />
              <div className="mt-2 h-3 w-5/6 rounded bg-muted" />
            </div>

            <Separator />

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-3 h-4 w-32 rounded bg-muted" />
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-3 h-4 w-32 rounded bg-muted" />
              </div>
              <div className="rounded-2xl border bg-background/60 p-4">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-3 h-4 w-32 rounded bg-muted" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              If this takes longer than expected, your session may have expired.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
