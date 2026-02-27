"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const bypass =
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

    if (bypass) {
      setReady(true);
      return;
    }

    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data?.user) {
        // Preserve the user's intended destination.
        // Avoid useSearchParams here (keeps this component simple + resilient).
        const next =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/app/jobs";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setReady(true);
    });
  }, [router, supabase]);

  if (!ready) {
    return <div className="py-16 text-sm text-muted-foreground">Loading…</div>;
  }

  return <>{children}</>;
}