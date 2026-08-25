-- ADR-0002: ad-account connection + encrypted OAuth token storage.
-- Run in the Supabase SQL editor after 0001. Safe to re-run.

-- Connected ad accounts (Meta primary, Google secondary). Owned by the user.
create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('meta','google')),
  external_id text not null,
  name text,
  status text not null default 'connected',   -- connected | disconnected | error
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

-- Encrypted OAuth tokens. Values are AES-256-GCM payloads from lib/crypto.ts.
-- This table is SERVER-ONLY: RLS is enabled with NO policies, so anon/authenticated
-- clients get zero rows. Only the service role (server code) bypasses RLS.
create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  encrypted_access text not null,
  encrypted_refresh text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id)
);

create index if not exists ad_accounts_user_idx on public.ad_accounts (user_id);

alter table public.ad_accounts enable row level security;
alter table public.oauth_tokens enable row level security;

-- ad_accounts: owner can see/manage their own connections.
drop policy if exists "own ad_accounts" on public.ad_accounts;
create policy "own ad_accounts" on public.ad_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- oauth_tokens: intentionally NO policy. RLS on + no policy = default deny for
-- clients. Server code uses the service-role key, which bypasses RLS. Tokens must
-- never be readable by the browser.
