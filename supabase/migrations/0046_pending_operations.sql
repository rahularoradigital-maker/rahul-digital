-- Permissions & approval (Track A, Phase A5). Every SIGNIFICANT operation (a proposed budget change or pause)
-- lands here as a PENDING row a human must approve before anything could ever act on it. Track A never executes
-- - an approved op ends as "approved" with an Ads-Manager hand-off link - but the queue + state machine are the
-- gate Track B's executor will sit behind. RLS default-deny: the app reads/writes via the service role scoped
-- to user_id (same tenancy pattern as the rest); no direct client access.
create table if not exists public.pending_operations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  account_external_id text not null default '*',
  kind                text not null,   -- the operation kind (propose_budget_change | propose_pause | ...)
  status              text not null,   -- ready_for_approval | approved | rejected | blocked | handed_off
  operation           jsonb not null,  -- the typed Operation (A1)
  validation          jsonb,           -- the deterministic validation result (A4): the computed proposal + violations
  dispatch            jsonb,           -- the real read the proposal was built from (A3)
  decided_by          uuid,            -- who approved/rejected
  decided_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.pending_operations enable row level security;
create index if not exists pending_operations_user_status_idx on public.pending_operations (user_id, status, created_at desc);
