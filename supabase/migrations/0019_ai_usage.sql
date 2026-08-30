-- Per-call AI usage + cost ledger for the admin/cost backend: which user, task, provider, model, tokens,
-- and USD cost. Deny-by-default RLS (service-role only); user_id cascades on user deletion. Applied live.
create table if not exists public.ai_usage (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  task              text,
  provider          text not null,
  model             text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  cost_usd          numeric(12,6) not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);
alter table public.ai_usage enable row level security;
