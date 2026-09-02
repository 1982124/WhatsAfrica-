-- WhatsAfrica: harden privileged database functions.
-- SECURITY DEFINER is retained only where it is required to cross protected RLS boundaries.

CREATE OR REPLACE FUNCTION private.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
declare v_count integer;
begin
  if p_key is null or length(p_key)=0 or p_limit<1 or p_window_seconds<1 then return false; end if;
  insert into public.api_rate_limits(key,window_started_at,request_count,updated_at)
  values(p_key,now(),1,now())
  on conflict(key) do update set
    request_count=case when public.api_rate_limits.window_started_at <= now() - make_interval(secs=>p_window_seconds) then 1 else public.api_rate_limits.request_count+1 end,
    window_started_at=case when public.api_rate_limits.window_started_at <= now() - make_interval(secs=>p_window_seconds) then now() else public.api_rate_limits.window_started_at end,
    updated_at=now()
  returning request_count into v_count;
  return v_count <= p_limit;
end
$$;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  select private.consume_rate_limit(p_key, p_limit, p_window_seconds);
$$;

CREATE OR REPLACE FUNCTION public.accept_group_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
declare inv public.group_invitations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into inv from public.group_invitations
  where token=trim(p_token) and status='pending' for update;
  if not found then raise exception 'INVITATION_INVALID'; end if;
  insert into public.group_members(group_id,user_id,role)
  values(inv.group_id,auth.uid(),'member')
  on conflict (group_id,user_id) do nothing;
  update public.group_invitations
  set status='accepted',accepted_by=auth.uid(),accepted_at=now()
  where id=inv.id;
  return jsonb_build_object('group_id',inv.group_id,'status','accepted');
end
$$;

REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;
