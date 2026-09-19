-- Restrict the public business discovery view to intentionally public fields.
-- The underlying businesses table remains RLS-protected; security_invoker preserves that model.
drop view if exists public.public_businesses;

create view public.public_businesses
with (security_invoker = true)
as
select
  id,
  name,
  slug,
  description,
  country,
  city,
  logo_url,
  cover_image_url,
  presentation,
  tagline,
  website_url,
  website,
  services,
  business_type,
  activity
from public.businesses
where slug is not null
  and btrim(slug) <> ''
  and name is not null
  and btrim(name) <> '';

grant select on public.public_businesses to anon, authenticated;
