-- NeoLife is the business/storefront Smart Link.
-- The dedicated product Smart Link remains `super-gro` and points to the Super Gro product.
update public.smart_links
set link_type = 'business'
where id = '7cd58d9a-434b-4747-999c-8e42531623a7'
  and slug = 'neolife'
  and business_id = '19b42084-33a6-4ef6-9677-b09782f0f705'
  and is_public = true;
