-- WASSAFRICA: persist Smart Link events in the commercial event spine.
-- Root cause fixed: track_smart_link_event previously wrote analytics_events only.

create or replace function public.track_smart_link_event(
  p_smart_link_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_analytics_id uuid;
  v_business uuid;
  v_meta jsonb := coalesce(p_metadata,'{}'::jsonb);
  v_session text;
  v_visitor_hash text;
begin
  select business_id into v_business
  from public.smart_links
  where id=p_smart_link_id and is_public=true;

  if v_business is null then
    raise exception 'SMART_LINK_NOT_PUBLIC';
  end if;

  select public.track_commerce_event(
    p_event_type,
    'smart_link',
    p_smart_link_id,
    v_business,
    v_meta || jsonb_build_object('smart_link_id',p_smart_link_id)
  ) into v_analytics_id;

  v_session := nullif(trim(v_meta->>'session_id'),'');
  v_visitor_hash := case
    when v_session is null then null
    else encode(extensions.digest(v_session,'sha256'),'hex')
  end;

  insert into public.smart_link_events(
    smart_link_id,event_type,visitor_hash,metadata
  )
  values(
    p_smart_link_id,
    lower(trim(p_event_type)),
    v_visitor_hash,
    v_meta || jsonb_build_object('smart_link_id',p_smart_link_id)
  )
  returning id into v_id;

  return v_id;
end
$function$;

revoke execute on function public.track_smart_link_event(uuid,text,jsonb) from public;
grant execute on function public.track_smart_link_event(uuid,text,jsonb) to anon, authenticated, service_role;
