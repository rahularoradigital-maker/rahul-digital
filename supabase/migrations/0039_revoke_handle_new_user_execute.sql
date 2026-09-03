-- Phase 2 security close-out (2026-09-03). Least-privilege for the signup trigger function. handle_new_user
-- is a SECURITY DEFINER trigger (runs on auth.users insert). The advisor WARNs that anon/authenticated can
-- "execute it via /rest/v1/rpc/handle_new_user" - but it returns `trigger`, so calling it directly errors
-- ("trigger functions can only be called as triggers"): PROVEN not RPC-callable. This revoke is defense-in-
-- depth: remove the (unusable) grant so the linter is clean and no future change can make it callable.
-- SAFE for signups: Postgres does NOT check EXECUTE on a trigger function when the trigger fires (the trigger
-- runs under the table owner's authority), and supabase_auth_admin / owner grants are untouched.
-- APPLIED live 2026-09-03.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
