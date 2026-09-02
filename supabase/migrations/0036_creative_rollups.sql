-- 10x #5 instant-app: per-account rollup of the TOP creatives (by spend) computed on demand/sync, so the
-- Creative page + Studio recommendations can read top movers without scanning ad_metrics per visit. One row
-- per (user, account, window); `top` is a JSONB array of the top-N ads {adId,name,spend,revenue,roas,
-- purchases,active}. RLS default-deny (service-role only, same as account_rollups). APPLIED live 2026-09-02.
create table if not exists public.creative_rollups (
  user_id uuid not null,
  account_external_id text not null,
  window_days int not null,
  top jsonb not null,
  count int not null default 0,
  computed_at timestamptz not null default now(),
  primary key (user_id, account_external_id, window_days)
);
alter table public.creative_rollups enable row level security;
create index if not exists creative_rollups_user_acct_idx on public.creative_rollups (user_id, account_external_id);
