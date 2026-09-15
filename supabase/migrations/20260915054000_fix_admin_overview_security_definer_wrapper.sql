create or replace function public.platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then raise exception 'forbidden'; end if;
  if not private.admin_email_mfa_valid() then raise exception 'email_mfa_required'; end if;
  return private.platform_admin_overview_impl();
end;
$$;
revoke execute on function public.platform_admin_overview() from public, anon;
grant execute on function public.platform_admin_overview() to authenticated;

alter function private.platform_admin_overview_impl() set search_path = public, private, pg_temp;
alter function private.admin_email_mfa_valid() set search_path = pg_catalog;
