-- Growth-agent output store (owner-internal, NOT customer data). One row per daily brief the agent generates
-- from free discovery. Draft-only: this table holds analysis + suggested drafts, never anything published.
-- RLS deny-by-default (no policy) - only the service role writes/reads it; it is never exposed to a customer.

create table if not exists public.growth_briefs (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  generated_at timestamptz not null default now(),
  discovered int not null default 0,
  draftable int not null default 0,
  demand_signals int not null default 0,
  brief jsonb not null,            -- the full Brief object (top opportunities, demand signals, learn items)
  created_at timestamptz not null default now()
);

-- One brief per day (the daily run upserts). Newest-first reads for the owner dashboard.
create unique index if not exists growth_briefs_day_uidx on public.growth_briefs(day);
create index if not exists growth_briefs_generated_idx on public.growth_briefs(generated_at desc);

alter table public.growth_briefs enable row level security;
-- no policy => only the service-role client can read/write.
