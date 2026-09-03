-- Phase 6 (audit) DB perf, advisor `auth_rls_initplan`: the two RLS policies that use bare auth.uid()
-- re-evaluate it PER ROW. Wrapping in (select auth.uid()) evaluates it ONCE per query - identical rows,
-- better plan at scale. These are the only two user-facing RLS policies (the rest of the app uses the
-- service-role model). APPLIED live 2026-09-03.
alter policy "own profile read" on public.profiles using ((select auth.uid()) = id);
alter policy "token_usage_select_own" on public.token_usage using ((select auth.uid()) = user_id);
