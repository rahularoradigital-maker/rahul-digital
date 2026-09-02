-- Phase-0 audit (2026-09-02). Cover the 7 foreign keys the Supabase advisor flagged as unindexed (exact
-- columns verified live), and add the partial index that serves the failed-login lockout read in
-- lib/owner/events.ts (event_type='login.failed' AND meta->>'email'=? AND created_at>=?).
-- APPLIED live 2026-09-02.
create index if not exists cp_brand_dna_brand_id_idx on public.cp_brand_dna (brand_id);
create index if not exists influencer_search_result_user_id_idx on public.influencer_search_result (user_id);
create index if not exists notifications_brand_id_idx on public.notifications (brand_id);
create index if not exists notifications_org_id_idx on public.notifications (org_id);
create index if not exists org_invites_invited_by_idx on public.org_invites (invited_by);
create index if not exists profiles_approved_by_idx on public.profiles (approved_by);
create index if not exists provider_keys_updated_by_idx on public.provider_keys (updated_by);

create index if not exists owner_events_failed_login_idx
  on public.owner_events ((meta->>'email'), created_at desc)
  where event_type = 'login.failed';
