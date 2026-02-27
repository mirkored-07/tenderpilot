export type AccessMode = "invite" | "public";

/**
 * Controls marketing to app routing.
 *
 * Default is invite-only to preserve current behavior.
 * Set NEXT_PUBLIC_ACCESS_MODE=public to route CTAs to /login?next=/app/upload.
 */
export function getAccessMode(): AccessMode {
  const raw = String(process.env.NEXT_PUBLIC_ACCESS_MODE ?? "").toLowerCase().trim();
  if (raw === "public" || raw === "open" || raw === "beta") return "public";

  const inv = String(process.env.NEXT_PUBLIC_INVITE_ONLY ?? "").toLowerCase().trim();
  if (inv === "true" || inv === "1" || inv === "yes") return "invite";

  return "invite";
}

export function loginWithNextHref(nextPath: string) {
  const safe = String(nextPath ?? "").trim() || "/app/upload";
  return `/login?next=${encodeURIComponent(safe)}`;
}
