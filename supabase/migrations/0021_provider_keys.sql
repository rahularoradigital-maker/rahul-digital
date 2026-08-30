-- Runtime-managed provider keys (owner can set/rotate from the admin console). Values are AES-GCM ENCRYPTED
-- at rest (same scheme as oauth_tokens, master key stays in env), only last4 is kept for display, and the raw
-- value is NEVER returned to the client. Deny-by-default RLS (service-role only). Applied live 2026-08-30.
create table if not exists public.provider_keys (
  name            text primary key,
  encrypted_value text not null,
  last4           text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null
);
alter table public.provider_keys enable row level security;
