# Billing setup (Stripe + Credits)

TenderPilot uses:
- **Subscription** (Stripe Checkout)
- **Monthly credit grants** via Stripe webhooks (`invoice.paid`)

This repo contains all code needed, but your Supabase DB must include the billing schema.

## 1) Apply Supabase SQL

Run these in the Supabase SQL editor:

1) `supabase/launch_credits_v1.sql`  
   Creates `create_job_with_credit_v1` and adds `credits_balance`.

2) `supabase/stripe_billing_v1.sql`  
   Adds billing fields, `stripe_webhook_events`, and `grant_credits_v1`.

## 2) Configure Stripe env vars (Vercel)

Required:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`

- `STRIPE_CREDITS_PRO_MONTHLY`
- `STRIPE_CREDITS_PRO_YEARLY`

## 3) Configure Stripe webhook

Add a webhook endpoint pointing to:

`https://YOUR_DOMAIN/api/stripe/webhook`

Subscribe to at minimum:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

## 4) End-to-end test

1) In Stripe test mode, purchase the Pro subscription.
2) Verify `profiles.plan_tier = pro`.
3) Verify `profiles.credits_balance` increases after `invoice.paid`.
4) Verify repeated webhook deliveries do not double-credit (idempotency table).
