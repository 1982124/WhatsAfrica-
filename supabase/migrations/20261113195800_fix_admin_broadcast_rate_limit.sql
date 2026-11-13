-- Make the one-broadcast-per-minute guard atomic and durable.
-- Return a structured rate-limit result instead of raising after incrementing:
-- an exception would roll back the counter update with the surrounding transaction.
create or replace function private.publish_platform_broadcast(p_title text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
  v_delivered integer;
  v_key text := 'platform:broadcast:' || (select auth.uid())::text;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid())
  ) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if not private.admin_email_mfa_valid() then
    raise exception 'EMAIL_MFA_REQUIRED';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2
     or length(trim(coalesce(p_body, ''))) < 2 then
    raise exception 'BROADCAST_CONTENT_INVALID';
  end if;

  insert into public.api_rate_limits(key, window_started_at, request_count, updated_at)
  values (v_key, now(), 1, now())
  on conflict (key) do update
  set request_count = case
        when public.api_rate_limits.window_started_at <= now() - interval '1 minute' then 1
        else public.api_rate_limits.request_count + 1
      end,
      window_started_at = case
        when public.api_rate_limits.window_started_at <= now() - interval '1 minute' then now()
        else public.api_rate_limits.window_started_at
      end,
      updated_at = now()
  returning request_count into v_count;

  if v_count > 1 then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;

  insert into public.platform_broadcasts(created_by, title, body)
  values ((select auth.uid()), trim(p_title), trim(p_body))
  returning id into v_id;

  insert into public.notifications(user_id, type, title, body, created_at)
  select p.user_id, 'platform_broadcast', trim(p_title), trim(p_body), now()
  from public.profiles p
  where p.user_id is not null;
  get diagnostics v_delivered = row_count;

  return jsonb_build_object(
    'ok', true,
    'broadcast_id', v_id,
    'delivered', v_delivered
  );
end;
$$;
