-- AdBrain Phase 0 + Phase 1 schema.
-- Run this in the Supabase SQL editor (see SETUP.md). Safe to re-run.

-- BRANDS: a workspace the user analyzes (one user can have many).
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  niche text,
  meta_page_url text,
  created_at timestamptz not null default now()
);

-- COMPETITORS tracked for a brand.
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  meta_page_url text,
  created_at timestamptz not null default now()
);

-- COMPETITOR_ADS ingested from a source (Meta Ad Library, etc.).
create table if not exists public.competitor_ads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  competitor_id uuid references public.competitors (id) on delete set null,
  source text not null default 'meta_ad_library',
  external_ad_id text,
  advertiser_name text,
  creative_url text,
  ad_copy text,
  format text,
  first_seen timestamptz,
  raw_json jsonb,
  created_at timestamptz not null default now()
);

-- TRIPLES: the Brand Brain knowledge graph (subject -> predicate -> object).
create table if not exists public.triples (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  subject text not null,
  predicate text not null,
  object text not null,
  confidence real not null default 0.5,
  source_type text not null default 'deconstruction', -- deconstruction | result | competitor_scan
  source_id uuid,
  created_at timestamptz not null default now(),
  unique (brand_id, subject, predicate, object)
);

-- TEST_PLANS: a ranked weekly plan for a brand.
create table if not exists public.test_plans (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  week_of date,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- TEST_PLAN_ITEMS: individual ranked recommendations within a plan.
create table if not exists public.test_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.test_plans (id) on delete cascade,
  rank int not null,
  hypothesis text not null,
  rationale text,
  confidence real not null default 0.5,
  evidence_triple_ids uuid[] not null default '{}'
);

create index if not exists brands_user_idx on public.brands (user_id);
create index if not exists competitors_brand_idx on public.competitors (brand_id);
create index if not exists competitor_ads_brand_idx on public.competitor_ads (brand_id);
create index if not exists triples_brand_idx on public.triples (brand_id);
create index if not exists test_plans_brand_idx on public.test_plans (brand_id);
create index if not exists test_plan_items_plan_idx on public.test_plan_items (plan_id);

-- Row Level Security: users only ever see their own data.
alter table public.brands enable row level security;
alter table public.competitors enable row level security;
alter table public.competitor_ads enable row level security;
alter table public.triples enable row level security;
alter table public.test_plans enable row level security;
alter table public.test_plan_items enable row level security;

-- brands: owned directly by the user.
drop policy if exists "own brands" on public.brands;
create policy "own brands" on public.brands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper predicate: a brand belongs to the current user.
-- child tables check ownership through their brand_id.
drop policy if exists "own competitors" on public.competitors;
create policy "own competitors" on public.competitors
  for all using (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()));

drop policy if exists "own competitor_ads" on public.competitor_ads;
create policy "own competitor_ads" on public.competitor_ads
  for all using (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()));

drop policy if exists "own triples" on public.triples;
create policy "own triples" on public.triples
  for all using (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()));

drop policy if exists "own test_plans" on public.test_plans;
create policy "own test_plans" on public.test_plans
  for all using (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid()));

drop policy if exists "own test_plan_items" on public.test_plan_items;
create policy "own test_plan_items" on public.test_plan_items
  for all using (exists (
    select 1 from public.test_plans p join public.brands b on b.id = p.brand_id
    where p.id = plan_id and b.user_id = auth.uid()))
  with check (exists (
    select 1 from public.test_plans p join public.brands b on b.id = p.brand_id
    where p.id = plan_id and b.user_id = auth.uid()));
