-- Reverses 0022. REMOVE the enforcement call sites (requireProductAccess / guardProductApi) FIRST,
-- else the app fails closed (everyone -> /waitlist) once profiles is gone.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop policy  if exists "own profile read" on public.profiles;
drop table   if exists public.profiles;
