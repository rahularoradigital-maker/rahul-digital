-- Security: defense-in-depth on the cp-assets storage bucket (creative-production assets).
-- The bucket is already private (public=false, signed-URL access only) and its only writer is the
-- server-side pipeline uploading generated SVGs - there is no user file-upload surface. These limits
-- bound any future or misused upload path: max 10 MB, image mime types only. The current upload
-- (image/svg+xml, a few KB) is on the allow-list, so this does not change existing behaviour.
-- Applied to prod 2026-09-02 via the management API; kept here so the state is reproducible + tracked.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/svg+xml','image/png','image/jpeg','image/webp']
where id = 'cp-assets';
