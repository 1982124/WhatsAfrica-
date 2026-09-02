create table if not exists public.product_collections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  cover_url text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.product_collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);

create table if not exists public.business_collaborators (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager','editor','analyst')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists idx_product_collections_business_order on public.product_collections(business_id, sort_order, created_at desc);
create index if not exists idx_collection_items_product on public.collection_items(product_id);
create index if not exists idx_business_collaborators_business on public.business_collaborators(business_id, status, role);
create index if not exists idx_business_collaborators_user on public.business_collaborators(user_id, status);

alter table public.product_collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.business_collaborators enable row level security;

create policy "collections_public_published_read" on public.product_collections for select to public using (is_published = true);
create policy "collections_owner_manage" on public.product_collections for all to authenticated using ((select auth.uid()) = (select b.owner_id from public.businesses b where b.id = product_collections.business_id)) with check ((select auth.uid()) = (select b.owner_id from public.businesses b where b.id = product_collections.business_id));
create policy "collections_collaborator_read" on public.product_collections for select to authenticated using (exists (select 1 from public.business_collaborators bc where bc.business_id = product_collections.business_id and bc.user_id = (select auth.uid()) and bc.status = 'active'));
create policy "collections_editor_manage" on public.product_collections for all to authenticated using (exists (select 1 from public.business_collaborators bc where bc.business_id = product_collections.business_id and bc.user_id = (select auth.uid()) and bc.status = 'active' and bc.role in ('manager','editor'))) with check (exists (select 1 from public.business_collaborators bc where bc.business_id = product_collections.business_id and bc.user_id = (select auth.uid()) and bc.status = 'active' and bc.role in ('manager','editor')));

create policy "collection_items_public_published_read" on public.collection_items for select to public using (exists (select 1 from public.product_collections pc join public.products p on p.id = collection_items.product_id where pc.id = collection_items.collection_id and pc.is_published = true and p.is_published = true));
create policy "collection_items_owner_manage" on public.collection_items for all to authenticated using (exists (select 1 from public.product_collections pc join public.businesses b on b.id = pc.business_id where pc.id = collection_items.collection_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.product_collections pc join public.products p on p.id = collection_items.product_id join public.businesses b on b.id = pc.business_id where pc.id = collection_items.collection_id and p.business_id = pc.business_id and b.owner_id = (select auth.uid())));
create policy "collection_items_editor_manage" on public.collection_items for all to authenticated using (exists (select 1 from public.product_collections pc join public.business_collaborators bc on bc.business_id = pc.business_id where pc.id = collection_items.collection_id and bc.user_id = (select auth.uid()) and bc.status = 'active' and bc.role in ('manager','editor'))) with check (exists (select 1 from public.product_collections pc join public.products p on p.id = collection_items.product_id join public.business_collaborators bc on bc.business_id = pc.business_id where pc.id = collection_items.collection_id and p.business_id = pc.business_id and bc.user_id = (select auth.uid()) and bc.status = 'active' and bc.role in ('manager','editor')));

create policy "business_collaborators_self_or_owner_read" on public.business_collaborators for select to authenticated using ((select auth.uid()) = user_id or exists (select 1 from public.businesses b where b.id = business_collaborators.business_id and b.owner_id = (select auth.uid())));
create policy "business_owner_manage_collaborators" on public.business_collaborators for all to authenticated using (exists (select 1 from public.businesses b where b.id = business_collaborators.business_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id = business_collaborators.business_id and b.owner_id = (select auth.uid())) and user_id <> (select auth.uid()));

comment on table public.business_collaborators is 'Business RBAC. Collaborators can operate commerce surfaces according to role; financial withdrawal is intentionally not granted by this table.';
comment on column public.business_collaborators.role is 'manager/editor/analyst; none grants withdrawal authority.';
