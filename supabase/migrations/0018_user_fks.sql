-- Data-integrity + GDPR: add auth.users FKs (ON DELETE CASCADE) to every data table that stored user_id
-- with no FK, so deleting a user removes their data instead of orphaning it. Verified 0 orphans before
-- applying. Applied live 2026-08-30 (this file is the non-authoritative mirror).
alter table public.ad_changes add constraint ad_changes_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.ad_meta add constraint ad_meta_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.ad_metrics add constraint ad_metrics_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.ad_sync_state add constraint ad_sync_state_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.ask_log add constraint ask_log_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.brand_profiles add constraint brand_profiles_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.change_sync_state add constraint change_sync_state_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.cockpit_cache add constraint cockpit_cache_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.cp_assets add constraint cp_assets_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.cp_brand_dna add constraint cp_brand_dna_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.cp_concepts add constraint cp_concepts_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.cp_generations add constraint cp_generations_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.cp_product_dna add constraint cp_product_dna_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.creative_insights add constraint creative_insights_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_audience_snapshot add constraint influencer_audience_snapshot_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_contact add constraint influencer_contact_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_creator add constraint influencer_creator_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_memory add constraint influencer_memory_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_search add constraint influencer_search_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_search_result add constraint influencer_search_result_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_shortlist add constraint influencer_shortlist_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.influencer_sync_state add constraint influencer_sync_state_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.shopify_connections add constraint shopify_connections_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.shopify_products add constraint shopify_products_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.shopify_sync_state add constraint shopify_sync_state_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
