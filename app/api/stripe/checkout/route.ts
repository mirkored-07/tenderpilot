import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseRoute } from "@/lib/supabase/route";
import { appUrl, getStripe, pickProPriceId } from "@/lib/stripe";

export const runtime = "nodejs";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type Body = {
  interval?: "monthly" | "yearly";
  returnTo?: string;
};

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

    const body = (await req.json().catch(() => ({}))) as Body;
    const interval = body.interval ?? "monthly";
    const priceId = pickProPriceId(interval);

    const admin = supabaseAdmin();

    // Ensure profile exists and load customer id
    const { data: existing, error: profErr } = await admin
      .from("profiles")
      .select("id,email,stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr && String(profErr.message ?? "").toLowerCase().includes("column")) {
      return NextResponse.json(
        {
          error: "missing_billing_schema",
          hint: "Run supabase/stripe_billing_v1.sql in Supabase first.",
        },
        { status: 500 }
      );
    }

    if (!existing) {
      const ins = await admin.from("profiles").insert({
        id: user.id,
        email: user.email ?? null,
      });
      if (ins.error) throw ins.error;
    }

    const stripe = getStripe();

    let customerId = existing?.stripe_customer_id ?? null;

    // ✅ NEW: validate stored customer id (handles when you deleted customers in Stripe)
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err: any) {
        if (err?.code === "resource_missing") {
          // Customer was deleted in Stripe → clear stale fields so we can recreate cleanly
          const clear = await admin
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

          if (clear.error) throw clear.error;
          customerId = null;
        } else {
          throw err;
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const up = await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (up.error) throw up.error;
    }

    const base = appUrl(req);
    const success = `${base}/app/account?billing=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancel = `${base}/app/account?billing=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: success,
      cancel_url: cancel,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("Stripe checkout error", e);
    return NextResponse.json({ error: "stripe_checkout_failed" }, { status: 500 });
  }
}