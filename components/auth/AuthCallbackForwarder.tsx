"use client";

import { useEffect } from "react";

/**
 * Safety net:
 * If user lands on a marketing route with `?code=...`, forward to `/auth/callback`
 * so the server can exchange the code for a session.
 *
 * IMPORTANT: no useSearchParams() here to avoid Suspense build issues.
 */
export function AuthCallbackForwarder() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);

      // Already on callback route → do nothing
      if (url.pathname.startsWith("/auth/callback")) return;

      const code = url.searchParams.get("code");
      if (!code || code.length < 16) return;

      const qs = url.searchParams.toString();
      const target = qs ? `/auth/callback?${qs}` : "/auth/callback";
      window.location.replace(target);
    } catch {
      // ignore
    }
  }, []);

  return null;
}