-- WASSAFRICA: une vitrine publique doit toujours avoir une image de couverture.
-- La règle est gratuite et s'applique à toute publication Smart Link.

create or replace function public.require_smartlink_cover_image()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $function$
declare
  cover text;
begin
  if new.is_public = true then
    select nullif(trim(b.cover_image_url), '')
      into cover
      from public.businesses b
     where b.id = new.business_id;

    if cover is null or cover !~* '^https?://'
       then
      raise exception 'SMARTLINK_COVER_IMAGE_REQUIRED'
        using detail = 'Ajoutez une image de couverture à votre vitrine avant de publier le Smart Link.',
              hint = 'L’image de vitrine est obligatoire pour toute publication publique.';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists trg_require_smartlink_cover_image on public.smart_links;

create trigger trg_require_smartlink_cover_image
before insert or update of is_public, business_id
on public.smart_links
for each row
execute function public.require_smartlink_cover_image();

alter function public.require_smartlink_cover_image()
  set search_path = public, pg_catalog;
