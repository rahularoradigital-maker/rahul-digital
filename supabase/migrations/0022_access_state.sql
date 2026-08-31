-- 0022 Private-beta access control. Additive + reversible + idempotent. Applied live via Supabase MCP;
-- this file is the repo record (see docs/access-control-plan.md). New signups default to WAITLIST via the
-- trigger; every user that existed BEFORE this migration is backfilled to APPROVED (lock-out safety).
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  access_state text not null default 'WAITLIST',
  email        text,
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  state_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_access_state_chk') then
    alter table public.profiles add constraint profiles_access_state_chk
      check (access_state in ('WAITLIST','INVITED','APPROVED','ACTIVE','SUSPENDED','REVOKED','ADMIN'));
  end if;
end $$;
create index if not exists profiles_state_idx on public.profiles(access_state);
alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, access_state) values (new.id, new.email, 'WAITLIST')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles (id, email, access_state, approved_at, state_reason)
select u.id, u.email, 'APPROVED', now(), 'backfill: pre-beta existing user'
from auth.users u
on conflict (id) do update
  set access_state = 'APPROVED',
      approved_at  = coalesce(public.profiles.approved_at, now()),
      state_reason = coalesce(public.profiles.state_reason, 'backfill: pre-beta existing user')
  where public.profiles.access_state = 'WAITLIST';
