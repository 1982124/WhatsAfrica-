begin;

create or replace function public.get_collection_sales_overview(p_collection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_sales bigint := 0;
  v_units bigint := 0;
  v_revenue numeric := 0;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select pc.business_id into v_business_id
  from public.product_collections pc
  where pc.id = p_collection_id;

  if v_business_id is null then
    raise exception 'collection_not_found';
  end if;

  if not exists (
    select 1 from public.businesses b
    where b.id = v_business_id and b.owner_id = v_uid
  ) and not exists (
    select 1 from public.business_collaborators bc
    where bc.business_id = v_business_id
      and bc.user_id = v_uid
      and bc.status = 'active'
      and bc.role in ('manager','editor','analyst')
  ) then
    raise exception 'forbidden';
  end if;

  select
    count(distinct o.id),
    coalesce(sum(oi.quantity),0),
    coalesce(sum(oi.line_total),0)
  into v_sales, v_units, v_revenue
  from public.collection_items ci
  join public.order_items oi on oi.product_id = ci.product_id
  join public.orders o on o.id = oi.order_id
  where ci.collection_id = p_collection_id
    and o.business_id = v_business_id
    and o.payment_status = 'paid';

  return jsonb_build_object(
    'collection_id', p_collection_id,
    'sales_count', v_sales,
    'units_sold', v_units,
    'gross_revenue', v_revenue,
    'financial_withdrawal_allowed', false
  );
end;
$$;

revoke all on function public.get_collection_sales_overview(uuid) from public, anon;
grant execute on function public.get_collection_sales_overview(uuid) to authenticated;

comment on function public.get_collection_sales_overview(uuid)
is 'Sales visibility for collection owner and active collaborators. This function never grants financial withdrawal authority.';

commit;