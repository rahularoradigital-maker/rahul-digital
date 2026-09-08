-- Advertising Memory, part 1 (Track A, Phase A2): per-account AUTOMATION RULES the user authors. These are
-- operational rules that will gate proposed actions later (max budget step, floor ROAS, protected campaigns
-- that must never be proposed for pausing, and the creative tone) - so they must be authoritative SERVER-SIDE
-- and shared across a user's devices/sessions, NOT a per-browser cookie. One row per (user, connected account);
-- account_external_id '*' holds the account-wide default. Rules live in a jsonb blob so a new rule type is a
-- code change, not another migration. RLS default-deny: the app reads/writes via the service role with an
-- app-level user_id filter (same tenancy pattern as notifications / rollups); no direct client access.
create table if not exists public.account_rules (
  user_id             uuid not null,
  account_external_id text not null default '*', -- the Meta ad-account id these rules apply to, or '*' = all
  rules               jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  primary key (user_id, account_external_id)
);
alter table public.account_rules enable row level security;
