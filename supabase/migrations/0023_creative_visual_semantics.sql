-- 0023 Visual creative decode. Adds image-vision dimensions to the fingerprint-once semantic cache
-- (same table + content_hash key as the copy decode). Populated by decodeMissingVisual (Gemini vision on
-- the creative image / video thumbnail), bounded per run, degrade-safe. Applied live via Supabase MCP.
alter table public.creative_semantics add column if not exists scene_type text;
alter table public.creative_semantics add column if not exists setting text;
alter table public.creative_semantics add column if not exists palette text;
alter table public.creative_semantics add column if not exists visual_mood text;
alter table public.creative_semantics add column if not exists content_subject text;
alter table public.creative_semantics add column if not exists visual_model text;
