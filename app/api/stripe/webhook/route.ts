import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { creditsForPrice, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function asStringId(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.id === "string") return v.id;
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "missing_STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: any;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed", e);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Idempotency: store event id, ignore duplicates
  try {
    const ins = await admin.from("stripe_webhook_events").insert({ id: event.id });
    if (ins.error) {
      // Postgres unique violation code
      if ((ins.error as any).code === "23505") {
        return NextResponse.json({ ok: true, deduped: true });
      }
      // Table/column missing -> clear message
      if (String(ins.error.message ?? "").toLowerCase().includes("relation")) {
        return NextResponse.json(
          { error: "missing_billing_schema", hint: "Run supabase/stripe_billing_v1.sql." },
          { status: 500 }
        );
      }
      throw ins.error;
    }
  } catch (e) {
    console.error("Webhook idempotency insert failed", e);
    return NextResponse.json({ error: "idempotency_failed" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = asStringId(session.customer);
        const subscriptionId = asStringId(session.subscription);
        const userId = session?.metadata?.supabase_user_id ?? null;

        if (customerId && (userId || subscriptionId)) {
          const update: any = {
            stripe_customer_id: customerId,
          };
          if (subscriptionId) update.stripe_subscription_id = subscriptionId;

          const q = userId
            ? admin.from("profiles").update(update).eq("id", userId)
            : admin.from("profiles").update(update).eq("stripe_customer_id", customerId);

          const r = await q;
          if (r.error) console.error("Profile update failed (checkout.session.completed)", r.error);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = asStringId(sub.customer);
        const subscriptionId = asStringId(sub.id);
        const status = String(sub.status ?? "").toLowerCase();
        const priceId = asStringId(sub?.items?.data?.[0]?.price);
        const periodEnd = typeof sub.current_period_end === "number"
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        const userId = sub?.metadata?.supabase_user_id ?? null;

        const isActive = status === "active" || status === "trialing";
        const planTier = isActive ? "pro" : "free";
        const planStatus = status || null;

        if (customerId) {
          const update: any = {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            plan_tier: planTier,
            plan_status: planStatus,
            current_period_end: periodEnd,
          };

          const q = userId
            ? admin.from("profiles").update(update).eq("id", userId)
            : admin.from("profiles").update(update).eq("stripe_customer_id", customerId);

          const r = await q;
          if (r.error) console.error("Profile update failed (subscription.*)", r.error);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const customerId = asStringId(invoice.customer);
        if (!customerId) break;

        // Pick first price id from invoice lines
        const lines: any[] = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
        const lineWithPrice = lines.find((l) => asStringId(l?.price));
        const priceId = lineWithPrice ? asStringId(lineWithPrice.price) : null;

        if (!priceId) break;

        const credits = creditsForPrice(priceId);
        if (!credits || credits < 1) break;

        const { data: prof, error: profErr } = await admin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profErr) {
          console.error("Profile lookup failed (invoice.paid)", profErr);
          break;
        }

        const userId = (prof as any)?.id;
        if (!userId) break;

        const rpc = await admin.rpc("grant_credits_v1", {
          p_user_id: userId,
          p_amount: credits,
          p_reason: "stripe_invoice_paid",
        });

        if (rpc.error) {
          console.error("grant_credits_v1 failed", rpc.error);
        }

        break;
      }

      default:
        // Ignore other events (still deduped)
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Stripe webhook handler error", e);
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}
