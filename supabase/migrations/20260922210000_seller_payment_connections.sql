-- Seller payment connection hardening.
-- Provider credentials are stored in Supabase Vault; public/client tables only keep
-- a reference and connection state. Only authenticated users can create their own
-- pending Money Fusion connection.
create schema if not exists private;
create or replace function private.connect_payment_provider(
  p_provider text,
  p_country_code text,
  p_account_type text,
  p_secret text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_secret_id uuid;
  v_name text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if lower(trim(p_provider)) <> 'moneyfusion' then raise exception 'provider_not_supported'; end if;
  if p_account_type not in ('mobile_money','bank','card','other') then raise exception 'invalid_account_type'; end if;
  if p_secret is null or length(trim(p_secret)) < 8 then raise exception 'credential_required'; end if;
  v_name := 'wassafrica_' || lower(trim(p_provider)) || '_' || replace(v_user::text,'-','');
  v_secret_id := vault.create_secret(trim(p_secret), v_name, 'WASSAFRICA payment credential for user ' || v_user::text);
  insert into public.payment_connections(user_id,provider,country_code,account_type,external_reference,status,metadata)
  values(v_user,lower(trim(p_provider)),lower(trim(p_country_code)),p_account_type,v_secret_id::text,'pending',
         jsonb_build_object('credential_storage','supabase_vault','setup_version',1))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.connect_payment_provider(text,text,text,text) from public, anon, authenticated;
grant execute on function private.connect_payment_provider(text,text,text,text) to authenticated;
