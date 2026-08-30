-- Fix: the notifications dedupe upsert (onConflict user_id,dedupe_key in lib/notifications/store.ts) needs a
-- NON-partial unique index as its ON CONFLICT arbiter. The original 0013 index was partial
-- (WHERE dedupe_key IS NOT NULL), which PostgREST cannot use as a conflict target -> every deduped
-- notification (including the nightly sync-failure alerts) silently failed to persist. A full unique index
-- serves ON CONFLICT; Postgres default NULLS DISTINCT still lets non-deduped (NULL dedupe_key) rows insert
-- freely, so plain notifications are unaffected. Applied live 2026-08-30.
drop index if exists public.notifications_dedupe_uidx;
create unique index if not exists notifications_dedupe_uidx on public.notifications (user_id, dedupe_key);