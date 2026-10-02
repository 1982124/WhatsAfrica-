begin;

alter table public.product_collections
  add column if not exists subtitle text,
  add column if not exists audience text,
  add column if not exists age_range text,
  add column if not exists language text,
  add column if not exists region text,
  add column if not exists category text,
  add column if not exists teaser_video_url text,
  add column if not exists presentation_video_url text,
  add column if not exists price numeric,
  add column if not exists currency text default 'XOF';

create table if not exists public.collection_media (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.product_collections(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('cover','gallery','teaser_video','presentation_video','audio')),
  media_url text not null,
  title text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists collection_media_collection_idx on public.collection_media(collection_id,sort_order,created_at);
alter table public.collection_media enable row level security;

drop policy if exists "collection_media_owner_manage" on public.collection_media;
create policy "collection_media_owner_manage" on public.collection_media for all to authenticated
using (exists (select 1 from public.product_collections pc join public.businesses b on b.id=pc.business_id where pc.id=collection_media.collection_id and b.owner_id=auth.uid() and collection_media.owner_id=auth.uid()))
with check (exists (select 1 from public.product_collections pc join public.businesses b on b.id=pc.business_id where pc.id=collection_media.collection_id and b.owner_id=auth.uid()) and collection_media.owner_id=auth.uid());

drop policy if exists "collection_media_public_read" on public.collection_media;
create policy "collection_media_public_read" on public.collection_media for select to anon,authenticated
using (exists (select 1 from public.product_collections pc where pc.id=collection_media.collection_id and pc.is_published=true));

commit;