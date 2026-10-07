create or replace function private.validate_published_product() returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.is_published = true and new.product_type = 'digital' then
    if nullif(btrim(new.digital_storage_path), '') is null then raise exception 'digital_product_file_required'; end if;
    if nullif(btrim(new.digital_file_name), '') is null then raise exception 'digital_product_file_name_required'; end if;
    if nullif(btrim(new.digital_mime_type), '') is null then raise exception 'digital_product_mime_required'; end if;
    if coalesce(new.digital_max_downloads, 0) < 1 then raise exception 'digital_product_download_limit_required'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_published_product on public.products;
create trigger trg_validate_published_product
before insert or update of is_published, product_type, digital_storage_path, digital_file_name, digital_mime_type, digital_max_downloads
on public.products for each row execute function private.validate_published_product();

update storage.buckets set public = false where id = 'digital-products';

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='digital_products_owner_insert') then
    create policy digital_products_owner_insert on storage.objects for insert to authenticated
    with check (bucket_id='digital-products' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='digital_products_owner_delete') then
    create policy digital_products_owner_delete on storage.objects for delete to authenticated
    using (bucket_id='digital-products' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;