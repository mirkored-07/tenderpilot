"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  className?: string;
  source?: string;
};

const DEFAULT_WAITLIST_URL = "https://tally.so/r/gD9bkM";

function normalizeWaitlistUrl(raw: string) {
  const v = (raw || "").trim();
  if (!v) return DEFAULT_WAITLIST_URL;
  
  const doubled = "https://tally.so/r/https://tally.so/r/";
  if (v.startsWith(doubled)) {
    return "https://tally.so/r/" + v.slice(doubled.length);
  }

  if (!v.startsWith("http")) {
    return `https://tally.so/r/${v.replace(/^\/+/, "")}`;
  }

  return v;
}

function safeBuildUrl(base: string, email: string, source: string) {
  const url = new URL(base);
  url.searchParams.set("email", email);
  url.searchParams.set("source", source);
  return url.toString();
}

export function WaitlistInline({ className, source = "landing" }: Props) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const base = normalizeWaitlistUrl(process.env.NEXT_PUBLIC_WAITLIST_URL || "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) return setError("Please enter an email.");

    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!ok) return setError("Please enter a valid email.");

    window.location.href = safeBuildUrl(base, trimmed, source);
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="work@consultancy.com"
          type="email"
          className="h-11 rounded-full border-muted-foreground/20 bg-background/50 backdrop-blur"
          aria-label="Email address"
          autoComplete="email"
        />
        <Button
          type="submit"
          className="h-11 rounded-full px-6 font-medium shadow-lg hover:shadow-xl transition-all"
          data-umami-event="early_access_submit"
          data-umami-event-source={source}
        >
          Get Audit Engine Access
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500/80 animate-pulse" />
        <span>Accepting early users</span>
      </div>
      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
    </form>
  );
}