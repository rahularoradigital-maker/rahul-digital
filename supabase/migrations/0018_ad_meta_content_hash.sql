-- content_hash on ad_meta so the STORE path (from-store, the primary cockpit path) can key into the
-- fingerprint-once semantic decode cache (creative_semantics) and show hook/emotion/subject diversity, not
-- just format. Written by the ingestion (lib/ingest/ad-metrics.ts), which already computes the fingerprint.
alter table public.ad_meta add column if not exists content_hash text;
