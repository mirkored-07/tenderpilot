export type PlanTier = "free" | "pro" | null | undefined;

export function normalizePlanTier(raw: unknown): PlanTier {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "pro") return "pro";
  return "free";
}

export function hasPaidExportsAccess(rawPlanTier: unknown): boolean {
  return normalizePlanTier(rawPlanTier) === "pro";
}

export function canExportForProfile(profile: { plan_tier?: unknown; credits_balance?: unknown } | null | undefined): boolean {
  if (hasPaidExportsAccess(profile?.plan_tier)) return true;
  const credits = Number(profile?.credits_balance ?? 0);
  return Number.isFinite(credits) && credits > 0;
}
