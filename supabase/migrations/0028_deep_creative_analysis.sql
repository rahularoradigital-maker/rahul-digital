-- Deep creative analysis: a one-time free-plan trial that reads the TOP-SPENDING creatives in depth -
-- real video MOTION (not just the cover frame) for videos, full image read for images. Strictly bounded:
-- free plan = one run, at most 10 creatives, top spenders only. One row per run, so the entitlement check
-- is simply "has this user run it before?". Written/read only via the service-role admin client (no client
-- policies), matching the rest of the app; RLS on as defence-in-depth.

create table if not exists deep_analysis_run (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_external_id text not null,
  created_at timestamptz not null default now(),
  creatives_analyzed int not null default 0,
  plan text not null default 'free'
);
create index if not exists deep_analysis_run_user_idx on deep_analysis_run (user_id, created_at desc);
alter table deep_analysis_run enable row level security;

-- The per-creative deep read, kept so it is reused (fingerprint-once by content_hash) and shown to the
-- user transparently (exactly which creatives AdScale spent the read on). motion_summary is the video-only
-- extra: what changes across the video, which the cover-frame read cannot see.
create table if not exists deep_creative_read (
  user_id uuid not null,
  content_hash text not null,
  ad_id text,
  ad_name text,
  format text,
  spend_rs numeric,
  scene_type text,
  setting text,
  palette text,
  visual_mood text,
  content_subject text,
  motion_summary text,
  model text,
  created_at timestamptz not null default now(),
  primary key (user_id, content_hash)
);
create index if not exists deep_creative_read_user_idx on deep_creative_read (user_id, created_at desc);
alter table deep_creative_read enable row level security;
