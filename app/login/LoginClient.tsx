"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useAppI18n } from "@/app/app/_components/app-i18n-provider";

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const supabase = supabaseBrowser();
  const { t } = useAppI18n();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setError(null);
    setSent(false);

    try {
      const v = encodeURIComponent(nextPath || "/app/jobs");
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `tp_next=${v}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
    } catch {
      // ignore
    }

    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
    const emailRedirectTo = `${base}/auth/callback`;

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
          <CardTitle className="text-2xl">{t("app.auth.login.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("app.auth.login.subtitle")}</p>
        </CardHeader>

        <CardContent className="space-y-3">
          <Input
            placeholder={t("app.auth.login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button className="w-full rounded-full" onClick={sendLink} disabled={!email}>
            {t("app.auth.login.cta")}
          </Button>

          {sent ? <p className="text-sm text-muted-foreground">{t("app.auth.login.sent")}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
