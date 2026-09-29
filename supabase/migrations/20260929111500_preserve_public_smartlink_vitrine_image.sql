-- WASSAFRICA: empêcher qu'une vitrine déjà publique perde son image de couverture.
create or replace function public.prevent_public_smartlink_cover_removal()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $function$
begin
  if nullif(trim(new.cover_image_url), '') is null
     and exists (
       select 1 from public.smart_links sl
        where sl.business_id = new.id
          and sl.is_public = true
     )
  then
    raise exception 'SMARTLINK_COVER_IMAGE_REQUIRED'
      using detail = 'Cette vitrine est déjà publique. Ajoutez une nouvelle image avant de retirer l’image actuelle.',
            hint = 'Une vitrine publique WASSAFRICA doit toujours conserver une image.';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_prevent_public_smartlink_cover_removal on public.businesses;

create trigger trg_prevent_public_smartlink_cover_removal
before update of cover_image_url
on public.businesses
for each row
execute function public.prevent_public_smartlink_cover_removal();

alter function public.prevent_public_smartlink_cover_removal()
  set search_path = public, pg_catalog;
