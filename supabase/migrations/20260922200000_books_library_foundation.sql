begin;

create table if not exists public.product_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.product_collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, product_id)
);

create index if not exists product_collection_items_collection_idx on public.product_collection_items(collection_id, sort_order, created_at);
create index if not exists product_collection_items_product_idx on public.product_collection_items(product_id);

alter table public.products add column if not exists content_kind text;
alter table public.products add column if not exists author_name text;
alter table public.products add column if not exists isbn text;
alter table public.products add column if not exists publisher text;
alter table public.products add column if not exists publication_date date;
alter table public.products add column if not exists language text;
alter table public.products add column if not exists page_count integer;
alter table public.products add column if not exists edition text;
alter table public.products add column if not exists reading_mode text;
alter table public.products add column if not exists preview_url text;

update public.products set content_kind='other' where product_type='digital' and content_kind is null;

alter table public.products drop constraint if exists products_content_kind_check;
alter table public.products add constraint products_content_kind_check check (content_kind is null or content_kind in ('book','course','document','audio','video','other'));
alter table public.products drop constraint if exists products_reading_mode_check;
alter table public.products add constraint products_reading_mode_check check (reading_mode is null or reading_mode in ('download','reader','download_and_reader'));
alter table public.products drop constraint if exists products_page_count_check;
alter table public.products add constraint products_page_count_check check (page_count is null or page_count >= 0);
alter table public.products drop constraint if exists products_book_metadata_check;
alter table public.products add constraint products_book_metadata_check check (product_type <> 'digital' or content_kind <> 'book' or length(trim(title)) > 0);

alter table public.product_collection_items enable row level security;

drop policy if exists collection_items_public_read on public.product_collection_items;
create policy collection_items_public_read on public.product_collection_items for select to anon, authenticated using (
  exists (
    select 1 from public.product_collections c
    join public.products p on p.id=product_collection_items.product_id
    where c.id=product_collection_items.collection_id and c.is_published=true and p.is_published=true and p.product_type='digital'
  )
);

drop policy if exists collection_items_owner_insert on public.product_collection_items;
create policy collection_items_owner_insert on public.product_collection_items for insert to authenticated with check (
  exists (
    select 1 from public.product_collections c join public.businesses b on b.id=c.business_id
    where c.id=product_collection_items.collection_id
      and (b.owner_id=auth.uid() or exists (
        select 1 from public.business_collaborators bc where bc.business_id=b.id and bc.user_id=auth.uid() and bc.status='active' and bc.role in ('manager','editor')
      ))
  )
  and exists (
    select 1 from public.products p join public.product_collections c on c.business_id=p.business_id
    where p.id=product_collection_items.product_id and c.id=product_collection_items.collection_id and p.product_type='digital'
  )
);

drop policy if exists collection_items_owner_update on public.product_collection_items;
create policy collection_items_owner_update on public.product_collection_items for update to authenticated
using (exists (select 1 from public.product_collections c join public.businesses b on b.id=c.business_id where c.id=product_collection_items.collection_id and (b.owner_id=auth.uid() or exists (select 1 from public.business_collaborators bc where bc.business_id=b.id and bc.user_id=auth.uid() and bc.status='active' and bc.role in ('manager','editor')))))
with check (exists (select 1 from public.product_collections c join public.businesses b on b.id=c.business_id where c.id=product_collection_items.collection_id and (b.owner_id=auth.uid() or exists (select 1 from public.business_collaborators bc where bc.business_id=b.id and bc.user_id=auth.uid() and bc.status='active' and bc.role in ('manager','editor')))));

drop policy if exists collection_items_owner_delete on public.product_collection_items;
create policy collection_items_owner_delete on public.product_collection_items for delete to authenticated
using (exists (select 1 from public.product_collections c join public.businesses b on b.id=c.business_id where c.id=product_collection_items.collection_id and (b.owner_id=auth.uid() or exists (select 1 from public.business_collaborators bc where bc.business_id=b.id and bc.user_id=auth.uid() and bc.status='active' and bc.role in ('manager','editor')))));

commit;