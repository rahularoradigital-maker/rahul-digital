-- First-party, privacy-first website analytics. Records public-site pageviews + blog "reads" (a real
-- engagement signal, not just a landing). NO cookies, NO stored PII: `visitor_hash` is a DAILY server-side
-- hash of ip+ua (the raw values are never stored and the hash rotates each day), so it counts approximate
-- unique visitors per day without identifying anyone - the Plausible model. RLS default-deny (service-role
-- writes via /api/analytics; nobody reads it but the admin console via the service role).
create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  path         text not null,            -- pathname only, query stripped, bounded
  ref_host     text,                     -- referrer HOST only (no full URL, no query) - or null/'direct'
  visitor_hash text,                     -- daily hash(ip+ua+date+salt); NOT reversible, NOT cross-day
  event        text not null default 'view', -- 'view' | 'read' (read = scrolled/stayed on a blog post)
  created_at   timestamptz not null default now(),
  constraint page_views_event_chk check (event in ('view','read'))
);
alter table public.page_views enable row level security;
create index if not exists page_views_time_idx on public.page_views (created_at desc);
create index if not exists page_views_path_time_idx on public.page_views (path, created_at desc);
