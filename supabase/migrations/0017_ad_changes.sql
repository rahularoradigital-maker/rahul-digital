-- NOTE: applied to the live DB under the history name "0015_ad_changes" (2026-08-30); this file is renamed
-- to 0017 only to keep repo ordinals unique (a parallel workstream owns 0015_audit_log + 0016_system_flags).
-- Migration files are the non-authoritative mirror; the Supabase migration history is the source of truth.
--
-- Media-Buyer Change Intelligence: change-history store + its incremental-sync cursor. Mirrors ad_metrics
-- conventions: (user_id, account_external_id, ...) scoping, deny-by-default RLS (service-role only),
-- created_at/updated_at. change_id is a synthetic stable id so re-ingest dedupes. Applied live 2026-08-30.
create table if not exists public.ad_changes (
  user_id             uuid not null,
  account_external_id text not null,
  change_id           text not null,        -- object_id:event_time:event_type (stable, dedupes on re-ingest)
  event_time          timestamptz not null,
  date                date not null,
  level               text,                  -- account | campaign | adset | ad
  object_id           text,
  object_name         text,
  campaign_id         text,
  adset_id            text,
  ad_id               text,
  event_type          text not null,
  change_type         text,                  -- pause|scale|budget|bid|audience|creative|status|name|optimization|other
  source              text not null,         -- 'buyer' | 'algo'
  actor_id            text,
  actor_name          text,
  extra_data          jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (user_id, account_external_id, change_id)
);
create index if not exists ad_changes_acct_obj_idx  on public.ad_changes (user_id, account_external_id, object_id);
create index if not exists ad_changes_acct_date_idx on public.ad_changes (user_id, account_external_id, date);
alter table public.ad_changes enable row level security;

create table if not exists public.change_sync_state (
  user_id             uuid not null,
  account_external_id text not null,
  last_event_time     timestamptz,
  last_ok             boolean,
  last_error          text,
  changes_seen        integer,
  last_run_at         timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (user_id, account_external_id)
);
alter table public.change_sync_state enable row level security;
