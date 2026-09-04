-- Video retention curve (P3/P4): per-ad, per-day counts of viewers who reached 25/50/75/100% of the video.
-- Meta returns these as video_p{25,50,75,100}_watched_actions. Nullable/default 0: historical rows synced
-- before this migration simply have no quartile data (the curve fills in going forward, honestly).
alter table public.ad_metrics
  add column if not exists video_p25 integer not null default 0,
  add column if not exists video_p50 integer not null default 0,
  add column if not exists video_p75 integer not null default 0,
  add column if not exists video_p100 integer not null default 0;
