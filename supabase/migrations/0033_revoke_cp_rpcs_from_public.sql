-- Phase-0 audit, corrective (2026-09-02). 0032 was INSUFFICIENT: Postgres grants EXECUTE to PUBLIC by
-- default, and revoking from anon/authenticated left the PUBLIC grant intact, so
-- has_function_privilege('anon', ...) still returned true (verified live). The real fix: revoke from PUBLIC
-- and re-grant service_role, so the app (service-role client) keeps working while anon/authenticated (who
-- only had it via PUBLIC) lose it. These 3 are the cross-tenant leak: SECURITY DEFINER + caller-supplied
-- p_user + REST-callable. handle_new_user is a trigger (returns trigger), NOT callable via PostgREST /rpc,
-- so it is not an attack vector and is left as-is.
-- APPLIED live 2026-09-02; verified anon_exec=f, authed_exec=f, service_exec=t for all three.
revoke execute on function public.cp_advertised_product_ids(uuid, uuid) from public;
revoke execute on function public.cp_product_opportunities(uuid, text, integer) from public;
revoke execute on function public.cp_product_types(uuid, text) from public;

grant execute on function public.cp_advertised_product_ids(uuid, uuid) to service_role;
grant execute on function public.cp_product_opportunities(uuid, text, integer) to service_role;
grant execute on function public.cp_product_types(uuid, text) to service_role;
