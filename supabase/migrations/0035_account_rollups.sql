-- 10x lever #5 "Instant app": precompute the whole-account scope aggregate once per sync, so pages read a
-- single small row instead of scanning ad_metrics + ad_meta on every load. Keyed by (user, account, window).
-- `report` is the full ReconReport (the reconcile scopes); the flat columns are the whole-account headline
-- (spend/revenue/purchases/ads) for cheap reuse by the cockpit headline later.
-- RLS enabled with NO policy = default-deny; only the service-role admin client reads/writes it (same model
-- as ad_metrics / ad_meta / cockpit_cache). APPLIED live 2026-09-02.
create table if not exists public.account_rollups (
  user_id uuid not null,
  account_external_id text not null,
  window_days int not null,
  report jsonb not null,
  spend numeric not null default 0,
  revenue numeric not null default 0,
  purchases numeric not null default 0,
  ads int not null default 0,
  computed_at timestamptz not null default now(),
  primary key (user_id, account_external_id, window_days)
);

alter table public.account_rollups enable row level security;

-- covers the read (user + account), window_days is the low-cardinality PK tail
create index if not exists account_rollups_user_acct_idx on public.account_rollups (user_id, account_external_id);
