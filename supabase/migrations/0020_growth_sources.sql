-- Source Registry (growth spec section 5): one row per Scout discovery source, with its acquisition method and
-- live health (last success/failure, count, status). Scout updates it on every run so the owner can see which
-- sources are working, degraded, or need setup. Owner-internal; RLS deny-by-default (service role only).

create table if not exists public.growth_sources (
  source_id text primary key,        -- e.g. 'hackernews', 'stackexchange', 'googlenews', 'reddit'
  platform text not null,
  method text not null,              -- 'api' | 'rss' | 'public-json' | 'connector'
  status text not null default 'active' check (status in ('active','degraded','needs_setup','disabled')),
  last_success timestamptz,
  last_failure timestamptz,
  last_count int not null default 0, -- items returned on the last successful run
  health text not null default 'unknown' check (health in ('healthy','degraded','down','unknown')),
  note text,                         -- e.g. 'needs a free Reddit app'
  updated_at timestamptz not null default now()
);

alter table public.growth_sources enable row level security;
-- no policy => only the service-role client reads/writes.
