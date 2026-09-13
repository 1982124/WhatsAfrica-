create or replace function public.verify_admin_email_otp(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  v_id uuid; v_hash text; v_attempts integer; v_expires timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.platform_admins where user_id=v_user) then raise exception 'ADMIN_REQUIRED'; end if;
  if v_session is null then raise exception 'SESSION_INVALID'; end if;
  select id,code_hash,attempts,expires_at into v_id,v_hash,v_attempts,v_expires
  from private.admin_email_challenges where user_id=v_user and session_id=v_session and used_at is null
  order by created_at desc limit 1 for update;
  if v_id is null then raise exception 'OTP_NOT_FOUND'; end if;
  if v_expires<=now() then raise exception 'OTP_EXPIRED'; end if;
  if v_attempts>=5 then raise exception 'OTP_LOCKED'; end if;
  if crypt(p_code,v_hash)<>v_hash then
    update private.admin_email_challenges set attempts=attempts+1 where id=v_id;
    insert into public.security_audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(v_user,'admin_email_otp_failed','admin_email_challenge',v_id::text,jsonb_build_object('attempts',v_attempts+1));
    raise exception 'OTP_INVALID';
  end if;
  update private.admin_email_challenges set used_at=now() where id=v_id;
  insert into private.admin_session_verifications(user_id,session_id,verified_at) values(v_user,v_session,now())
    on conflict(user_id,session_id) do update set verified_at=excluded.verified_at;
  insert into public.security_audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(v_user,'admin_email_otp_verified','admin_email_challenge',v_id::text,'{}'::jsonb);
  return jsonb_build_object('verified',true,'verified_until',now()+interval '12 hours');
end;
$$;
alter function public.verify_admin_email_otp(text) set search_path='public','pg_catalog';
revoke execute on function public.verify_admin_email_otp(text) from public,anon;
grant execute on function public.verify_admin_email_otp(text) to authenticated;