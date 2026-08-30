-- 0010 Brand-scope the creative-production subsystem. Creative outputs + the Shopify connection are
-- BRAND-level, so they gain brand_id (additive, nullable, backfilled to each row's owner's active brand).
-- Product-level rows (cp_product_dna, shopify_products) stay keyed by shop_domain, which flows from the
-- brand's connection.

alter table public.cp_concepts add column if not exists brand_id uuid references public.brands(id) on delete cascade;
alter table public.cp_assets add column if not exists brand_id uuid references public.brands(id) on delete cascade;
alter table public.cp_generations add column if not exists brand_id uuid references public.brands(id) on delete cascade;
alter table public.cp_brand_dna add column if not exists brand_id uuid references public.brands(id) on delete cascade;
alter table public.shopify_connections add column if not exists brand_id uuid references public.brands(id) on delete cascade;

create index if not exists cp_concepts_brand_idx on public.cp_concepts(brand_id);
create index if not exists cp_assets_brand_idx on public.cp_assets(brand_id);
create index if not exists cp_generations_brand_idx on public.cp_generations(brand_id);
create index if not exists shopify_connections_brand_idx on public.shopify_connections(brand_id);

update public.cp_concepts    c set brand_id = a.brand_id from public.ad_accounts a where a.user_id = c.user_id and a.is_active = true and c.brand_id is null;
update public.cp_assets      c set brand_id = a.brand_id from public.ad_accounts a where a.user_id = c.user_id and a.is_active = true and c.brand_id is null;
update public.cp_generations c set brand_id = a.brand_id from public.ad_accounts a where a.user_id = c.user_id and a.is_active = true and c.brand_id is null;
update public.cp_brand_dna   c set brand_id = a.brand_id from public.ad_accounts a where a.user_id = c.user_id and a.is_active = true and c.brand_id is null;
update public.shopify_connections c set brand_id = a.brand_id from public.ad_accounts a where a.user_id = c.user_id and a.is_active = true and c.brand_id is null;
