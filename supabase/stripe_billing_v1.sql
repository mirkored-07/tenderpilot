/*
Stripe Billing + Credits Schema (v1)

Purpose
- Persist Stripe identifiers on the profile
- Provide webhook idempotency storage
- Provide an atomic credit grant RPC for Stripe webhooks

Safe to re-run.
*/

-- ------------------------------------------------------------
-- A) Profiles table baseline (only created if missing)
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles
  enable row level security;

-- Basic self-access policies (create only if missing)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own_v1'
  ) then
    create policy profiles_select_own_v1
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_self_v1'
  ) then
    create policy profiles_insert_self_v1
      on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own_v1'
  ) then
    create policy profiles_update_own_v1
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- ------------------------------------------------------------
-- B) Billing + Credits fields on profiles
-- ------------------------------------------------------------

alter table if exists public.profiles
  add column if not exists credits_balance integer not null default 1;

alter table if exists public.profiles
  alter column credits_balance set default 1;

alter table if exists public.profiles
  add column if not exists stripe_customer_id text;

alter table if exists public.profiles
  add column if not exists stripe_subscription_id text;

alter table if exists public.profiles
  add column if not exists stripe_price_id text;

alter table if exists public.profiles
  add column if not exists plan_tier text not null default 'free';

alter table if exists public.profiles
  add column if not exists plan_status text;

alter table if exists public.profiles
  add column if not exists current_period_end timestamptz;

-- ------------------------------------------------------------
-- C) Webhook idempotency
-- ------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table if exists public.stripe_webhook_events
  enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stripe_webhook_events' and policyname='stripe_webhook_events_deny_all_v1'
  ) then
    create policy stripe_webhook_events_deny_all_v1
      on public.stripe_webhook_events
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end $$;

-- ------------------------------------------------------------
-- D) Credit ledger (optional but recommended)
-- ------------------------------------------------------------

create table if not exists public.credits_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text,
  stripe_event_id text,
  stripe_invoice_id text,
  created_at timestamptz not null default now()
);

create index if not exists credits_ledger_user_id_idx on public.credits_ledger(user_id);
create index if not exists credits_ledger_created_at_idx on public.credits_ledger(created_at);

alter table if exists public.credits_ledger
  enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='credits_ledger' and policyname='credits_ledger_select_own_v1'
  ) then
    create policy credits_ledger_select_own_v1
      on public.credits_ledger
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- ------------------------------------------------------------
-- E) Atomic credit grant RPC for Stripe webhooks
-- ------------------------------------------------------------

create or replace function public.grant_credits_v1(
  p_user_id uuid,
  p_amount integer,
  p_reason text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_amount integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  v_amount := coalesce(p_amount, 0);
  if v_amount = 0 then
    select credits_balance into v_balance
    from public.profiles
    where id = p_user_id;
    return coalesce(v_balance, 0);
  end if;

  select credits_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'MISSING_PROFILE';
  end if;

  update public.profiles
    set credits_balance = credits_balance + v_amount
  where id = p_user_id
  returning credits_balance into v_balance;

  insert into public.credits_ledger(user_id, amount, reason)
  values (p_user_id, v_amount, p_reason);

  return v_balance;
end;
$$;

revoke all on function public.grant_credits_v1(uuid,integer,text) from public;
grant execute on function public.grant_credits_v1(uuid,integer,text) to service_role;