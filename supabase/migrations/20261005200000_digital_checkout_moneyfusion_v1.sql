begin;

alter table public.orders add column if not exists collection_id uuid references public.product_collections(id) on delete set null;
create index if not exists orders_collection_id_idx on public.orders(collection_id);

create or replace function public.create_digital_collection_order(
  p_collection_id uuid,
  p_buyer_name text,
  p_buyer_phone text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_catalog, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_collection public.product_collections%rowtype;
  v_order public.orders%rowtype;
  v_total numeric(12,2);
  v_currency text;
  v_count int;
  v_unit numeric(12,2);
  v_i record;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_collection_id is null then raise exception 'collection_invalid'; end if;
  if length(trim(coalesce(p_buyer_name,''))) < 2 then raise exception 'buyer_name_invalid'; end if;
  if length(regexp_replace(coalesce(p_buyer_phone,''),'[^0-9]','','g')) < 8 then raise exception 'buyer_phone_invalid'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 then raise exception 'idempotency_invalid'; end if;

  select * into v_order from public.orders where idempotency_key=trim(p_idempotency_key) limit 1;
  if found then
    return jsonb_build_object('order_id',v_order.id,'tracking_token',v_order.tracking_token,'status',v_order.status,'payment_status',v_order.payment_status,'total',v_order.total,'currency',v_order.currency,'existing',true);
  end if;

  select * into v_collection
  from public.product_collections
  where id=p_collection_id and is_published=true
  for share;
  if not found then raise exception 'collection_not_found'; end if;
  if v_collection.price is null or v_collection.price <= 0 then raise exception 'collection_price_invalid'; end if;
  v_total := v_collection.price;
  v_currency := upper(coalesce(v_collection.currency,'XOF'));
  if v_currency <> 'XOF' then raise exception 'collection_currency_not_supported'; end if;

  select count(*) into v_count
  from public.product_collection_items pci
  join public.products p on p.id=pci.product_id
  where pci.collection_id=p_collection_id and p.is_published=true
    and p.product_type='digital' and p.digital_storage_path is not null;
  if v_count < 2 then raise exception 'collection_requires_two_digital_products'; end if;

  v_unit := round(v_total / v_count, 2);

  insert into public.orders(
    business_id,buyer_user_id,buyer_name,buyer_phone,delivery_method,payment_method,
    payment_status,status,currency,subtotal,delivery_fee,total,idempotency_key,collection_id
  ) values(
    v_collection.business_id,v_uid,trim(p_buyer_name),trim(p_buyer_phone),'pickup','online',
    'pending','pending',v_currency,v_total,0,v_total,trim(p_idempotency_key),p_collection_id
  ) returning * into v_order;

  for v_i in
    select p.id,p.title
    from public.product_collection_items pci
    join public.products p on p.id=pci.product_id
    where pci.collection_id=p_collection_id and p.is_published=true
      and p.product_type='digital' and p.digital_storage_path is not null
    order by pci.sort_order,p.id
  loop
    insert into public.order_items(order_id,product_id,title_snapshot,unit_price,currency,quantity,line_total,price_source)
    values(v_order.id,v_i.id,v_i.title,v_unit,v_currency,1,v_unit,'collection_bundle');
  end loop;

  if (select coalesce(sum(line_total),0) from public.order_items where order_id=v_order.id) <> v_total then
    update public.order_items
    set unit_price = unit_price + (v_total - (select coalesce(sum(line_total),0) from public.order_items where order_id=v_order.id))
    where id = (select id from public.order_items where order_id=v_order.id order by created_at asc limit 1);
  end if;

  return jsonb_build_object('order_id',v_order.id,'tracking_token',v_order.tracking_token,'status','pending','payment_status','pending','total',v_total,'currency',v_currency,'collection_id',p_collection_id,'existing',false);
exception when unique_violation then
  select * into v_order from public.orders where idempotency_key=trim(p_idempotency_key) limit 1;
  if found then return jsonb_build_object('order_id',v_order.id,'tracking_token',v_order.tracking_token,'status',v_order.status,'payment_status',v_order.payment_status,'total',v_order.total,'currency',v_order.currency,'existing',true); end if;
  raise;
end;
$$;

revoke all on function public.create_digital_collection_order(uuid,text,text,text) from public,anon;
grant execute on function public.create_digital_collection_order(uuid,text,text,text) to authenticated;

commit;
