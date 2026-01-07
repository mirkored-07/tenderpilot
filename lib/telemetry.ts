"use client";

type TelemetryProps = Record<string, unknown>;

const DEFAULT_HOST = "https://app.posthog.com";

function getAnonId(): string {
  if (typeof window === "undefined") return "";
  const key = "tenderpilot_anon_id_v1";
  let v = "";
  try {
    v = window.localStorage.getItem(key) || "";
  } catch {
    v = "";
  }
  if (v) return v;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
  try {
    window.localStorage.setItem(key, id);
  } catch {
    // ignore
  }
  return id;
}

function shouldSend(): boolean {
  // Explicit opt out
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("tenderpilot_telemetry_optout") === "1") return false;
  } catch {
    // ignore
  }
  return true;
}

export function track(event: string, props: TelemetryProps = {}) {
  if (!shouldSend()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // telemetry disabled unless configured

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST;
  const distinct_id = getAnonId();

  const payload = {
    api_key: key,
    event,
    distinct_id,
    properties: {
      ...props,
      $current_url: typeof window !== "undefined" ? window.location.href : undefined,
      $user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      app: "tenderpilot",
    },
  };

  // Fire and forget
  try {
    fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => void 0);
  } catch {
    // ignore
  }
}

let handlersInstalled = false;

export function initTelemetry() {
  if (handlersInstalled) return;
  handlersInstalled = true;

  // Basic error monitoring without adding dependencies.
  // If POSTHOG is not configured, this remains a no op.
  window.addEventListener("error", (e) => {
    const err = (e as any)?.error;
    track("client_error", {
      message: String((e as any)?.message ?? err?.message ?? "Unknown error"),
      filename: String((e as any)?.filename ?? ""),
      lineno: Number((e as any)?.lineno ?? 0),
      colno: Number((e as any)?.colno ?? 0),
      stack: typeof err?.stack === "string" ? err.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = (e as any)?.reason;
    track("client_unhandled_rejection", {
      message: String(reason?.message ?? reason ?? "Unhandled rejection"),
      stack: typeof reason?.stack === "string" ? reason.stack : undefined,
    });
  });
}
