"use client";

import * as React from "react";
import { Loader2, CheckCircle2 } from "lucide-react"; // Make sure you have lucide-react, or use plain text
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlistAction } from "@/app/actions/waitlist"; // Import your new action

type Props = {
  className?: string;
  source?: string;
};

export function WaitlistInline({ className, source = "landing" }: Props) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) return setError("Please enter an email.");

    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!ok) return setError("Please enter a valid email.");

    setStatus("loading");

    // Call the Server Action
    const result = await joinWaitlistAction(trimmed, source);

    if (result.success) {
      setStatus("success");
      // Optional: Track in analytics here if you use Umami/PostHog
    } else {
      setStatus("idle");
      setError(result.message);
    }
  }

  if (status === "success") {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border bg-green-50/50 p-4 text-green-700 ${className}`}>
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">You’re on the list! We’ll be in touch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          type="email"
          className="h-11 rounded-full"
          aria-label="Email address"
          autoComplete="email"
          disabled={status === "loading"}
        />
        <Button
          type="submit"
          className="h-11 rounded-full min-w-[140px]"
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Get early access"
          )}
        </Button>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        No spam. One email when access opens.
      </div>
      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
    </form>
  );
}