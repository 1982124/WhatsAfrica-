-- WassAfrica commerce hardening: review integrity, FK indexes, state machine, payments and multi-vendor checkout.
create index if not exists cart_items_product_id_idx on public.cart_items(product_id);
create index if not exists checkout_groups_buyer_user_id_idx on public.checkout_groups(buyer_user_id);
create index if not exists commerce_favorites_product_id_idx on public.commerce_favorites(product_id);
create index if not exists commerce_reviews_order_item_id_idx on public.commerce_reviews(order_item_id);
create index if not exists commerce_reviews_reviewer_user_id_idx on public.commerce_reviews(reviewer_user_id);
create index if not exists order_status_history_actor_user_id_idx on public.order_status_history(actor_user_id);
drop index if exists public.idx_order_items_order;
drop index if exists public.idx_orders_business_created;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status = any (array['pending','confirmed','processing','ready','shipped','delivered','cancelled','problem','preparing','shipping']));

alter table public.commerce_reviews drop constraint if exists commerce_reviews_review_type_check;
alter table public.commerce_reviews add constraint commerce_reviews_review_type_check check (review_type = any (array['product','seller']));
create unique index if not exists commerce_reviews_seller_once_uidx on public.commerce_reviews(order_id,reviewer_user_id,business_id) where review_type='seller';
create unique index if not exists commerce_reviews_product_once_uidx on public.commerce_reviews(order_id,reviewer_user_id,order_item_id) where review_type='product';
drop index if exists public.commerce_reviews_transaction_once_uidx;

create or replace function private.validate_commerce_review()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare v_buyer uuid; v_order_status text; v_order_business uuid; v_item_product uuid; v_item_order uuid; v_product_business uuid;
begin
 select o.buyer_user_id,o.status,o.business_id into v_buyer,v_order_status,v_order_business from public.orders o where o.id=new.order_id for share;
 if v_buyer is null then raise exception 'review_order_not_found'; end if;
 if v_order_status<>'delivered' then raise exception 'review_order_not_delivered'; end if;
 if new.reviewer_user_id<>v_buyer then raise exception 'review_reviewer_mismatch'; end if;
 if new.business_id<>v_order_business then raise exception 'review_business_mismatch'; end if;
 if new.review_type='seller' then
   if new.order_item_id is not null or new.product_id is not null then raise exception 'seller_review_must_not_reference_product'; end if;
 elsif new.review_type='product' then
   if new.order_item_id is null or new.product_id is null then raise exception 'product_review_requires_order_item_and_product'; end if;
   select oi.order_id,oi.product_id into v_item_order,v_item_product from public.order_items oi where oi.id=new.order_item_id;
   if v_item_order is null or v_item_order<>new.order_id or v_item_product<>new.product_id then raise exception 'review_product_not_purchased_in_order'; end if;
   select p.business_id into v_product_business from public.products p where p.id=new.product_id;
   if v_product_business is null or v_product_business<>new.business_id then raise exception 'review_product_business_mismatch'; end if;
 else raise exception 'review_type_invalid'; end if;
 return new;
end $$;
drop trigger if exists trg_validate_commerce_review on public.commerce_reviews;
create trigger trg_validate_commerce_review before insert or update on public.commerce_reviews for each row execute function private.validate_commerce_review();

drop policy if exists reviews_owner_insert on public.commerce_reviews;
create policy reviews_owner_insert on public.commerce_reviews for insert to authenticated with check (
 reviewer_user_id=(select auth.uid())
 and exists(select 1 from public.orders o where o.id=commerce_reviews.order_id and o.buyer_user_id=(select auth.uid()) and o.status='delivered' and o.business_id=commerce_reviews.business_id)
 and (
  (commerce_reviews.review_type='seller' and commerce_reviews.order_item_id is null and commerce_reviews.product_id is null)
  or
  (commerce_reviews.review_type='product' and commerce_reviews.order_item_id is not null and commerce_reviews.product_id is not null and exists(
    select 1 from public.order_items oi join public.products p on p.id=oi.product_id
    where oi.id=commerce_reviews.order_item_id and oi.order_id=commerce_reviews.order_id and oi.product_id=commerce_reviews.product_id and p.business_id=commerce_reviews.business_id
  ))
 )
);

alter table public.checkout_groups add column if not exists idempotency_key text, add column if not exists payment_status text not null default 'pending';
create unique index if not exists checkout_groups_idempotency_uidx on public.checkout_groups(idempotency_key) where idempotency_key is not null;
alter table public.checkout_groups drop constraint if exists checkout_groups_payment_status_check;
alter table public.checkout_groups add constraint checkout_groups_payment_status_check check (payment_status in ('pending','partial','paid','failed','cancelled'));

create or replace function public.create_multi_vendor_checkout(
 p_buyer_name text,p_buyer_phone text,p_delivery_city text,p_delivery_address text,p_delivery_method text,p_payment_method text,p_groups jsonb,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path to 'public','private','pg_catalog','auth' as $$
declare v_uid uuid:=(select auth.uid());v_group_id uuid;v_existing public.checkout_groups;v_group jsonb;v_items jsonb;v_order jsonb;v_order_id uuid;v_subtotal numeric(12,2):=0;v_delivery numeric(12,2):=0;v_total numeric(12,2):=0;v_currency text;v_count int:=0;v_business_id uuid;v_smart_link_id uuid;v_method text;v_idem text;
begin
 if p_idempotency_key is null or length(trim(p_idempotency_key))<16 then raise exception 'checkout_idempotency_invalid';end if;
 if jsonb_typeof(p_groups)<>'array' or jsonb_array_length(p_groups)<2 then raise exception 'multi_vendor_requires_two_sellers';end if;
 if p_payment_method not in ('cash_on_delivery','mobile_money','online') then raise exception 'payment_method_invalid';end if;
 select * into v_existing from public.checkout_groups where idempotency_key=trim(p_idempotency_key) limit 1;
 if found then return jsonb_build_object('checkout_group_id',v_existing.id,'status',v_existing.status,'payment_status',v_existing.payment_status,'existing',true,'orders',coalesce((select jsonb_agg(jsonb_build_object('order_id',o.id,'business_id',o.business_id,'total',o.total,'currency',o.currency,'payment_status',o.payment_status,'tracking_token',o.tracking_token) order by o.created_at) from public.orders o where o.checkout_group_id=v_existing.id),'[]'::jsonb));end if;
 insert into public.checkout_groups(buyer_user_id,status,currency,subtotal,delivery_fee,total,idempotency_key,payment_status) values(v_uid,'pending','XOF',0,0,0,trim(p_idempotency_key),'pending') returning id into v_group_id;
 for v_group in select value from jsonb_array_elements(p_groups) loop
  v_business_id:=(v_group->>'business_id')::uuid;v_smart_link_id:=nullif(v_group->>'smart_link_id','')::uuid;v_items:=v_group->'items';v_method:=coalesce(nullif(v_group->>'payment_method',''),p_payment_method);
  if v_method not in ('cash_on_delivery','mobile_money','online') then raise exception 'payment_method_invalid_for_seller';end if;
  if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'seller_cart_empty';end if;
  v_idem:=trim(p_idempotency_key)||':'||v_business_id::text;
  v_order:=private.create_guest_order(v_business_id,v_smart_link_id,p_buyer_name,p_buyer_phone,p_delivery_city,p_delivery_address,p_delivery_method,v_method,v_items,v_idem,v_uid);
  v_order_id:=(v_order->>'order_id')::uuid;update public.orders set checkout_group_id=v_group_id where id=v_order_id;
  v_currency:=coalesce(v_currency,v_order->>'currency');if v_currency is distinct from (v_order->>'currency') then raise exception 'multi_vendor_mixed_currency_not_supported';end if;v_count:=v_count+1;
 end loop;
 if v_count<2 then raise exception 'multi_vendor_requires_two_sellers';end if;
 select coalesce(sum(o.subtotal),0),coalesce(sum(o.delivery_fee),0),coalesce(sum(o.total),0),min(o.currency) into v_subtotal,v_delivery,v_total,v_currency from public.orders o where o.checkout_group_id=v_group_id;
 update public.checkout_groups set currency=coalesce(v_currency,'XOF'),subtotal=v_subtotal,delivery_fee=v_delivery,total=v_total,updated_at=now() where id=v_group_id;
 return jsonb_build_object('checkout_group_id',v_group_id,'status','pending','payment_status','pending','subtotal',v_subtotal,'delivery_fee',v_delivery,'total',v_total,'currency',coalesce(v_currency,'XOF'),'existing',false,'orders',coalesce((select jsonb_agg(jsonb_build_object('order_id',o.id,'business_id',o.business_id,'total',o.total,'currency',o.currency,'payment_method',o.payment_method,'payment_status',o.payment_status,'tracking_token',o.tracking_token) order by o.created_at) from public.orders o where o.checkout_group_id=v_group_id),'[]'::jsonb));
exception when others then if v_group_id is not null then delete from public.orders where checkout_group_id=v_group_id;delete from public.checkout_groups where id=v_group_id;end if;raise;end $$;
revoke all on function public.create_multi_vendor_checkout(text,text,text,text,text,text,jsonb,text) from public,anon;grant execute on function public.create_multi_vendor_checkout(text,text,text,text,text,text,jsonb,text) to authenticated;

create or replace function public.create_order_payment_intent(p_order_id uuid,p_provider text,p_method text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path to 'public','pg_catalog','auth' as $$
declare v_uid uuid:=(select auth.uid());v_order public.orders;v_intent public.payment_intents;
begin
 if v_uid is null then raise exception 'authentication_required';end if;if p_order_id is null then raise exception 'order_invalid';end if;if lower(trim(coalesce(p_provider,'')))<>'moneyfusion' then raise exception 'provider_not_supported';end if;if p_method not in ('mobile_money','online') then raise exception 'payment_method_not_supported';end if;if p_idempotency_key is null or length(trim(p_idempotency_key))<16 then raise exception 'payment_idempotency_invalid';end if;
 select * into v_order from public.orders where id=p_order_id and buyer_user_id=v_uid for update;if not found then raise exception 'order_not_found';end if;if v_order.payment_status='paid' then raise exception 'order_already_paid';end if;if v_order.status='cancelled' then raise exception 'order_cancelled';end if;
 if v_order.payment_method not in ('mobile_money','online') then update public.orders set payment_method=p_method,payment_updated_at=now() where id=p_order_id returning * into v_order;end if;
 select * into v_intent from public.payment_intents where idempotency_key=trim(p_idempotency_key) limit 1;if found then return jsonb_build_object('payment_intent_id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,'currency',v_intent.currency,'provider',v_intent.provider,'provider_reference',v_intent.provider_reference,'existing',true);end if;
 insert into public.payment_intents(buyer_id,business_id,order_id,provider,method,currency,amount,status,idempotency_key,metadata) values(v_uid,v_order.business_id,v_order.id,'moneyfusion',p_method,v_order.currency,v_order.total,'created',trim(p_idempotency_key),jsonb_build_object('order_id',v_order.id,'checkout_group_id',v_order.checkout_group_id)) returning * into v_intent;
 update public.orders set payment_provider='moneyfusion',payment_updated_at=now() where id=p_order_id;
 return jsonb_build_object('payment_intent_id',v_intent.id,'status',v_intent.status,'amount',v_intent.amount,'currency',v_intent.currency,'provider',v_intent.provider,'order_id',v_order.id,'existing',false);
end $$;
revoke all on function public.create_order_payment_intent(uuid,text,text,text) from public,anon;grant execute on function public.create_order_payment_intent(uuid,text,text,text) to authenticated;
create or replace function public.get_payment_connection_secret_for_service(p_user_id uuid) returns table(provider text,country_code text,account_type text,secret text,connection_id uuid)
language sql security definer set search_path to 'public','vault','pg_catalog' as $$
 select pc.provider,pc.country_code,pc.account_type,ds.decrypted_secret,pc.id from public.payment_connections pc join vault.decrypted_secrets ds on ds.id=pc.external_reference::uuid where pc.user_id=p_user_id and pc.provider='moneyfusion' and pc.status in ('pending','connected','active') order by pc.created_at desc limit 1 $$;
revoke all on function public.get_payment_connection_secret_for_service(uuid) from public,anon,authenticated;grant execute on function public.get_payment_connection_secret_for_service(uuid) to service_role;
create index if not exists payment_intents_buyer_id_idx on public.payment_intents(buyer_id);
create index if not exists payment_intents_order_id_idx on public.payment_intents(order_id);
create index if not exists payment_events_order_id_idx on public.payment_events(order_id);

create or replace function public.apply_payment_webhook_event_for_service(p_order_id uuid,p_provider text,p_provider_event_id text,p_event_type text,p_transaction_id text,p_status text,p_payload_hash text default null) returns jsonb
language plpgsql security definer set search_path to 'public','private','pg_catalog' as $$
declare v_order public.orders;v_intent public.payment_intents;
begin
 v_order:=private.apply_verified_payment_event(p_order_id,p_provider,p_provider_event_id,p_event_type,p_transaction_id,p_status,p_payload_hash);
 select * into v_intent from public.payment_intents where order_id=p_order_id and provider=p_provider order by created_at desc limit 1 for update;
 if v_intent.id is not null then update public.payment_intents set status=case p_status when 'paid' then 'succeeded' when 'failed' then 'failed' when 'cancelled' then 'cancelled' when 'pending' then 'pending' else status end,provider_reference=coalesce(v_intent.provider_reference,p_provider_event_id),updated_at=now(),metadata=coalesce(v_intent.metadata,'{}'::jsonb)||jsonb_build_object('last_webhook_event',p_event_type,'last_webhook_at',now()) where id=v_intent.id;end if;
 if v_order.checkout_group_id is not null then update public.checkout_groups cg set payment_status=case when not exists(select 1 from public.orders o where o.checkout_group_id=cg.id and o.payment_status not in ('paid')) then 'paid' when exists(select 1 from public.orders o where o.checkout_group_id=cg.id and o.payment_status='paid') then 'partial' else 'pending' end,status=case when not exists(select 1 from public.orders o where o.checkout_group_id=cg.id and o.payment_status not in ('paid')) then 'paid' else cg.status end,updated_at=now() where cg.id=v_order.checkout_group_id;end if;
 return jsonb_build_object('order_id',v_order.id,'payment_status',v_order.payment_status,'status',v_order.status,'payment_intent_id',v_intent.id);
end $$;
revoke all on function public.apply_payment_webhook_event_for_service(uuid,text,text,text,text,text,text) from public,anon,authenticated;grant execute on function public.apply_payment_webhook_event_for_service(uuid,text,text,text,text,text,text) to service_role;

revoke execute on function public.get_public_order_status(uuid,text) from authenticated;
revoke execute on function public.resolve_public_profile(text) from authenticated;
revoke execute on function public.resolve_share_landing(text) from authenticated;
revoke execute on function public.get_guest_messages(text) from authenticated;
revoke execute on function public.get_guest_conversation_messages(text,uuid) from authenticated;
revoke execute on function public.send_guest_message(text,text) from authenticated;
revoke execute on function public.start_guest_commerce_conversation(uuid,text,text,text,uuid,uuid) from authenticated;
revoke execute on function public.track_commerce_event(text,text,uuid,uuid,jsonb) from authenticated;
revoke execute on function public.track_smart_link_event(uuid,text,jsonb) from authenticated;
