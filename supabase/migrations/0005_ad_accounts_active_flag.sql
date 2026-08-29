-- ISSUE 25: explicit active-account flag instead of overloading connected_at. Partial unique index
-- enforces one active per user+platform; backfill preserves current behavior. Applied via Supabase MCP
-- on 2026-08-29.
alter table public.ad_accounts add column if not exists is_active boolean not null default false;
with ranked as (
  select id, row_number() over (partition by user_id, platform order by connected_at desc nulls last) as rn
  from public.ad_accounts where status = 'connected'
)
update public.ad_accounts a set is_active = true from ranked r where a.id = r.id and r.rn = 1;
create unique index if not exists ad_accounts_one_active_per_user
  on public.ad_accounts (user_id, platform) where is_active;
