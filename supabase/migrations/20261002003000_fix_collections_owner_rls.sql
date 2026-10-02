begin;

-- The owner policy previously depended directly on businesses RLS.
-- If the owner cannot SELECT that row through businesses RLS, the INSERT
-- check evaluates to false even though the authenticated user is the owner.
-- This narrowly scoped SECURITY DEFINER helper evaluates ownership server-side.

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog, auth
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated;

drop policy if exists "collections_owner_manage" on public.product_collections;
create policy "collections_owner_manage"
on public.product_collections
for all
to authenticated
using (public.is_business_owner(product_collections.business_id))
with check (public.is_business_owner(product_collections.business_id));

drop policy if exists "collection_items_owner_manage" on public.collection_items;
create policy "collection_items_owner_manage"
on public.collection_items
for all
to authenticated
using (
  exists (
    select 1
    from public.product_collections pc
    where pc.id = collection_items.collection_id
      and public.is_business_owner(pc.business_id)
  )
)
with check (
  exists (
    select 1
    from public.product_collections pc
    join public.products p on p.id = collection_items.product_id
    where pc.id = collection_items.collection_id
      and p.business_id = pc.business_id
      and public.is_business_owner(pc.business_id)
  )
);

comment on function public.is_business_owner(uuid)
is 'Returns true only when the authenticated user owns the business. SECURITY DEFINER is used so collection RLS does not depend on businesses SELECT RLS.';

commit;
