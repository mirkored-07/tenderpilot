# Production Ops (TenderPilot)

This repo ships the complete job-processing pipeline, but **production requires** one thing outside the UI:

1) The Supabase Edge Function `process-job` must be deployed and configured.
2) A scheduler must regularly trigger processing for queued jobs.

This doc is intentionally pragmatic and launch-focused.

## 1) Deploy Supabase Edge Functions

Deploy at minimum:
- `supabase/functions/process-job`

Optional (not required if you use `/api/cron/kick`):
- `supabase/functions/kick-jobs`

If you deploy via Supabase CLI:

```bash
supabase functions deploy process-job
supabase functions deploy kick-jobs
```

## 2) Required Edge Function secrets

Set these for `process-job` in Supabase (Edge Function secrets):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

- `TP_CRON_SECRET` (or `TP_SECRET`)  
  Used as a shared secret to prevent public invocation.

Extraction / AI (depending on what you use):
- `OPENAI_API_KEY`
- `TP_UNSTRUCTURED_API_KEY` (if Unstructured extraction is enabled)
- `MISTRAL_API_KEY` (if OCR is enabled)

Demo mode flags (optional):
- `TP_MOCK_EXTRACT=1`
- `TP_MOCK_AI=1`

## 3) Scheduling queued jobs

The repo includes a secure cron endpoint:

`GET /api/cron/kick?tp_secret=YOUR_SECRET`

It:
- selects a small batch of `jobs.status = queued`
- calls Supabase `process-job` for each

### Recommended schedules

- **Every 1 minute** for small volumes
- **Every 2 minutes** if processing cost is higher

### Scheduler options

#### Option A — GitHub Actions (simple + reliable)

Create a workflow that runs every minute and curls the endpoint:

```yaml
name: kick-jobs
on:
  schedule:
    - cron: "*/1 * * * *"
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Call cron endpoint
        run: |
          curl -sS "${{ secrets.APP_URL }}/api/cron/kick?tp_secret=${{ secrets.TP_CRON_SECRET }}" \
            -H "accept: application/json" \
            -o /dev/null
```

You set `APP_URL` and `TP_CRON_SECRET` as GitHub repo secrets.

#### Option B — External uptime/cron service

Any cron service that can hit a URL with a query string works.

#### Option C — Supabase scheduled HTTP request

If you use Supabase scheduling tools that can call HTTP endpoints, call:

`https://YOUR_APP_DOMAIN/api/cron/kick?tp_secret=YOUR_SECRET`

## 4) Environment variables in Vercel

Your Next.js app must have:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TP_CRON_SECRET` (must match the Edge Function secret)

Stripe (if billing is enabled):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_CREDITS_PRO_MONTHLY`
- `STRIPE_CREDITS_PRO_YEARLY`

## 5) Smoke test (production)

1) Upload a small PDF.
2) Confirm a row exists in `jobs` with `status = queued`.
3) Trigger cron manually:

`GET /api/cron/kick?tp_secret=YOUR_SECRET`

4) Confirm the job transitions:
- queued → processing → done
