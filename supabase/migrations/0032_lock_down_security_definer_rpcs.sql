-- P0 Security (Phase-0 audit, stop-condition #1 — APPLY MANUALLY in the Supabase SQL editor).
--
-- WHY: these SECURITY DEFINER functions filter on a CALLER-SUPPLIED p_user and were executable by the
-- `anon` and `authenticated` roles over the public REST API (/rest/v1/rpc/...). SECURITY DEFINER runs as the
-- owner and bypasses RLS, so anyone holding the public anon key could read ANY tenant's product /
-- opportunity data by passing that tenant's uuid — a cross-tenant read that skips every Next.js guard.
-- Verified live 2026-09-02 (pg_proc.prosecdef=true, has_function_privilege('anon', ..., 'EXECUTE')=true).
--
-- SAFE: the app calls these ONLY through the service-role client (app/api/creative-production/products
-- and /recommendations use createAdminClient().rpc(...)), and service_role keeps EXECUTE. handle_new_user()
-- is a trigger function with no app caller. Reversible with GRANT EXECUTE ... TO anon, authenticated.

revoke execute on function public.cp_advertised_product_ids(uuid, uuid) from anon, authenticated;
revoke execute on function public.cp_product_opportunities(uuid, text, integer) from anon, authenticated;
revoke execute on function public.cp_product_types(uuid, text) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Supabase advisor WARN "function_search_path_mutable": pin search_path so a role cannot hijack name
-- resolution inside these functions.
alter function public.audit_log_immutable() set search_path = public;
alter function public.spend_tokens(uuid, text, integer, integer) set search_path = public;

-- Verify (expect anon_exec=false, authed_exec=false, service_exec=true for all four):
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_exec,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public'
--   and p.proname in ('cp_advertised_product_ids','cp_product_opportunities','cp_product_types','handle_new_user');
