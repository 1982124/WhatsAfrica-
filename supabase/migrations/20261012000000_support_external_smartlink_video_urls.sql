ALTER TABLE public.smart_link_media ALTER COLUMN bucket_id DROP NOT NULL;
ALTER TABLE public.smart_link_media ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.smart_link_media DROP CONSTRAINT IF EXISTS smart_link_media_kind_check;
ALTER TABLE public.smart_link_media ADD CONSTRAINT smart_link_media_kind_check
  CHECK (kind = ANY (ARRAY['gallery'::text, 'video'::text, 'video_link'::text]));
ALTER TABLE public.smart_link_media DROP CONSTRAINT IF EXISTS smart_link_media_bucket_id_check;
ALTER TABLE public.smart_link_media ADD CONSTRAINT smart_link_media_bucket_id_check
  CHECK (bucket_id IS NULL OR bucket_id = ANY (ARRAY['public-media'::text, 'public-video'::text]));
ALTER TABLE public.smart_link_media ADD CONSTRAINT smart_link_media_video_link_shape_check
  CHECK ((kind <> 'video_link') OR (bucket_id IS NULL AND storage_path IS NULL AND public_url ~ '^https?://'));
