-- 0011 Pending org invites: an owner/admin invites by email + role (+ optional brand grants). No email
-- server needed - when a person signs in with that email, the app resolves their pending invites into real
-- memberships. (UI + resolver land in a follow-up; this is the schema.)
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  brand_ids uuid[] not null default '{}',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists org_invites_org_email_uidx on public.org_invites(org_id, lower(email));
create index if not exists org_invites_email_pending_idx on public.org_invites(lower(email)) where accepted_at is null;
alter table public.org_invites enable row level security;
