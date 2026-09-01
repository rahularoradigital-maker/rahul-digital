-- 0030: store each ad's optimization EVENT so every screen can filter by objective + event.
-- The "event" is the ad set's promoted_object.custom_event_type when present (the specific conversion event,
-- e.g. ADD_TO_CART / PURCHASE / LEAD), else its optimization_goal (LINK_CLICKS / LANDING_PAGE_VIEWS / REACH …).
-- Additive + nullable + non-destructive: existing rows read null and populate on the next sync (charter §133).
alter table public.ad_meta add column if not exists optimization_event text;

comment on column public.ad_meta.optimization_event is
  'Ad set optimization event: promoted_object.custom_event_type || optimization_goal (raw Meta value). Powers the objective+event filter.';
