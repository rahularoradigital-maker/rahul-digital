-- 0008 Day-wise ingestion store (roadmap #1): complete-coverage, day-wise metrics + per-ad metadata for
-- every spending ad in an account, so the cockpit reads/ranks from the DB instead of a slow live Meta pull.
-- These tables were first created directly during development; this migration captures them in the repo as
-- the source of truth (idempotent, safe to re-apply) and adds the metadata-sync observability columns.
--
-- Access is service-role only (the ingestion job + server-only store reads use the admin client). RLS is
-- ENABLED with NO policies: deny-by-default for anon/authenticated, bypassed only by the service role.

-- Day-wise metrics: one row per (ad, day). Idempotent upsert on the full grain so a re-run overwrites late
-- attribution rather than duplicating.
create table if not exists public.ad_metrics (
  user_id             uuid    not null,
  account_external_id text    not null,
  ad_id               text    not null,
  date                date    not null,
  campaign_id         text,
  adset_id            text,
  objective           text,
  spend               numeric not null default 0,
  impressions         bigint  not null default 0,
  clicks              bigint  not null default 0,
  frequency           numeric not null default 0,
  purchases           numeric not null default 0,
  revenue             numeric not null default 0,
  video_3s            bigint  not null default 0,
  video_thruplays     bigint  not null default 0,
  outbound_clicks     bigint  not null default 0,
  landing_page_views  bigint  not null default 0,
  add_to_carts        bigint  not null default 0,
  initiate_checkouts  bigint  not null default 0,
  updated_at          timestamptz not null default now(),
  primary key (user_id, account_external_id, ad_id, date)
);
create index if not exists ad_metrics_acct_ad_idx   on public.ad_metrics (user_id, account_external_id, ad_id);
create index if not exists ad_metrics_acct_date_idx on public.ad_metrics (user_id, account_external_id, date);

-- Per-ad metadata (name, status, parents, creative thumb + catalog flag + format, ad-set end date), so the
-- app renders + ranks entirely off the store. One row per ad.
create table if not exists public.ad_meta (
  user_id             uuid    not null,
  account_external_id text    not null,
  ad_id               text    not null,
  name                text,
  effective_status    text,
  campaign_id         text,
  campaign_name       text,
  adset_id            text,
  adset_name          text,
  thumb_url           text,
  is_catalog          boolean,
  adset_end_unix      bigint,
  format              text,
  updated_at          timestamptz not null default now(),
  primary key (user_id, account_external_id, ad_id)
);
create index if not exists ad_meta_acct_idx on public.ad_meta (user_id, account_external_id);

-- One row per (user, account): the last sync's outcome, so a background run is observable without logs.
-- meta_ads / meta_error record the METADATA step independently of the metrics step, so an empty ad_meta is
-- never masked by a metrics-only last_ok = true.
create table if not exists public.ad_sync_state (
  user_id             uuid    not null,
  account_external_id text    not null,
  last_synced_date    date,
  last_run_at         timestamptz,
  ads_seen            integer,
  last_ok             boolean,
  last_error          text,
  last_rows           integer,
  meta_ads            integer,
  meta_error          text,
  updated_at          timestamptz not null default now(),
  primary key (user_id, account_external_id)
);

-- Observability columns (added after the tables existed; kept here so a fresh apply matches production).
alter table public.ad_sync_state add column if not exists meta_ads  integer;
alter table public.ad_sync_state add column if not exists meta_error text;

-- Service-role-only access: deny-by-default for everyone else.
alter table public.ad_metrics    enable row level security;
alter table public.ad_meta       enable row level security;
alter table public.ad_sync_state enable row level security;
