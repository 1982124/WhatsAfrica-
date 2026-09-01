-- Global admin metrics are served through the authenticated server endpoint, not PostgREST.
revoke execute on function public.platform_admin_overview() from public, anon, authenticated;
grant execute on function public.platform_admin_overview() to service_role;
