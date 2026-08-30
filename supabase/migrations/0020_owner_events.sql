-- Owner Control Center event spine (spec Section 39/53): append-only meaningful business events so DAU/
-- funnels/retention/feature-usage become computable as users arrive. Deny-by-default RLS (service-role only).
-- user_id set-null on delete (keep the anonymized event for aggregate history). Applied live 2026-08-30.
create table if not exists public.owner_events (
  id          bigint generated always as identity primary key,
  event_type  text not null,
  user_id     uuid references auth.users(id) on delete set null,
  feature     text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists owner_events_created_idx on public.owner_events (created_at desc);
create index if not exists owner_events_type_idx on public.owner_events (event_type, created_at desc);
create index if not exists owner_events_user_idx on public.owner_events (user_id, created_at desc);
alter table public.owner_events enable row level security;
