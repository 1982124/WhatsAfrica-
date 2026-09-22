-- Hardened digital delivery endpoint support.
-- The function is intentionally callable only by service_role; the Vercel API
-- verifies the user's Supabase session before invoking it.
create or replace function public.consume_digital_entitlement(p_entitlement_id uuid, p_user_id uuid)
returns table (
  product_id uuid,
  digital_storage_path text,
  digital_file_name text,
  digital_mime_type text,
  reading_mode text,
  downloads_count integer,
  max_downloads integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  update public.digital_entitlements e
     set downloads_count = e.downloads_count + 1,
         first_downloaded_at = coalesce(e.first_downloaded_at, now()),
         last_downloaded_at = now(),
         updated_at = now()
   where e.id = p_entitlement_id
     and e.buyer_user_id = p_user_id
     and e.status = 'active'
     and (e.expires_at is null or e.expires_at > now())
     and (e.max_downloads is null or e.downloads_count < e.max_downloads)
  returning e.product_id,
            (select p.digital_storage_path from public.products p where p.id=e.product_id and p.product_type='digital'),
            (select p.digital_file_name from public.products p where p.id=e.product_id and p.product_type='digital'),
            (select p.digital_mime_type from public.products p where p.id=e.product_id and p.product_type='digital'),
            (select p.reading_mode from public.products p where p.id=e.product_id and p.product_type='digital'),
            e.downloads_count,
            e.max_downloads;
end;
$$;
revoke all on function public.consume_digital_entitlement(uuid,uuid) from public, anon, authenticated;
grant execute on function public.consume_digital_entitlement(uuid,uuid) to service_role;
