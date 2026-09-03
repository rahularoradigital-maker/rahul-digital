-- Creative Intelligence OS — the schema spine (Master Phase Plan, Phase 0→1 "define the schema FIRST").
-- Two NEW tables for the only two objects that have no home today; everything else reuses existing tables
-- (brands/cp_brand_dna, cp_product_dna, ad_meta+creative_semantics, ad_metrics+rollups, competitor_ads,
-- decision_triples). RLS default-deny (service-role only) — same tenancy model as the rest of the app.
--
-- ⚠️ NOT YET APPLIED. This file is written for review; apply only on Rahul's green-light (schema migration is
-- a stated stop condition). Mirrors lib/creative-os/schema.ts.

-- 1) creative_patterns — the unified pattern object. persona/problem/desire/objection/trigger/angle/hook/
--    visual_hook/format/language/proof are all rows here, discriminated by `type`, each tied to a real source.
create table if not exists public.creative_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brand_id uuid,                      -- null = category/market-level pattern
  type text not null,                 -- one of the PATTERN_TYPES taxonomy
  text text not null,                 -- the pattern in real observed language
  source text not null,               -- own_ad | competitor | social | review | manual
  source_ref text,                    -- url / ad id / review id (provenance)
  performance jsonb,                  -- {spend,roas,impressions} when tied to a measured creative
  evidence jsonb,                     -- engagement / transcript snippet / comment counts
  created_at timestamptz not null default now()
);
alter table public.creative_patterns enable row level security;
create index if not exists creative_patterns_user_brand_type_idx
  on public.creative_patterns (user_id, brand_id, type, created_at desc);

-- 2) opportunities — the Opportunity Detection layer's output (persona × angle × format white-space + thesis).
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brand_id uuid not null,
  persona text,
  angle text,
  format text,
  thesis text not null,
  evidence jsonb,                     -- {patternIds:[...], note}
  confidence numeric not null default 0,
  status text not null default 'open',-- open|in_concept|testing|won|lost|dismissed
  created_at timestamptz not null default now()
);
alter table public.opportunities enable row level security;
create index if not exists opportunities_user_brand_status_idx
  on public.opportunities (user_id, brand_id, status, created_at desc);
