create or replace function public.connect_payment_provider(
  p_provider text,
  p_country_code text,
  p_account_type text,
  p_secret text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $function$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
  v_connection_id uuid;
  v_provider text := lower(trim(coalesce(p_provider, '')));
  v_country text := lower(trim(coalesce(p_country_code, '')));
  v_account text := lower(trim(coalesce(p_account_type, '')));
  v_secret text := trim(coalesce(p_secret, ''));
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_provider <> 'moneyfusion' then
    raise exception 'provider_not_supported' using errcode = '22023';
  end if;
  if v_country !~ '^[a-z]{2}$' then
    raise exception 'invalid_country_code' using errcode = '22023';
  end if;
  if v_account not in ('mobile_money', 'bank', 'card', 'other') then
    raise exception 'invalid_account_type' using errcode = '22023';
  end if;
  if length(v_secret) < 12 or length(v_secret) > 2048
     or v_secret !~* '^https://([a-z0-9-]+\\.)*moneyfusion\\.net(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
    raise exception 'invalid_provider_api_url' using errcode = '22023';
  end if;

  v_secret_id := vault.create_secret(
    v_secret,
    'wassafrica-moneyfusion-' || v_uid::text || '-' || gen_random_uuid()::text,
    'Money Fusion API URL for WASSAFRICA user ' || v_uid::text
  );

  insert into public.payment_connections(
    user_id, provider, country_code, account_type, external_reference, status, metadata, updated_at
  ) values (
    v_uid, 'moneyfusion', v_country, v_account, v_secret_id::text, 'connected',
    jsonb_build_object('configured_by_user', true), now()
  )
  returning id into v_connection_id;

  return jsonb_build_object(
    'ok', true,
    'provider', 'moneyfusion',
    'status', 'connected',
    'connection_id', v_connection_id
  );
end;
$function$;

revoke all on function public.connect_payment_provider(text, text, text, text) from public;
revoke all on function public.connect_payment_provider(text, text, text, text) from anon;
grant execute on function public.connect_payment_provider(text, text, text, text) to authenticated;
