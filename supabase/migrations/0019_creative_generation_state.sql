-- Truthful generation metadata so an asset never claims to be an AI ad when a compositor-only fallback made
-- it. Written by lib/creative-production/pipeline.ts; surfaced in the Studio UI.
--   generation_state: AI_GENERATED | AI_GENERATED_WITH_FALLBACK | COMPOSITOR_ONLY | FAILED
--   requested_model:  the model we asked for; model (existing) = the model that ACTUALLY ran
--   fallback_used / fallback_reason: whether a fallback model produced the image, and why the primary failed
alter table public.cp_generations add column if not exists requested_model text;
alter table public.cp_generations add column if not exists fallback_used boolean;
alter table public.cp_generations add column if not exists fallback_reason text;
alter table public.cp_generations add column if not exists generation_state text;
alter table public.cp_assets add column if not exists requested_model text;
alter table public.cp_assets add column if not exists fallback_used boolean;
alter table public.cp_assets add column if not exists generation_state text;
