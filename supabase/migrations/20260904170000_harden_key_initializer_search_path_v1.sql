-- WhatsAfrica CTO security hardening
-- SECURITY DEFINER wrapper must not inherit a mutable search_path.
create or replace function public.claim_conversation_key_initializer(
  p_conversation_id uuid,
  p_key_version integer,
  p_device_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_conversation_id is null or p_device_id is null or p_key_version is null or p_key_version < 1 then
    raise exception 'INVALID_KEY_VERSION';
  end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id=p_conversation_id and user_id=auth.uid()
  ) then raise exception 'NOT_CONVERSATION_MEMBER'; end if;
  if not exists (
    select 1 from public.user_devices
    where id=p_device_id and user_id=auth.uid() and revoked_at is null
  ) then raise exception 'INVALID_DEVICE'; end if;
  perform 1 from public.conversations where id=p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  select exists(
    select 1 from public.conversation_key_envelopes
    where conversation_id=p_conversation_id
      and key_version=p_key_version
      and revoked_at is null
  ) into v_existing;
  if v_existing then return false; end if;
  return true;
end;
$$;

revoke execute on function public.claim_conversation_key_initializer(uuid,integer,uuid) from anon;
grant execute on function public.claim_conversation_key_initializer(uuid,integer,uuid) to authenticated;
