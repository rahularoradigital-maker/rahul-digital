-- Pricing Phase 2: product token metering + enforcement.
-- profiles.plan = the user's tier (free/starter/growth/scale). token_usage = the per-user, per-month debit
-- meter. Cost basis for the weights lives in lib/billing/plans.ts (Phase 0 measurement); this migration only
-- stores the counter and the atomic spend primitive.

alter table profiles add column if not exists plan text not null default 'free';

create table if not exists token_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,                         -- 'YYYY-MM' (UTC); a new month is a fresh row => monthly reset
  tokens_used int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

alter table token_usage enable row level security;

-- A user may READ their own meter (for the usage bar). WRITES only happen through the service-role RPC below,
-- so there is no user-facing insert/update policy (default deny) - a client can never edit its own balance.
drop policy if exists token_usage_select_own on token_usage;
create policy token_usage_select_own on token_usage for select using (auth.uid() = user_id);

-- Atomic spend-with-cap. Adds p_weight to the user's current-period usage ONLY if it stays within p_allowance,
-- in ONE statement, so two concurrent requests can never both slip past the cap during a multi-second AI call
-- (same invariant as reserve_ask_quota). Returns the new tokens_used, or NULL when it would exceed the
-- allowance (the caller treats NULL as "over cap, reject"). A single action larger than the whole allowance is
-- also rejected up front.
create or replace function spend_tokens(p_user uuid, p_period text, p_weight int, p_allowance int)
returns int
language plpgsql
as $$
declare v_used int;
begin
  if p_weight > p_allowance then
    return null;
  end if;
  insert into token_usage(user_id, period, tokens_used, updated_at)
  values (p_user, p_period, p_weight, now())
  on conflict (user_id, period) do update
    set tokens_used = token_usage.tokens_used + p_weight, updated_at = now()
    where token_usage.tokens_used + p_weight <= p_allowance
  returning tokens_used into v_used;
  return v_used;   -- NULL when the conflict-update WHERE filtered the row out (over cap)
end
$$;
