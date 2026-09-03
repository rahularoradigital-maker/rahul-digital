-- 10x #1 self-proving accuracy: append-only log of each store-vs-Meta verification, so accuracy is a TREND
-- (a clean streak builds trust; a new conflict is visible) instead of a one-off check. Written by
-- /api/account/verify. RLS default-deny (service-role only, same as the rollup tables). APPLIED live 2026-09-02.
create table if not exists public.account_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_external_id text not null,
  window_days int not null,
  spend_store numeric not null default 0,
  spend_meta numeric not null default 0,
  revenue_store numeric not null default 0,
  revenue_meta numeric not null default 0,
  worst_drift_pct numeric not null default 0,
  status text not null,        -- worst of the metrics: match | minor_drift | conflict
  trustworthy boolean not null,
  created_at timestamptz not null default now()
);
alter table public.account_verifications enable row level security;
create index if not exists account_verifications_lookup_idx
  on public.account_verifications (user_id, account_external_id, created_at desc);
