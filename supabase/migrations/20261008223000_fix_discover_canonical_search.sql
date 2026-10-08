create or replace function public.discover_public_businesses(
  p_q text default '',
  p_country text default '',
  p_city text default '',
  p_kind text default '',
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select
    lower(btrim(public.unaccent(coalesce(p_q, '')))) as q,
    lower(btrim(public.unaccent(coalesce(p_country, '')))) as country,
    lower(btrim(public.unaccent(coalesce(p_city, '')))) as city,
    lower(btrim(coalesce(p_kind, ''))) as kind,
    greatest(1, least(coalesce(p_limit, 24), 60)) as lim,
    greatest(0, coalesce(p_offset, 0)) as off
),
filtered as (
  select b.id,b.owner_id,b.name,b.slug,b.description,b.presentation,b.country,b.city,b.logo_url,b.cover_image_url,b.phone,b.activity,b.category,b.business_type,b.is_personal,b.created_at,
    coalesce(sl.slug,b.slug) as smart_slug
  from public.businesses b
  left join lateral (
    select s.slug from public.smart_links s
    where s.business_id=b.id and s.is_public=true and s.link_type='business'
    order by s.created_at desc limit 1
  ) sl on true
  cross join params x
  where
    (x.country='' or lower(public.unaccent(coalesce(b.country,''))) like '%'||x.country||'%')
    and (x.city='' or lower(public.unaccent(coalesce(b.city,''))) like '%'||x.city||'%')
    and (
      x.kind not in ('product','service')
      or (x.kind='product' and exists (
        select 1 from public.products p
        where p.business_id=b.id and p.is_published=true
          and (x.q='' or lower(public.unaccent(coalesce(p.title,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(p.description,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(p.category,''))) like '%'||x.q||'%')
      ))
      or (x.kind='service' and exists (
        select 1 from public.marketplace_services ms
        where ms.seller_id=b.owner_id and ms.status='published'
          and (x.q='' or lower(public.unaccent(coalesce(ms.title,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(ms.description,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(ms.category,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(ms.delivery_mode,''))) like '%'||x.q||'%')
      ))
    )
    and (
      x.q=''
      or lower(public.unaccent(coalesce(b.name,''))) like '%'||x.q||'%'
      or lower(public.unaccent(coalesce(b.description,''))) like '%'||x.q||'%'
      or lower(public.unaccent(coalesce(b.presentation,''))) like '%'||x.q||'%'
      or lower(public.unaccent(coalesce(b.activity,''))) like '%'||x.q||'%'
      or lower(public.unaccent(coalesce(b.category,''))) like '%'||x.q||'%'
      or lower(public.unaccent(coalesce(b.country,''))) like '%'||x.q||'%'
      or lower(public.unaccent(coalesce(b.city,''))) like '%'||x.q||'%'
      or exists (
        select 1 from public.products p
        where p.business_id=b.id and p.is_published=true
          and (lower(public.unaccent(coalesce(p.title,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(p.description,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(p.category,''))) like '%'||x.q||'%')
      )
      or exists (
        select 1 from public.marketplace_services ms
        where ms.seller_id=b.owner_id and ms.status='published'
          and (lower(public.unaccent(coalesce(ms.title,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(ms.description,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(ms.category,''))) like '%'||x.q||'%' or lower(public.unaccent(coalesce(ms.delivery_mode,''))) like '%'||x.q||'%')
      )
    )
),
page as (
  select f.*,
    coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'business_id',p.business_id,'title',p.title,'description',p.description,'price',p.price,'currency',p.currency,'is_published',p.is_published,'created_at',p.created_at) order by p.created_at desc)
      from public.products p where p.business_id=f.id and p.is_published=true),'[]'::jsonb) products,
    coalesce((select jsonb_agg(jsonb_build_object('id',ms.id,'seller_id',ms.seller_id,'title',ms.title,'description',ms.description,'price',ms.price,'currency',ms.currency,'delivery_mode',ms.delivery_mode,'status',ms.status,'created_at',ms.created_at) order by ms.created_at desc)
      from public.marketplace_services ms where ms.seller_id=f.owner_id and ms.status='published'),'[]'::jsonb) services
  from filtered f
),
paged as (
  select p.* from page p
  order by p.created_at desc,p.id
  limit (select lim from params) offset (select off from params)
)
select jsonb_build_object(
  'count',(select count(*) from filtered),
  'results',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from paged p),'[]'::jsonb),
  'limit',(select lim from params),
  'offset',(select off from params)
);
$$;

revoke execute on function public.discover_public_businesses(text,text,text,text,integer,integer) from public;
grant execute on function public.discover_public_businesses(text,text,text,text,integer,integer) to anon, authenticated;
