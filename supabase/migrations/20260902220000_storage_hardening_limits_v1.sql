-- Harden known public media buckets with explicit size and MIME limits.
-- Keep public read where Smart Links/catalog/status distribution requires it.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[]
where id = 'product-media';

update storage.buckets
set file_size_limit = 6291456,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[]
where id = 'public-media';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[]
where id = 'status-media';

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['video/mp4','video/webm']::text[]
where id = 'public-video';
