-- Scout's approval queue (owner-internal). One row per drafted reply awaiting your review. Scout WRITES the
-- draft; you Approve/Dismiss and post it yourself (Scout never posts). RLS deny-by-default (service role only).
-- Nothing here is ever published automatically; status just tracks your review.

create table if not exists public.growth_drafts (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  platform text not null,
  community text,
  url text not null,
  title text,
  decision text not null,            -- DRAFT | REQUEST_APPROVAL
  score int not null default 0,      -- 0..100
  may_mention boolean not null default false,
  draft text,                        -- the AI-written reply (for your review; may be null if the model skipped)
  status text not null default 'pending' check (status in ('pending','approved','dismissed','posted')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per conversation (re-runs upsert, never duplicate a thread in the queue).
create unique index if not exists growth_drafts_url_uidx on public.growth_drafts(url);
create index if not exists growth_drafts_status_idx on public.growth_drafts(status, day desc);

alter table public.growth_drafts enable row level security;
-- no policy => only the service-role client reads/writes.
