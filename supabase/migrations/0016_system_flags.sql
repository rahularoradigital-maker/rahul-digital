-- System flags: kill switches + feature flags, toggleable at runtime WITHOUT a redeploy. Read by
-- lib/security/flags.ts (env var always wins as the guaranteed brake; this table is the no-redeploy layer).
-- RLS deny-by-default (no policy) - only the service role reads/writes; a flip is an audited control-plane
-- action (action 'killswitch.execute' / 'feature_flag.change' in audit_log). Kind distinguishes a kill switch
-- (default OFF = running; ON = halted) from a feature flag (default from code).

create table if not exists public.system_flags (
  key text primary key,                 -- e.g. 'ai', 'meta_sync', 'creative_studio', 'competitor_market'
  kind text not null default 'feature' check (kind in ('kill','feature')),
  enabled boolean not null default false,-- kill: true = HALTED. feature: true = ON.
  scope jsonb,                          -- optional narrowing: { orgId } / { userId } for a targeted flip
  reason text,                          -- why it was flipped (shown to ops)
  updated_by uuid,                      -- the admin who flipped it
  updated_at timestamptz not null default now()
);

alter table public.system_flags enable row level security;
-- no policy => only the service-role client can read/write flags.
