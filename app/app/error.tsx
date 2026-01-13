"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error(
  props: {
    error: Error & { digest?: string };
    reset: () => void;
  }
) {
  const { error, reset } = props;

  useEffect(() => {
    // Lightweight console signal for customer testing.
    // eslint-disable-next-line no-console
    console.error("TenderPilot route error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Something went wrong</CardTitle>
          <p className="text-sm text-muted-foreground">
            The page could not be rendered. Your data is safe. Try again or return to your jobs.
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-2xl border bg-background/60 p-4">
            <p className="text-sm font-medium">What you can do</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>Retry loading the page.</li>
              <li>Open History and select the job again.</li>
              <li>If this happens after sign in, refresh the browser to restore the session.</li>
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={() => reset()}>
              Retry
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/jobs">Open History</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/upload">Create a new bid review</Link>
            </Button>
          </div>

          {error?.message ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Error details: <span className="font-mono">{error.message}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
