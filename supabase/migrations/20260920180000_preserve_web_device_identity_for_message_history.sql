-- Preserve Web device identity across session/device re-registration.
-- This keeps historical conversation-key envelopes reachable when the same
-- browser identity key is presented again after an earlier revocation.
create or replace function public.ensure_web_device(p_identity_public_key jsonb)
returns table(id uuid, identity_public_key jsonb)
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  uid uuid := auth.uid();
  existing_id uuid;
  existing_key jsonb;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_identity_public_key is null then raise exception 'INVALID_IDENTITY_KEY'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));

  select d.id,d.identity_public_key
    into existing_id,existing_key
  from public.user_devices d
  where d.user_id=uid
    and d.device_label='Web'
    and d.identity_public_key = p_identity_public_key
  order by d.revoked_at nulls first, d.last_seen_at desc nulls last, d.created_at desc
  limit 1
  for update;

  if existing_id is not null then
    update public.user_devices
      set revoked_at=null,
          last_seen_at=now()
    where user_devices.id=existing_id;
    return query select existing_id,existing_key;
    return;
  end if;

  select d.id,d.identity_public_key
    into existing_id,existing_key
  from public.user_devices d
  where d.user_id=uid
    and d.device_label='Web'
    and d.revoked_at is null
  order by d.last_seen_at desc nulls last
  limit 1
  for update;

  if existing_id is not null then
    update public.user_devices
      set revoked_at=now()
    where user_devices.id=existing_id
      and revoked_at is null;
  end if;

  return query
    insert into public.user_devices(user_id,device_label,identity_public_key,last_seen_at)
    values(uid,'Web',p_identity_public_key,now())
    returning user_devices.id,user_devices.identity_public_key;
end;
$function$;
