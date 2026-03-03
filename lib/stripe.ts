import Stripe from "stripe";
import type { NextRequest } from "next/server";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getStripe() {
  const key = requireEnv("STRIPE_SECRET_KEY");
  return new Stripe(key, {
    // Let Stripe pick the default API version for the installed SDK.
    // (Explicit apiVersion can break if your Stripe account upgrades defaults.)
  });
}

export function appUrl(req?: NextRequest): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = req?.headers.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export function pickProPriceId(interval: "monthly" | "yearly") {
  return interval === "yearly"
    ? requireEnv("STRIPE_PRICE_PRO_YEARLY")
    : requireEnv("STRIPE_PRICE_PRO_MONTHLY");
}

export function creditsForPrice(priceId: string): number | null {
  const monthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const yearly = process.env.STRIPE_PRICE_PRO_YEARLY;

  if (monthly && priceId === monthly) {
    const n = Number(process.env.STRIPE_CREDITS_PRO_MONTHLY ?? "");
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (yearly && priceId === yearly) {
    const n = Number(process.env.STRIPE_CREDITS_PRO_YEARLY ?? "");
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
}
