export type AccessMode = "public" | "waitlist" | "private";

/**
 * Controls the marketing-to-app funnel.
 * - public: users can sign up and start using the app immediately
 * - waitlist: marketing CTA leads to waitlist section / form
 * - private: (reserved) could be used for invite-only gating
 */
export function getAccessMode(): AccessMode {
  const raw = (process.env.NEXT_PUBLIC_ACCESS_MODE || "").trim().toLowerCase();
  if (raw === "public") return "public";
  if (raw === "private") return "private";
  return "waitlist";
}

/**
 * Single source of truth for marketing CTAs that should route users through login
 * and preserve the intended destination in the app.
 */
export function loginWithNextHref(nextPath: string = "/app/upload"): string {
  const next = nextPath && nextPath.trim().length > 0 ? nextPath.trim() : "/app/upload";
  return `/login?next=${encodeURIComponent(next)}`;
}
