-- Durable job queue (cleanup #4, ADR-0003/0004). Long-running work (sync, generation, competitor pulls)
-- moves off 60-300s inline route handlers into rows here, drained by a cron worker. Deny-by-default RLS:
-- only the service role (the worker) touches jobs, matching the other server-only tables. The claim + fail
-- transitions are SQL functions so they are ATOMIC (FOR UPDATE SKIP LOCKED = no two workers claim the same
-- job, and a stuck 'claimed' job past its visibility window is safely re-claimed).

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending',   -- pending | claimed | done | dead
  attempts     int  not null default 0,
  max_attempts int  not null default 5,
  user_id      uuid,                               -- tenant, for fairness/observability (null = system job)
  claimed_at   timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Fast claim scan over the pending head, and a way to find stuck-claimed jobs.
create index if not exists jobs_pending_idx on public.jobs (created_at) where status = 'pending';
create index if not exists jobs_claimed_idx on public.jobs (claimed_at) where status = 'claimed';

alter table public.jobs enable row level security;
-- No policy = deny-by-default; only the service-role worker reaches these rows (like ad_metrics/notifications).

-- Atomically claim up to p_max jobs: pending, OR claimed-but-past-visibility (p_visibility_seconds). Increments
-- attempts on claim. FOR UPDATE SKIP LOCKED means concurrent workers never grab the same row.
create or replace function public.claim_jobs(p_max int, p_visibility_seconds int default 300)
returns setof public.jobs
language sql
security definer
set search_path = public
as $$
  update public.jobs j
     set status = 'claimed', claimed_at = now(), attempts = attempts + 1, updated_at = now()
   where j.id in (
     select id from public.jobs
      where status = 'pending'
         or (status = 'claimed' and claimed_at < now() - make_interval(secs => p_visibility_seconds))
      order by created_at
      limit greatest(p_max, 0)
      for update skip locked
   )
  returning j.*;
$$;

-- Fail a claimed job: retry (back to pending) while attempts remain, else dead-letter.
create or replace function public.fail_job(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.jobs
     set status = case when attempts >= max_attempts then 'dead' else 'pending' end,
         claimed_at = null,
         last_error = p_error,
         updated_at = now()
   where id = p_id;
$$;

revoke all on function public.claim_jobs(int, int) from public, anon, authenticated;
revoke all on function public.fail_job(uuid, text) from public, anon, authenticated;
