-- ISSUE 01: competitor uniqueness must include account scope, or the same page/ad in two Meta
-- accounts collides and one account overwrites the other. account_external_id is nullable, so the
-- indexes are NULLS NOT DISTINCT (PG15+) - a no-account (null) scan still dedupes against its own rows.
-- Applied via Supabase MCP on 2026-08-28.
alter table public.competitor_ads drop constraint if exists competitor_ads_pkey;
create unique index if not exists competitor_ads_user_acct_page_ad_key
  on public.competitor_ads (user_id, account_external_id, page_id, ad_archive_id) nulls not distinct;

alter table public.competitor_brands drop constraint if exists competitor_brands_user_id_page_id_key;
create unique index if not exists competitor_brands_user_acct_page_key
  on public.competitor_brands (user_id, account_external_id, page_id) nulls not distinct;
