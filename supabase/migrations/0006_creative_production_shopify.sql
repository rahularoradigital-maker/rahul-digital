-- 0006 — Creative Production module: Shopify layer. Mirror of the migration applied via Supabase MCP
-- (apply_migration "creative_production_shopify"). Service-role only; RLS on, no public policies.
-- See docs/plans/creative-production-engine.md (Phases 1-2).

create table if not exists public.shopify_connections (
  user_id uuid not null,
  shop_domain text not null,
  access_token_encrypted text,            -- AES-256-GCM (lib/crypto.ts); null when status='url_only'
  scopes text,
  api_version text not null default '2026-07',
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, shop_domain)
);
alter table public.shopify_connections enable row level security;

create table if not exists public.shopify_products (
  user_id uuid not null,
  shop_domain text not null,
  product_id text not null,
  handle text,
  title text,
  description text,
  product_type text,
  vendor text,
  status text,
  online_store_url text,
  featured_image_url text,
  total_inventory integer,
  price numeric,
  compare_at_price numeric,
  tags jsonb,
  images jsonb,
  variants jsonb,
  collections jsonb,
  seo jsonb,
  metafields jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, shop_domain, product_id)
);
create index if not exists shopify_products_user_shop_idx on public.shopify_products (user_id, shop_domain);
alter table public.shopify_products enable row level security;

create table if not exists public.shopify_sync_state (
  user_id uuid not null,
  shop_domain text not null,
  last_synced_at timestamptz,
  last_run_at timestamptz,
  products_seen integer,
  last_ok boolean,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (user_id, shop_domain)
);
alter table public.shopify_sync_state enable row level security;
