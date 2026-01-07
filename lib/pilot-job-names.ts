const KEY_PREFIX = "tp_job_display_name:";

export function getJobDisplayName(jobId: string) {
  if (typeof window === "undefined") return "";
  const id = String(jobId ?? "").trim();
  if (!id) return "";
  try {
    return String(window.localStorage.getItem(KEY_PREFIX + id) ?? "").trim();
  } catch {
    return "";
  }
}

export function setJobDisplayName(jobId: string, name: string) {
  if (typeof window === "undefined") return;
  const id = String(jobId ?? "").trim();
  if (!id) return;
  const v = String(name ?? "").trim();
  try {
    if (!v) {
      window.localStorage.removeItem(KEY_PREFIX + id);
      return;
    }
    window.localStorage.setItem(KEY_PREFIX + id, v);
  } catch {
    // ignore
  }
}

export function clearJobDisplayName(jobId: string) {
  if (typeof window === "undefined") return;
  const id = String(jobId ?? "").trim();
  if (!id) return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + id);
  } catch {
    // ignore
  }
}
