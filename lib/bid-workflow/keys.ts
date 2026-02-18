/**
 * Stable identifier for items derived from job_results.
 *
 * IMPORTANT:
 * - We cannot modify job_results schema to store IDs.
 * - This key must be deterministic across reloads/exports.
 */
export function stableRefKey(input: {
  jobId: string;
  type: "requirement" | "risk" | "clarification" | "outline";
  text: string;
  extra?: string;
}): string {
  const norm = String(input.text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  const base = `${input.jobId}|${input.type}|${norm}|${String(input.extra ?? "").trim().toLowerCase()}`;
  const h = fnv1a32(base);
  return `${input.type}_${h}`;
}

// Small, deterministic hash (portable across Node + browser).
function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (with overflow)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
