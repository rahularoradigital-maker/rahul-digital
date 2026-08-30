-- 0009 Tenancy: Org -> Brands -> Accounts. Additive (new tables + nullable columns) so existing
-- user_id-scoped data keeps working while the app is re-scoped brand-first incrementally.
--
-- Model: an org is the tenant (an agency OR a direct brand's company). An org has many brands; a brand has
-- many platform accounts (US/EU, or Meta+Google+TikTok later). owner/admin see every brand in the org;
-- member/viewer are restricted to the brands they're granted via brand_members (client confidentiality).

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'agency' check (type in ('agency','brand')),
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members(user_id);

-- Re-parent brands from a single user to an org. Keep user_id (nullable) so the existing competitor /
-- test-plan features that still write brands with user_id keep working during the transition.
alter table public.brands add column if not exists org_id uuid references public.orgs(id) on delete cascade;
alter table public.brands add column if not exists website text;
alter table public.brands alter column user_id drop not null;
create index if not exists brands_org_idx on public.brands(org_id);

-- Per-brand access grant for org members who are NOT owner/admin.
create table if not exists public.brand_members (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index if not exists brand_members_user_idx on public.brand_members(user_id);

-- A connected platform account belongs to a brand (many accounts per brand). Nullable + backfilled below.
alter table public.ad_accounts add column if not exists brand_id uuid references public.brands(id) on delete set null;
create index if not exists ad_accounts_brand_idx on public.ad_accounts(brand_id);

-- Deny-by-default RLS on the new tenancy tables, matching the existing data-table pattern (access is
-- service-role + code-level scoping; RLS is defense-in-depth).
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.brand_members enable row level security;

-- Backfill: attach existing data to one org, one brand per existing account, owner = the existing user.
-- Guarded so it is a no-op on a fresh DB (no accounts yet) or on re-run (orgs already exist).
do $$
declare
  v_user uuid;
  v_org uuid;
  r record;
  v_brand uuid;
begin
  if exists (select 1 from orgs) then return; end if;
  select user_id into v_user from ad_accounts order by created_at limit 1;
  if v_user is null then return; end if;

  insert into orgs (name, type) values ('Default Agency', 'agency') returning id into v_org;
  insert into org_members (org_id, user_id, role) values (v_org, v_user, 'owner');

  for r in select id, name, external_id, user_id from ad_accounts loop
    insert into brands (org_id, name, user_id)
      values (v_org, coalesce(nullif(r.name, ''), 'Brand ' || r.external_id), r.user_id)
      returning id into v_brand;
    update ad_accounts set brand_id = v_brand where id = r.id;
  end loop;
end $$;
