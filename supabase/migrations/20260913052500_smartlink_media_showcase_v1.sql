-- WASSAFRICA Smart Link living media showcase foundation.
-- Additive only: existing Smart Link, commerce, messaging and payment columns remain untouched.
alter table public.businesses
  add column if not exists smartlink_teaser_video_url text,
  add column if not exists smartlink_teaser_poster_url text,
  add column if not exists smartlink_media jsonb not null default '[]'::jsonb;

comment on column public.businesses.smartlink_teaser_video_url is
  'Optional short public teaser video for the WASSAFRICA Smart Link.';
comment on column public.businesses.smartlink_teaser_poster_url is
  'Optional poster image URL for the Smart Link teaser video.';
comment on column public.businesses.smartlink_media is
  'Small curated Smart Link media gallery; objects use type,url,poster_url,title,caption.';
