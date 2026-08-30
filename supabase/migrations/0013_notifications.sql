-- Per-user Notification Center: an activity feed + intelligent failure surfacing for every user.
-- Rows are written by the service-role admin client (see lib/notifications/store.ts); RLS is deny-by-default
-- (no policy) so only the server can read/write - the app scopes every read by user_id, matching the rest of
-- the tenancy model. Already applied to the live DB on 2026-08-29; this file mirrors it for repo/CI parity.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  kind text not null,          -- 'sync' | 'ingestion' | 'analysis' | 'competitor' | 'auth' | 'system'
  status text not null default 'running' check (status in ('running','success','error','info','warning')),
  title text not null,
  detail text,
  action text,
  context jsonb,
  dedupe_key text,             -- collapse repeats of one ongoing condition into a single updated-in-place row
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id) where read_at is null;
-- One live row per (user, ongoing condition) so a nightly-failing sync doesn't spam the feed.
create unique index if not exists notifications_dedupe_uidx on public.notifications(user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
