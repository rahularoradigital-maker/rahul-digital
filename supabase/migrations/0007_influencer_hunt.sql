-- 0007_influencer_hunt.sql
-- APPLIED VIA THE SUPABASE MCP (apply_migration name=influencer_hunt_foundation), then mirrored here for
-- review/VCS - the live schema is authoritative (see supabase/migrations/README.md). Do NOT assume a clean
-- DB can be rebuilt from files alone.
--
-- Influencer Hunt module tables. All service-role-only: RLS ON with NO policy (default-deny for anon/
-- authenticated; only the admin client reaches rows, scoped by user_id in code). Every table carries
-- provenance + freshness so no value is shown without a source/confidence. Gated by INFLUENCER_HUNT_ENABLED.

create table if not exists public.influencer_creator (
  user_id uuid not null, account_external_id text not null, platform text not null, platform_user_id text not null,
  handle text, profile_url text, name text, bio text, followers bigint, following bigint, posts_count bigint,
  verified boolean, account_type text, creator_country text, creator_language text,
  avg_likes bigint, avg_comments bigint, avg_views bigint, engagement_rate numeric, engagement_method text,
  business_email text, evidence jsonb, collected_at timestamptz, updated_at timestamptz not null default now(),
  primary key (user_id, account_external_id, platform, platform_user_id)
);
create index if not exists influencer_creator_acct_idx on public.influencer_creator (user_id, account_external_id);
alter table public.influencer_creator enable row level security;

create table if not exists public.influencer_audience_snapshot (
  user_id uuid not null, account_external_id text not null, platform text not null, platform_user_id text not null,
  estimate jsonb not null, basis text, sample_size integer, confidence text,
  collected_at timestamptz not null default now(),
  primary key (user_id, account_external_id, platform, platform_user_id)
);
alter table public.influencer_audience_snapshot enable row level security;

create table if not exists public.influencer_search (
  id uuid not null default gen_random_uuid(), user_id uuid not null, account_external_id text not null,
  raw_query text, spec jsonb not null, status text, last_error text, results_count integer,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (id)
);
create index if not exists influencer_search_acct_idx on public.influencer_search (user_id, account_external_id, created_at desc);
alter table public.influencer_search enable row level security;

create table if not exists public.influencer_search_result (
  search_id uuid not null, user_id uuid not null, platform text not null, platform_user_id text not null,
  rank integer, scores jsonb, top_reason text, updated_at timestamptz not null default now(),
  primary key (search_id, platform, platform_user_id)
);
create index if not exists influencer_result_search_idx on public.influencer_search_result (search_id, rank);
alter table public.influencer_search_result enable row level security;

create table if not exists public.influencer_contact (
  user_id uuid not null, account_external_id text not null, platform text not null, platform_user_id text not null,
  field text not null, value text, status text, source text, confidence text,
  collected_at timestamptz not null default now(),
  primary key (user_id, account_external_id, platform, platform_user_id, field)
);
alter table public.influencer_contact enable row level security;

create table if not exists public.influencer_shortlist (
  user_id uuid not null, account_external_id text not null, platform text not null, platform_user_id text not null,
  stage text not null default 'shortlisted', note text, updated_at timestamptz not null default now(),
  primary key (user_id, account_external_id, platform, platform_user_id)
);
alter table public.influencer_shortlist enable row level security;

create table if not exists public.influencer_memory (
  user_id uuid not null, account_external_id text not null, platform text not null, platform_user_id text not null,
  kind text not null, detail jsonb, updated_at timestamptz not null default now(),
  primary key (user_id, account_external_id, platform, platform_user_id, kind)
);
alter table public.influencer_memory enable row level security;

create table if not exists public.influencer_sync_state (
  user_id uuid not null, account_external_id text not null, last_run_at timestamptz, last_ok boolean,
  last_error text, creators_seen integer, updated_at timestamptz not null default now(),
  primary key (user_id, account_external_id)
);
alter table public.influencer_sync_state enable row level security;
