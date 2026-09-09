create or replace function private.platform_admin_overview_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog'
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then raise exception 'forbidden'; end if;
  if not private.admin_email_mfa_valid() then raise exception 'email_mfa_required'; end if;

  select jsonb_build_object(
    'users',(select count(*) from auth.users),
    'identities',(select count(*) from public.whatsafrica_identities),
    'businesses',(select count(*) from public.businesses),
    'smart_links',(select count(*) from public.smart_links),
    'starter_active',(select count(*) from public.user_subscriptions where status='active' and plan_code='starter' and (ends_at is null or ends_at>now())),
    'products',(select count(*) from public.products),
    'published_products',(select count(*) from public.products where is_published=true),
    'services',(select count(*) from public.marketplace_services),
    'published_services',(select count(*) from public.marketplace_services where status='published'),
    'collections',(select count(*) from public.product_collections),
    'published_collections',(select count(*) from public.product_collections where is_published=true),
    'external_payment_links',(select count(*) from public.external_payment_links where is_active=true),
    'groups',(select count(*) from public.groups),
    'messages',(select count(*) from public.messages_v2),
    'orders',(select count(*) from public.orders),
    'reports',(select count(*) from public.reports),
    'open_reports',(select count(*) from public.reports),
    'live_sessions',(select count(*) from public.business_live_sessions),
    'ai_events',(select count(*) from public.analytics_events where lower(coalesce(event_name,'')) like '%ai%' or lower(coalesce(event_name,'')) like '%assistant%')
  ) into result;
  return result;
end;
$function$;
