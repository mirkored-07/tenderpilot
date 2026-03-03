import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseRoute } from "@/lib/supabase/route";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseRoute(req);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select(
        "id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_tier,plan_status,current_period_end"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      const msg = String(profErr.message ?? "").toLowerCase();
      if (msg.includes("column") || msg.includes("stripe_customer_id")) {
        return NextResponse.json(
          { error: "missing_billing_schema", hint: "Run supabase/stripe_billing_v1.sql in Supabase." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "profile_read_failed" }, { status: 500 });
    }

    const customerId = String((prof as any)?.stripe_customer_id ?? "").trim();
    if (!customerId) {
      return NextResponse.json({ ok: true, synced: false, reason: "no_customer" });
    }

    const stripe = getStripe();

    // If customer was deleted in Stripe, clear stale fields.
    try {
      await stripe.customers.retrieve(customerId);
    } catch (err: any) {
      if (err?.code === "resource_missing") {
        await admin
          .from("profiles")
          .update({
            stripe_customer_id: null,
            stripe_subscription_id: null,
            stripe_price_id: null,
            plan_tier: "free",
            plan_status: null,
            current_period_end: null,
          })
          .eq("id", user.id);

        return NextResponse.json({ ok: true, synced: true, plan_tier: "free", plan_status: null });
      }
      throw err;
    }

    let subscriptionId = String((prof as any)?.stripe_subscription_id ?? "").trim() || null;
    let sub: any = null;

    if (subscriptionId) {
      try {
        sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
      } catch {
        subscriptionId = null;
        sub = null;
      }
    }

    if (!sub) {
      // Find latest subscription for this customer
      const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
      if (list.data?.length) {
        sub = await stripe.subscriptions.retrieve(list.data[0].id, { expand: ["items.data.price"] });
        subscriptionId = sub?.id ?? null;
      }
    }

    if (!sub) {
      // No subscription found: treat as free
      await admin
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          stripe_price_id: null,
          plan_tier: "free",
          plan_status: null,
          current_period_end: null,
        })
        .eq("id", user.id);

      return NextResponse.json({ ok: true, synced: true, plan_tier: "free", plan_status: null });
    }

    const status = String(sub?.status ?? "").toLowerCase() || null;
    const isActive = status === "active" || status === "trialing";
    const isCanceledLike = status === "canceled" || status === "unpaid" || status === "incomplete_expired";

    const priceId =
      (sub?.items?.data?.[0]?.price && typeof sub.items.data[0].price?.id === "string" ? sub.items.data[0].price.id : null) ||
      null;

    const periodEnd =
      typeof sub?.current_period_end === "number"
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

    const update: any = {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      plan_status: status,
      current_period_end: periodEnd,
    };

    if (isActive) update.plan_tier = "pro";
    if (isCanceledLike) update.plan_tier = "free";

    await admin.from("profiles").update(update).eq("id", user.id);

    return NextResponse.json({ ok: true, synced: true, plan_tier: update.plan_tier ?? null, plan_status: status, price_id: priceId, current_period_end: periodEnd });
  } catch (e: any) {
    console.error("stripe sync error", e);
    return NextResponse.json({ error: "stripe_sync_failed" }, { status: 500 });
  }
}
