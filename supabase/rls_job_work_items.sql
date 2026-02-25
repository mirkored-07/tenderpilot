/*
RLS policies for public.job_work_items

Purpose
Enable Bid Room + Compliance Matrix to save execution overlays while keeping isolation by job owner.

Assumptions
- public.jobs has column user_id (uuid) referencing auth.users
- public.job_work_items has column job_id (uuid) referencing public.jobs.id
- RLS may already be enabled; running enable again is safe

Run this in Supabase SQL Editor.
*/

alter table public.job_work_items enable row level security;

-- Read: only items for jobs owned by the current user
create policy "job_work_items_select_own_jobs"
on public.job_work_items
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_work_items.job_id
      and j.user_id = auth.uid()
  )
);

-- Insert: only allow inserting items for jobs owned by the current user
create policy "job_work_items_insert_own_jobs"
on public.job_work_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_work_items.job_id
      and j.user_id = auth.uid()
  )
);

-- Update: only allow updating items for jobs owned by the current user
create policy "job_work_items_update_own_jobs"
on public.job_work_items
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_work_items.job_id
      and j.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_work_items.job_id
      and j.user_id = auth.uid()
  )
);

-- Delete: only allow deleting items for jobs owned by the current user
create policy "job_work_items_delete_own_jobs"
on public.job_work_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_work_items.job_id
      and j.user_id = auth.uid()
  )
);
