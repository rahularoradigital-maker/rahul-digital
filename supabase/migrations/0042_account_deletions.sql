-- S5 (deletion half): soft-delete tracking for self-serve account deletion (Rahul's decision 2026-09-01:
-- 14-day grace before purge; revoke Meta now; re-login/Cancel aborts). A request inserts one row; the purge
-- cron finds rows past purge_after and runs the executor (lib/account/deletion.ts). RLS default-deny
-- (service-role only). The row cascades away with the auth user when the executor finally deletes it.
create table if not exists public.account_deletions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  status       text not null default 'pending',   -- pending | cancelled | purged
  requested_at timestamptz not null default now(),
  purge_after  timestamptz not null,              -- now() + grace; the cron purges only past this
  purged_at    timestamptz,
  reason       text,
  constraint account_deletions_status_chk check (status in ('pending','cancelled','purged'))
);
alter table public.account_deletions enable row level security;
-- The purge cron scans pending rows whose grace has elapsed.
create index if not exists account_deletions_due_idx on public.account_deletions (status, purge_after);
