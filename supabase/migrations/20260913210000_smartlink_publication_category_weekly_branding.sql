-- WASSAFRICA Smart Link policy:
-- 1) every business gets a normalized platform category from business_type;
-- 2) Smart Link presentation/branding/media customization is limited to once per 7 days;
-- 3) operational commerce fields (stock, price, orders) are not blocked by this policy.

alter table public.businesses add column if not exists category text;
alter table public.businesses add column if not exists smartlink_last_customization_at timestamptz;

create or replace function public.normalize_business_category(p_type text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_type,''))
    when 'boutique' then 'Commerce'
    when 'atelier' then 'Artisanat'
    when 'salon' then 'Beauté'
    when 'garage' then 'Automobile'
    when 'immobilier' then 'Immobilier'
    when 'school' then 'Formation'
    when 'church' then 'Communautés'
    when 'service' then 'Services'
    when 'creator' then 'Créateurs'
    when 'agriculture' then 'Agriculture'
    when 'restaurant' then 'Restaurant & alimentation'
    when 'transport' then 'Transport & livraison'
    when 'professional' then 'Professionnels'
    when 'business' then 'Entreprise'
    else 'Autres activités'
  end;
$$;

create or replace function public.wassafrica_business_smartlink_guard()
returns trigger
language plpgsql
as $$
begin
  new.category := public.normalize_business_category(new.business_type);

  if tg_op = 'INSERT' then
    new.smartlink_last_customization_at := null;
    return new;
  end if;

  if (
    new.template is distinct from old.template or
    new.accent_color is distinct from old.accent_color or
    new.logo_url is distinct from old.logo_url or
    new.cover_image_url is distinct from old.cover_image_url or
    new.presentation is distinct from old.presentation or
    new.tagline is distinct from old.tagline or
    new.business_type is distinct from old.business_type or
    new.activity is distinct from old.activity or
    new.smartlink_teaser_video_url is distinct from old.smartlink_teaser_video_url or
    new.smartlink_teaser_poster_url is distinct from old.smartlink_teaser_poster_url or
    new.smartlink_media is distinct from old.smartlink_media
  ) then
    if old.smartlink_last_customization_at is not null
       and old.smartlink_last_customization_at > now() - interval '7 days' then
      raise exception 'SMARTLINK_CUSTOMIZATION_WEEKLY_LIMIT';
    end if;
    new.smartlink_last_customization_at := now();
  else
    new.smartlink_last_customization_at := old.smartlink_last_customization_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_wassafrica_business_smartlink_guard on public.businesses;
create trigger trg_wassafrica_business_smartlink_guard
before insert or update on public.businesses
for each row execute function public.wassafrica_business_smartlink_guard;

update public.businesses
set category = public.normalize_business_category(business_type)
where category is null or category = '';
