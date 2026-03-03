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

function extractPriceIdFromInvoice(inv: any): string | null {
  const lines: any[] = Array.isArray(inv?.lines?.data) ? inv.lines.data : [];
  for (const l of lines) {
    const p1 = asStringId(l?.price);
    if (p1) return p1;

    // defensive: some payload variants wrap price differently
    const p2 = asStringId(l?.pricing?.price);
    if (p2) return p2;

    if (l?.price && typeof l.price === "object" && typeof l.price.id === "string") {
      return l.price.id;
    }
  }
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

  const body = await req.text();

  let event: any;
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
      // If table doesn't exist / schema missing
      if ((ins.error as any).message?.includes("stripe_webhook_events")) {
        return NextResponse.json({ error: "missing_billing_schema" }, { status: 500 });
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
          const update: any = { stripe_customer_id: customerId };
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
        const periodEnd =
          typeof sub.current_period_end === "number"
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
        const userId = sub?.metadata?.supabase_user_id ?? null;

        const isActive = status === "active" || status === "trialing";
        const isCanceledLike =
          status === "canceled" || status === "unpaid" || status === "incomplete_expired";

        const planStatus = status || null;

        if (customerId) {
          const update: any = {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            plan_status: planStatus,
            current_period_end: periodEnd,
          };

          // Only upgrade to pro when truly active/trialing
          if (isActive) update.plan_tier = "pro";

          // Only downgrade on deletion or clearly canceled-like statuses
          if (event.type === "customer.subscription.deleted" || isCanceledLike) {
            update.plan_tier = "free";
          }

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
        const invoiceId = asStringId(invoice.id);
        if (!customerId || !invoiceId) break;

        // These can be null in Snapshot payloads
        let subscriptionId = asStringId(invoice.subscription);

        // 1) Try the event payload first
        let priceId = extractPriceIdFromInvoice(invoice);

        // 2) If missing (your current case), fetch full invoice from Stripe
        let fullInvoice: any = invoice;
        if (!priceId) {
          try {
            fullInvoice = await stripe.invoices.retrieve(invoiceId, {
              expand: ["lines.data.price", "subscription"],
            });
            priceId = extractPriceIdFromInvoice(fullInvoice);
            subscriptionId = subscriptionId ?? asStringId(fullInvoice.subscription);
          } catch (e) {
            console.error("invoice.paid: failed to retrieve invoice", e);
          }
        }

        // 3) If still missing, fallback to subscription (if we have it)
        let periodEnd: string | null = null;
        if ((!priceId || !periodEnd) && subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ["items.data.price"],
            });
            priceId = priceId ?? asStringId(sub?.items?.data?.[0]?.price);
            periodEnd =
              typeof sub.current_period_end === "number"
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null;
          } catch (e) {
            console.error("invoice.paid: failed to retrieve subscription", e);
          }
        }

        if (!priceId) {
          console.error("invoice.paid: missing priceId", { customerId, invoiceId, subscriptionId });
          break;
        }

        const credits = creditsForPrice(priceId);
        if (!credits || credits < 1) {
          console.error("invoice.paid: creditsForPrice returned null/0", {
            priceId,
            envMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
            envYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
            creditsMonthly: process.env.STRIPE_CREDITS_PRO_MONTHLY,
            creditsYearly: process.env.STRIPE_CREDITS_PRO_YEARLY,
          });
          break;
        }

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
        if (!userId) {
          console.error("invoice.paid: no profile found for customer", { customerId });
          break;
        }

        // Grant credits (atomic RPC)
        const rpc = await admin.rpc("grant_credits_v1", {
          p_user_id: userId,
          p_amount: credits,
          p_reason: "stripe_invoice_paid",
        });
        if (rpc.error) {
          console.error("grant_credits_v1 failed", rpc.error);
        }

        // Ensure plan reflects paid status
        const update: any = {
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          plan_tier: "pro",
          plan_status: "active",
        };
        if (subscriptionId) update.stripe_subscription_id = subscriptionId;
        if (periodEnd) update.current_period_end = periodEnd;

        const up = await admin.from("profiles").update(update).eq("id", userId);
        if (up.error) console.error("Profile update failed (invoice.paid plan sync)", up.error);

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Stripe webhook handler error", e);
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}