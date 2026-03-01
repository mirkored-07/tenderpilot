import { Resend } from "npm:resend@2.0.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenderpilot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const v = (Deno.env.get(name) ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getExpectedSecret(): string {
  return (
    (Deno.env.get("TP_CRON_SECRET") ?? "").trim() ||
    (Deno.env.get("TP_SECRET") ?? "").trim()
  );
}

function parseRecipients(): string[] {
  const raw = (Deno.env.get("NOTIFY_OWNER_TO") ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    }

    const expectedSecret = getExpectedSecret();
    if (!expectedSecret) {
      // Never run unsecured
      return jsonResponse({ ok: false, error: "server_misconfigured" }, 500);
    }

    const provided = (req.headers.get("x-tenderpilot-secret") ?? "").trim();
    if (!provided || provided !== expectedSecret) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    const resendKey = requiredEnv("RESEND_API_KEY");
    const to = parseRecipients();
    if (to.length === 0) {
      return jsonResponse({ ok: false, error: "missing_recipients" }, 500);
    }

    const from =
      (Deno.env.get("NOTIFY_OWNER_FROM") ?? "").trim() ||
      "TenderPilot System <onboarding@resend.dev>";

    const subjectPrefix =
      (Deno.env.get("NOTIFY_OWNER_SUBJECT_PREFIX") ?? "").trim() || "🚀 New Lead";

    const payload = await req.json().catch(() => null);
    const record = (payload as any)?.record ?? (payload as any) ?? {};

    const email = String(record?.email ?? "").trim();
    const source = String(record?.source ?? "Direct").trim();

    if (!email) {
      return jsonResponse({ ok: false, error: "missing_email" }, 400);
    }

    const resend = new Resend(resendKey);

    const html = `
      <p><strong>New Lead Signup</strong></p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Source:</strong> ${source || "Direct"}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
    `;

    const { error } = await resend.emails.send({
      from,
      to,
      subject: `${subjectPrefix}: ${email}`,
      html,
    });

    if (error) {
      console.error("notify-owner: resend error", error);
      return jsonResponse({ ok: false, error: "send_failed" }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("notify-owner: unhandled error", e);
    return jsonResponse(
      { ok: false, error: (e as any)?.message ?? "unknown_error" },
      500
    );
  }
});
