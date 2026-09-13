create schema if not exists private;

create table if not exists private.trial_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid, claimed_at timestamptz not null default now(), trial_ends_at timestamptz,
  name_hash text, email_hash text, phone_hash text, device_hash text, ip_hash text,
  source text not null default 'signup', metadata jsonb not null default '{}'::jsonb
);
create index if not exists trial_ledger_email_hash_idx on private.trial_ledger(email_hash) where email_hash is not null;
create index if not exists trial_ledger_phone_hash_idx on private.trial_ledger(phone_hash) where phone_hash is not null;
create index if not exists trial_ledger_device_hash_idx on private.trial_ledger(device_hash) where device_hash is not null;
create index if not exists trial_ledger_ip_hash_idx on private.trial_ledger(ip_hash) where ip_hash is not null;

create table if not exists private.discount_codes (
  id uuid primary key default gen_random_uuid(), code text not null unique, discount_percent integer, discount_amount_xof integer,
  max_redemptions integer, redeemed_count integer not null default 0, valid_from timestamptz not null default now(), valid_until timestamptz,
  active boolean not null default true, created_by uuid not null, created_at timestamptz not null default now(),
  check ((discount_percent is not null and discount_amount_xof is null) or (discount_percent is null and discount_amount_xof is not null)),
  check (discount_percent is null or discount_percent between 1 and 100), check (discount_amount_xof is null or discount_amount_xof > 0),
  check (max_redemptions is null or max_redemptions > 0)
);
create table if not exists private.discount_redemptions (
  id uuid primary key default gen_random_uuid(), code_id uuid not null references private.discount_codes(id), user_id uuid not null,
  redeemed_at timestamptz not null default now(), unique(code_id,user_id)
);
create table if not exists private.admin_session_verifications (
  user_id uuid not null, session_id uuid not null, verified_at timestamptz not null default now(), primary key(user_id,session_id)
);

alter table public.profiles add column if not exists trial_device_hash text;
alter table public.profiles add column if not exists trial_ip_hash text;
create unique index if not exists user_subscriptions_admin_free_unique on public.user_subscriptions(user_id)
  where provider='admin' and plan_code='free' and status='active' and ends_at is null;

create or replace function private.norm_trial_signal(p text) returns text language sql immutable strict security invoker set search_path='' as $$
  select lower(regexp_replace(trim(p),'\\s+',' ','g')) $$;
create or replace function private.sha256_trial_signal(p text) returns text language sql immutable strict security invoker set search_path='' as $$
  select encode(extensions.digest(private.norm_trial_signal(p),'sha256'),'hex') $$;
create or replace function private.is_trial_claimed(p_email_hash text,p_phone_hash text,p_name_hash text,p_device_hash text,p_ip_hash text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.trial_ledger t where
    (p_phone_hash is not null and t.phone_hash=p_phone_hash) or
    (p_email_hash is not null and t.email_hash=p_email_hash) or
    (p_device_hash is not null and t.device_hash=p_device_hash and p_ip_hash is not null and t.ip_hash=p_ip_hash) or
    (p_device_hash is not null and t.device_hash=p_device_hash and p_name_hash is not null and t.name_hash=p_name_hash)); $$;

create or replace function private.enforce_trial_ledger()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_email text; v_phone text; v_name text; v_email_hash text; v_phone_hash text; v_name_hash text; v_device_hash text; v_ip_hash text;
  v_uid uuid:=coalesce(new.user_id,new.id); v_headers jsonb:='{}'::jsonb; v_ua text; v_ip text;
begin
  if new.trial_ends_at is null then return new; end if;
  if new.trial_ends_at <= coalesce(old.trial_ends_at,'-infinity'::timestamptz) then return new; end if;
  if new.trial_ends_at > now()+interval '30 days' then raise exception 'TRIAL_DURATION_INVALID'; end if;
  begin v_headers:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then v_headers:='{}'::jsonb; end;
  v_ua:=coalesce(v_headers->>'user-agent',v_headers->>'sec-ch-ua');
  v_ip:=coalesce(v_headers->>'x-forwarded-for',v_headers->>'x-real-ip');
  select u.email,u.phone,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),nullif(new.display_name,''),concat_ws(' ',nullif(new.first_name,''),nullif(new.last_name,'')))
    into v_email,v_phone,v_name from auth.users u where u.id=v_uid;
  v_email_hash:=case when v_email is not null then private.sha256_trial_signal(v_email) end;
  v_phone_hash:=case when v_phone is not null and exists(select 1 from auth.users u where u.id=v_uid and u.phone_confirmed_at is not null) then private.sha256_trial_signal(v_phone) end;
  v_name_hash:=case when v_name is not null and trim(v_name)<>'' then private.sha256_trial_signal(v_name) end;
  v_device_hash:=coalesce(nullif(new.trial_device_hash,''),case when v_ua is not null then private.sha256_trial_signal(v_ua) end);
  v_ip_hash:=coalesce(nullif(new.trial_ip_hash,''),case when v_ip is not null then private.sha256_trial_signal(split_part(v_ip,',',1)) end);
  if private.is_trial_claimed(v_email_hash,v_phone_hash,v_name_hash,v_device_hash,v_ip_hash) then raise exception 'TRIAL_ALREADY_USED'; end if;
  new.trial_device_hash:=v_device_hash; new.trial_ip_hash:=v_ip_hash;
  insert into private.trial_ledger(user_id,trial_ends_at,name_hash,email_hash,phone_hash,device_hash,ip_hash,source)
  values(v_uid,new.trial_ends_at,v_name_hash,v_email_hash,v_phone_hash,v_device_hash,v_ip_hash,'profile_trial');
  return new;
end; $$;
alter function private.enforce_trial_ledger() set search_path='';
drop trigger if exists trg_profiles_trial_ledger on public.profiles;
create trigger trg_profiles_trial_ledger before insert or update of trial_ends_at,trial_device_hash,trial_ip_hash on public.profiles
for each row execute function private.enforce_trial_ledger();

create or replace function private.admin_mfa_ok() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.admin_session_verifications where user_id=auth.uid() and session_id=nullif(auth.jwt()->>'session_id','')::uuid and verified_at>now()-interval '12 hours') $$;

create or replace function public.claim_trial(p_trial_ends_at timestamptz,p_device_hash text default null,p_ip_hash text default null)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_uid uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_trial_ends_at is null or p_trial_ends_at<=now() or p_trial_ends_at>now()+interval '30 days' then raise exception 'TRIAL_DURATION_INVALID'; end if;
  select * into v_profile from public.profiles where user_id=v_uid for update;
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if exists(select 1 from private.trial_ledger where user_id=v_uid) or v_profile.trial_ends_at is not null then raise exception 'TRIAL_ALREADY_USED'; end if;
  update public.profiles set trial_device_hash=nullif(p_device_hash,''),trial_ip_hash=nullif(p_ip_hash,''),trial_ends_at=p_trial_ends_at where user_id=v_uid;
  return jsonb_build_object('granted',true,'trial_ends_at',p_trial_ends_at);
end; $$;

create or replace function public.admin_search_users(p_query text)
returns table(user_id uuid,display_name text,email text,phone text) language plpgsql security definer set search_path='' as $$
declare q text:=lower(trim(coalesce(p_query,'')));
begin
  if not public.is_platform_admin() or not private.admin_mfa_ok() then raise exception 'ADMIN_MFA_REQUIRED'; end if;
  if q='' then return; end if;
  return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name','')),u.email,u.phone
  from auth.users u where lower(coalesce(u.email,'')) like '%'||q||'%' or lower(coalesce(u.phone,'')) like '%'||q||'%' or lower(coalesce(u.raw_user_meta_data->>'display_name','')) like '%'||q||'%' or lower(coalesce(u.raw_user_meta_data->>'full_name','')) like '%'||q||'%' or lower(coalesce(u.raw_user_meta_data->>'name','')) like '%'||q||'%' order by u.created_at desc limit 20;
end; $$;

create or replace function public.admin_grant_permanent_free(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
begin
  if not public.is_platform_admin() or not private.admin_mfa_ok() then raise exception 'ADMIN_MFA_REQUIRED'; end if;
  insert into public.user_subscriptions(user_id,plan_code,status,started_at,ends_at,provider,provider_reference) values(p_user_id,'free','active',now(),null,'admin','admin_free')
  on conflict(user_id) where provider='admin' and plan_code='free' and status='active' and ends_at is null do nothing;
  insert into public.security_audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'admin_grant_permanent_free','user',p_user_id::text,jsonb_build_object('plan','free','permanent',true));
  return jsonb_build_object('granted',true,'user_id',p_user_id,'plan','free','permanent',true);
end; $$;

create or replace function public.admin_create_discount_code(p_code text,p_discount_percent integer default null,p_discount_amount_xof integer default null,p_max_redemptions integer default null,p_valid_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_id uuid; v_code text:=upper(regexp_replace(trim(p_code),'\\s+','','g'));
begin
  if not public.is_platform_admin() or not private.admin_mfa_ok() then raise exception 'ADMIN_MFA_REQUIRED'; end if;
  if (p_discount_percent is null)=(p_discount_amount_xof is null) then raise exception 'ONE_DISCOUNT_TYPE_REQUIRED'; end if;
  insert into private.discount_codes(code,discount_percent,discount_amount_xof,max_redemptions,valid_until,created_by) values(v_code,p_discount_percent,p_discount_amount_xof,p_max_redemptions,p_valid_until,auth.uid()) returning id into v_id;
  return jsonb_build_object('created',true,'code',v_code,'id',v_id);
end; $$;

create or replace function public.redeem_discount_code(p_code text) returns jsonb language plpgsql security definer set search_path='public','pg_catalog' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_percent integer; v_amount integer; v_max integer; v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select id,discount_percent,discount_amount_xof,max_redemptions,redeemed_count into v_id,v_percent,v_amount,v_max,v_count from private.discount_codes where code=upper(regexp_replace(trim(p_code),'\\s+','','g')) and active and valid_from<=now() and (valid_until is null or valid_until>now()) for update;
  if v_id is null then raise exception 'DISCOUNT_CODE_INVALID'; end if;
  if v_max is not null and v_count>=v_max then raise exception 'DISCOUNT_CODE_EXHAUSTED'; end if;
  if exists(select 1 from private.discount_redemptions where code_id=v_id and user_id=v_uid) then raise exception 'DISCOUNT_ALREADY_REDEEMED'; end if;
  insert into private.discount_redemptions(code_id,user_id) values(v_id,v_uid); update private.discount_codes set redeemed_count=redeemed_count+1 where id=v_id;
  return jsonb_build_object('valid',true,'discount_percent',v_percent,'discount_amount_xof',v_amount);
end; $$;

revoke all on table private.trial_ledger,private.discount_codes,private.discount_redemptions,private.admin_session_verifications from anon,authenticated;
revoke execute on function public.claim_trial(timestamptz,text,text) from public,anon;
revoke execute on function public.admin_search_users(text) from public,anon;
revoke execute on function public.admin_grant_permanent_free(uuid) from public,anon;
revoke execute on function public.admin_create_discount_code(text,integer,integer,integer,timestamptz) from public,anon;
revoke execute on function public.redeem_discount_code(text) from public,anon;
grant execute on function public.claim_trial(timestamptz,text,text) to authenticated;
grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_grant_permanent_free(uuid) to authenticated;
grant execute on function public.admin_create_discount_code(text,integer,integer,integer,timestamptz) to authenticated;
grant execute on function public.redeem_discount_code(text) to authenticated;

-- The existing admin OTP verifier must also record a verified session in private.admin_session_verifications.
-- This migration intentionally leaves the established MFA flow and public guest SECURITY DEFINER functions unchanged.
