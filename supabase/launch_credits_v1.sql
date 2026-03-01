-- 1) Ensure profiles has credits_balance with default 1
alter table if exists public.profiles
  add column if not exists credits_balance integer not null default 1;

alter table if exists public.profiles
  alter column credits_balance set default 1;

-- 2) Atomic: decrement 1 credit and create a queued job
create or replace function public.create_job_with_credit_v1(
  p_user_id uuid,
  p_file_name text,
  p_file_path text,
  p_source_type text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_job_id uuid;
begin
  -- Only allow calls using service_role JWT (server-side only)
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  -- Lock profile row
  select credits_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'MISSING_PROFILE';
  end if;

  if v_balance < 1 then
    raise exception 'NO_CREDITS';
  end if;

  update public.profiles
    set credits_balance = credits_balance - 1
  where id = p_user_id;

  insert into public.jobs (user_id, file_name, file_path, source_type, status, credits_used)
  values (p_user_id, p_file_name, p_file_path, p_source_type, 'queued', 1)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.create_job_with_credit_v1(uuid,text,text,text) from public;
grant execute on function public.create_job_with_credit_v1(uuid,text,text,text) to service_role;