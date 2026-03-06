export type CanonicalWorkStatus = "todo" | "doing" | "blocked" | "done";

function norm(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function canonicalizeWorkStatus(raw: unknown, fallback: CanonicalWorkStatus = "todo"): CanonicalWorkStatus {
  const v = norm(raw);
  if (!v) return fallback;
  if (v === "blocked") return "blocked";
  if (v === "done" || v === "completed" || v === "complete" || v === "closed" || v === "resolved") return "done";
  if (v === "doing" || v === "in_progress" || v === "active" || v === "inprogress") return "doing";
  if (v === "todo" || v === "to_do" || v === "open" || v === "pending") return "todo";
  return fallback;
}

export function isDoneWorkStatus(raw: unknown): boolean {
  return canonicalizeWorkStatus(raw) === "done";
}

export function isBlockedWorkStatus(raw: unknown): boolean {
  return canonicalizeWorkStatus(raw) === "blocked";
}

export function isActionableWorkStatus(raw: unknown): boolean {
  const v = canonicalizeWorkStatus(raw);
  return v === "todo" || v === "doing";
}

export function workStatusWriteCandidates(next: CanonicalWorkStatus, existingRaw?: unknown): string[] {
  const raw = norm(existingRaw);
  const preferred =
    next === "doing" && (raw === "in_progress" || raw === "inprogress")
      ? "in_progress"
      : next === "doing" && raw === "doing"
        ? "doing"
        : next === "done" && (raw === "completed" || raw === "complete")
          ? "completed"
          : next === "done" && raw === "closed"
            ? "closed"
            : next;

  const family =
    next === "doing"
      ? [preferred, "doing", "in_progress"]
      : next === "done"
        ? [preferred, "done", "completed", "closed"]
        : [preferred, next];

  return Array.from(new Set(family.filter(Boolean)));
}

export function isWorkStatusRetryableError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  const code = String((err as any)?.code ?? "").toLowerCase();
  return (
    code === "22p02" ||
    code === "23514" ||
    msg.includes("invalid input value") ||
    msg.includes("check constraint") ||
    msg.includes("violates check constraint") ||
    (msg.includes("status") && msg.includes("invalid"))
  );
}
