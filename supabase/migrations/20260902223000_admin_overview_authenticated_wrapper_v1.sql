create or replace function private.platform_admin_overview_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'users',(select count(*) from auth.users),
    'businesses',(select count(*) from public.businesses),
    'products',(select count(*) from public.products),
    'groups',(select count(*) from public.groups),
    'messages',(select count(*) from public.messages_v2),
    'orders',(select count(*) from public.orders),
    'reports',(select count(*) from public.reports),
    'live_sessions',(select count(*) from public.business_live_sessions),
    'open_reports',(select count(*) from public.reports)
  ) into result;
  return result;
end;
$$;
revoke all on function private.platform_admin_overview_impl() from public, anon, authenticated;

drop function if exists public.platform_admin_overview();
create function public.platform_admin_overview()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select private.platform_admin_overview_impl();
$$;
revoke execute on function public.platform_admin_overview() from public, anon;
grant execute on function public.platform_admin_overview() to authenticated;
