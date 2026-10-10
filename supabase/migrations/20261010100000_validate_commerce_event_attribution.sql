-- Validate public commerce-event attribution before writing analytics.
-- Public visitors may record real public Smart Link/product interactions, but
-- cannot assign arbitrary events to another business' analytics.
create or replace function public.track_commerce_event(
  p_event_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_business_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_type text := lower(trim(coalesce(p_event_type,'')));
  v_entity_type text := lower(trim(coalesce(p_entity_type,'')));
begin
  if length(v_type)<2 or length(v_type)>80 or v_type !~ '^[a-z0-9_]+$' then
    raise exception 'INVALID_EVENT_TYPE';
  end if;
  if jsonb_typeof(v_meta)<>'object' then
    raise exception 'INVALID_EVENT_METADATA';
  end if;
  if p_entity_type is not null and length(trim(p_entity_type))>80 then
    raise exception 'INVALID_ENTITY_TYPE';
  end if;

  if p_business_id is not null and not (
    (v_entity_type = 'smart_link' and exists (
      select 1 from public.smart_links sl
      where sl.id = p_entity_id
        and sl.business_id = p_business_id
        and sl.is_public = true
    ))
    or (v_entity_type = 'product' and exists (
      select 1 from public.products pr
      where pr.id = p_entity_id
        and pr.business_id = p_business_id
    ))
    or (v_entity_type = 'business' and p_entity_id = p_business_id and exists (
      select 1 from public.businesses b where b.id = p_business_id
    ))
    or (v_uid is not null and (
      exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = v_uid)
      or exists (select 1 from public.business_members bm where bm.business_id = p_business_id and bm.user_id = v_uid)
    ))
  ) then
    raise exception 'INVALID_BUSINESS_ATTRIBUTION';
  end if;

  v_meta := jsonb_build_object(
    'source',coalesce(v_meta->>'source','wassafrica'),
    'session_id',v_meta->>'session_id',
    'smart_link_id',v_meta->>'smart_link_id',
    'product_id',v_meta->>'product_id',
    'conversation_id',v_meta->>'conversation_id',
    'campaign_id',v_meta->>'campaign_id',
    'referrer',v_meta->>'referrer',
    'path',v_meta->>'path'
  ) || (v_meta - array['source','session_id','smart_link_id','product_id','conversation_id','campaign_id','referrer','path']);

  insert into public.analytics_events(user_id,business_id,event_type,entity_type,entity_id,metadata)
  values(v_uid,p_business_id,v_type,nullif(trim(p_entity_type),''),p_entity_id,v_meta)
  returning id into v_id;
  return v_id;
end
$function$;

-- Preserve the current intended grants: anonymous tracking is still needed by
-- public Smart Links; authenticated direct calls remain revoked.
revoke execute on function public.track_commerce_event(text,text,uuid,uuid,jsonb) from authenticated;
