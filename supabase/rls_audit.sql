/*
RLS and Storage Isolation Audit

Purpose

This script helps verify that Row Level Security is enabled and that policies exist for
core TenderPilot tables and the uploads storage bucket.

How to use

1. Run in Supabase SQL Editor
2. Review output
3. Validate using the two user checklist in supabase/rls_audit.md

Important

The SQL editor typically runs with elevated privileges.
Use this script as a configuration and policy inventory.
The definitive proof is app level testing with the anon key and real users.
*/


/*
Section A
Core table inventory and RLS status

If some of these tables do not exist in your project, they will simply not appear.
*/

select
  n.nspname as schema,
  c.relname as table,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname in (
    'jobs',
    'job_results',
    'job_events',
    'job_work_items',
    'work_items',
    'bid_room_items',
    'job_metadata'
  )
order by 1, 2;


/*
Section B
Policy inventory for public schema
*/

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


/*
Section C
Storage bucket sanity checks
*/

select id, name, public
from storage.buckets
order by name;

select
  bucket_id,
  count(*) as object_count,
  count(distinct owner) as distinct_owners
from storage.objects
group by bucket_id
order by bucket_id;


/*
Section D
Storage policies for uploads isolation
*/

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;


/*
Section E
Quick spot check of uploads objects

Review

owner should be populated for authenticated uploads
name can be random uuid, that is fine if policies enforce owner based access
*/

select
  id,
  bucket_id,
  name,
  owner,
  created_at
from storage.objects
where bucket_id = 'uploads'
order by created_at desc
limit 25;


/*
Section F
Optional simulated checks

These may or may not reflect real RLS behavior depending on how your SQL session is configured.
If you want to simulate authenticated RLS, you can try setting JWT claims.

Replace USER_A_UUID and USER_B_UUID with real auth.users ids.
*/

-- select set_config('request.jwt.claim.role', 'authenticated', true);
-- select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
-- select count(*) as visible_jobs_user_a from public.jobs;
-- select set_config('request.jwt.claim.sub', 'USER_B_UUID', true);
-- select count(*) as visible_jobs_user_b from public.jobs;
