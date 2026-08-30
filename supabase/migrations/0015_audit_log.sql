-- Immutable audit log (control-plane foundation). Every high-risk / privileged action writes ONE row here.
-- Tamper-evidence is enforced at the DATABASE level, not by trusting the app: a BEFORE UPDATE/DELETE trigger
-- raises, so not even the service-role key can silently rewrite or erase history. RLS is deny-by-default
-- (no policy) so only the server (service role) can INSERT/read; the app never exposes this table to a client.
-- Written by lib/security/audit-log.ts. Secrets must NEVER be stored here (only references/fingerprints).

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid,                       -- the human/admin who acted (auth.users.id); null for system/cron
  actor_role text,                     -- their role at action time (owner/admin/member/viewer/system)
  org_id uuid,                         -- tenant context, when known
  action text not null,                -- dotted verb, e.g. 'credential.rotate', 'credits.grant', 'killswitch.execute'
  target_type text,                    -- what was acted on, e.g. 'ad_account', 'user', 'rule'
  target_id text,                      -- id of the target (text so it fits uuids and external ids alike)
  before_state jsonb,                  -- prior value (NO secrets - reference/fingerprint only)
  after_state jsonb,                   -- new value (NO secrets)
  reason text,                         -- why - required for dangerous actions by convention
  result text not null default 'ok' check (result in ('ok','denied','error')),
  request_id text,                     -- correlation id for tracing across services
  ip inet,                             -- where appropriate
  user_agent text,                     -- where appropriate
  approval jsonb                       -- four-eyes: {initiatedBy, approvedBy, ...} when the action required it
);

create index if not exists audit_log_occurred_idx on public.audit_log(occurred_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id, occurred_at desc);
create index if not exists audit_log_action_idx on public.audit_log(action, occurred_at desc);
create index if not exists audit_log_target_idx on public.audit_log(target_type, target_id);

alter table public.audit_log enable row level security;
-- no policy => deny-by-default for anon/authenticated. Only the service-role client can touch it.

-- Immutability: block every UPDATE and DELETE at the DB, so audit history is append-only and tamper-evident
-- even against a compromised service key or a buggy admin. This is the load-bearing guarantee.
create or replace function public.audit_log_immutable() returns trigger as $$
begin
  raise exception 'audit_log is append-only: % is not permitted', tg_op;
end;
$$ language plpgsql;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.audit_log_immutable();

drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.audit_log_immutable();
