import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseRoute } from "@/lib/supabase/route";
import { appUrl, getStripe } from "@/lib/stripe";

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
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    const customerId = prof?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "no_stripe_customer", hint: "Upgrade first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const base = appUrl(req);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/app/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("Stripe portal error", e);
    return NextResponse.json(
      { error: "stripe_portal_failed" },
      { status: 500 }
    );
  }
}
