"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setError(null);
    setSent(false);

    // Store next as short-lived cookie (fallback if Supabase drops query params).
    try {
      const v = encodeURIComponent(nextPath || "/app/jobs");
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `tp_next=${v}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
    } catch {
      // ignore
    }

    // Build redirect only on the client (avoid `location` during SSR).
    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
    const qp = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    const emailRedirectTo = `${base}/auth/callback${qp}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen premium-bg bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">We’ll email you a secure login link.</p>
        </CardHeader>

        <CardContent className="space-y-3">
          <Input
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button className="w-full rounded-full" onClick={sendLink} disabled={!email}>
            Send login link
          </Button>

          {sent && (
            <p className="text-sm text-muted-foreground">Check your inbox and open the link.</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}