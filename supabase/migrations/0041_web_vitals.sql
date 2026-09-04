-- S6 (scale plan): real-user Core Web Vitals (RUM). The client beacons LCP/FCP/TTFB/CLS from real /app loads
-- to /api/vitals, which writes here, so production read-path speed is a measured p75 TREND (does the L1/L2
-- cockpit cache actually keep loads fast across many serverless instances at 1,000 DAU?) instead of a guess.
-- RLS default-deny (service-role only, same as the rollup/verification tables); no client ever reads it.
create table if not exists public.web_vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                       -- nullable: a beacon can fire after sign-out / from an anon edge
  metric text not null,               -- LCP | FCP | TTFB | CLS | INP
  value numeric not null,             -- ms for timings, unitless for CLS
  rating text not null,               -- good | needs-improvement | poor (Google thresholds)
  path text,                          -- which /app route (bounded, no query string)
  created_at timestamptz not null default now()
);
alter table public.web_vitals enable row level security;
-- Read the recent window per metric for the p75 (admin console). Append-only; no update/delete path.
create index if not exists web_vitals_metric_time_idx on public.web_vitals (metric, created_at desc);
