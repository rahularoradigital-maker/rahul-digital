-- Data-hygiene guarantee: the day-wise store only ever holds DELIVERED rows (impressions > 0). The app
-- filters to impressions > 0 on ingest (lib/ingest/ad-metrics.ts); this CHECK makes it ironclad at the DB,
-- so a 0/negative-impression row can never be stored and no rate (CTR/CPM/frequency) is ever computed on
-- non-delivery.
alter table public.ad_metrics add constraint ad_metrics_impressions_positive check (impressions > 0);
