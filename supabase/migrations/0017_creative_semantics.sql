-- Fingerprint-once cache for the semantic creative decode (funnel stage / hook / emotion / subject) that
-- powers the multi-dimensional diversity engine. Keyed by content_hash (deterministicFingerprint) so each
-- UNIQUE creative is decoded by the model ONCE and reused forever - the load-bearing cost control (a creative
-- is stable across runs). RLS deny-by-default: only the service role reads/writes; the app scopes by user_id.

create table if not exists public.creative_semantics (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_hash text not null,     -- deterministicFingerprint(asset).contentHash - the fingerprint-once key
  funnel_stage text,              -- TOF | MOF | BOF (inferred from the messaging)
  hook_type text,                 -- e.g. problem-solution, social-proof, offer, curiosity
  emotion text,                   -- primary emotion the copy pulls on
  subject text,                   -- product-led | human/UGC-led | lifestyle | ...
  model text,                     -- which model produced it (provenance)
  updated_at timestamptz not null default now(),
  primary key (user_id, content_hash)
);

create index if not exists creative_semantics_user_idx on public.creative_semantics(user_id);

alter table public.creative_semantics enable row level security;
-- no policy => only the service-role client can read/write.
