-- WhatsAfrica CTO: close the authenticated commerce loop.
-- Order -> direct WhatsAfrica conversation -> CRM lead.
-- Anonymous/guest orders remain supported; they simply do not create a user conversation.

drop function if exists private.create_guest_order(uuid,uuid,text,text,text,text,text,text,jsonb,text,uuid);

create function private.create_guest_order(p_business_id uuid, p_smart_link_id uuid, p_buyer_name text, p_buyer_phone text, p_delivery_city text, p_delivery_address text, p_delivery_method text, p_payment_method text, p_items jsonb, p_idempotency_key text, p_buyer_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business public.businesses%rowtype;
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_tracking text;
  v_product public.products%rowtype;
  v_qty integer;
  v_line numeric(12,2);
  v_existing public.orders%rowtype;
  v_buyer uuid := (select auth.uid());
  v_conversation uuid;
  v_lead uuid;
begin
  if length(trim(coalesce(p_buyer_name,''))) < 2 then raise exception 'Nom client invalide'; end if;
  if length(regexp_replace(coalesce(p_buyer_phone,''),'[^0-9]','','g')) < 8 then raise exception 'Téléphone client invalide'; end if;
  if p_delivery_method not in ('pickup','delivery') then raise exception 'Mode de livraison invalide'; end if;
  if p_payment_method not in ('cash_on_delivery','mobile_money','online') then raise exception 'Mode de paiement invalide'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then raise exception 'Clé de commande invalide'; end if;

  select * into v_existing from public.orders where idempotency_key=p_idempotency_key limit 1;
  if found then
    return jsonb_build_object('order_id',v_existing.id,'tracking_token',v_existing.tracking_token,'status',v_existing.status,'payment_status',v_existing.payment_status,'total',v_existing.total,'currency',v_existing.currency,'existing',true);
  end if;

  select * into v_business from public.businesses where id=p_business_id;
  if not found then raise exception 'Commerce introuvable'; end if;
  if p_smart_link_id is not null and not exists(select 1 from public.smart_links s where s.id=p_smart_link_id and s.business_id=p_business_id and s.is_public=true) then raise exception 'Smart Link invalide'; end if;
  if p_delivery_method='delivery' then
    if not v_business.delivery_enabled then raise exception 'Livraison indisponible'; end if;
    v_delivery_fee := coalesce(v_business.delivery_fee,0);
    if nullif(trim(coalesce(p_delivery_address,'')),'') is null then raise exception 'Adresse de livraison requise'; end if;
  end if;
  if not (v_business.payment_methods ? p_payment_method) then raise exception 'Mode de paiement indisponible'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Panier vide'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, least(coalesce((v_item->>'quantity')::integer,1),99));
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and business_id=p_business_id and is_published=true for update;
    if not found then raise exception 'Produit indisponible'; end if;
    if v_product.stock is not null and v_product.stock < v_qty then raise exception 'Stock insuffisant pour %', v_product.title; end if;
    if v_product.price is null then raise exception 'Prix indisponible pour %', v_product.title; end if;
    v_line := v_product.price * v_qty;
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_total := v_subtotal + v_delivery_fee;
  insert into public.orders(business_id,smart_link_id,buyer_user_id,buyer_name,buyer_phone,delivery_city,delivery_address,delivery_method,payment_method,payment_status,status,currency,subtotal,delivery_fee,total,idempotency_key)
  values(v_business.id,p_smart_link_id,case when p_buyer_user_id=v_buyer then p_buyer_user_id else null end,trim(p_buyer_name),trim(p_buyer_phone),nullif(trim(p_delivery_city),''),nullif(trim(p_delivery_address),''),p_delivery_method,p_payment_method,'pending','pending',coalesce((select currency from public.products where business_id=v_business.id and currency is not null limit 1),'XOF'),v_subtotal,v_delivery_fee,v_total,p_idempotency_key)
  returning id,tracking_token into v_order_id,v_tracking;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, least(coalesce((v_item->>'quantity')::integer,1),99));
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and business_id=p_business_id and is_published=true for update;
    insert into public.order_items(order_id,product_id,title_snapshot,unit_price,currency,quantity,line_total)
    values(v_order_id,v_product.id,v_product.title,v_product.price,coalesce(v_product.currency,'XOF'),v_qty,v_product.price*v_qty);
    if v_product.stock is not null then update public.products set stock=stock-v_qty where id=v_product.id; end if;
  end loop;

  insert into public.notifications(user_id,type,title,body)
  values(v_business.owner_id,'new_order','Nouvelle commande','Commande #'||left(v_order_id::text,8)||' reçue pour un montant de '||v_total||' '||coalesce((select currency from public.products where business_id=v_business.id and currency is not null limit 1),'XOF'));

  if v_buyer is not null and p_buyer_user_id=v_buyer and v_business.owner_id is not null and v_business.owner_id <> v_buyer then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_business.id::text || ':' || v_buyer::text, 0));

    select c.id into v_conversation
    from public.conversations c
    where c.owner_id=v_business.owner_id and c.kind='direct'
      and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=v_buyer)
      and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=v_business.owner_id)
    order by c.created_at desc limit 1;

    if v_conversation is null then
      insert into public.conversations(kind,title,owner_id)
      values('direct','Commande WhatsAfrica — '||left(v_order_id::text,8),v_business.owner_id)
      returning id into v_conversation;
      insert into public.conversation_members(conversation_id,user_id,role)
      values(v_conversation,v_business.owner_id,'owner'),(v_conversation,v_buyer,'member');
      insert into public.notifications(user_id,type,title,body)
      values(v_business.owner_id,'new_conversation','Nouveau client','Un client vient d’ouvrir une conversation depuis une commande WhatsAfrica.');
    end if;

    select l.id into v_lead from public.leads l
    where l.business_id=v_business.id and l.user_id=v_buyer and l.source='order'
    order by l.created_at desc limit 1;

    if v_lead is null then
      insert into public.leads(business_id,user_id,conversation_id,source,status,priority,contact_name,contact_phone,notes,value_amount)
      values(v_business.id,v_buyer,v_conversation,'order','new','high',trim(p_buyer_name),trim(p_buyer_phone),'Prospect créé depuis une commande WhatsAfrica #'||left(v_order_id::text,8),v_total)
      returning id into v_lead;
    else
      update public.leads set conversation_id=coalesce(conversation_id,v_conversation),contact_name=coalesce(nullif(trim(p_buyer_name),''),contact_name),contact_phone=coalesce(nullif(trim(p_buyer_phone),''),contact_phone),value_amount=coalesce(value_amount,0)+v_total,updated_at=pg_catalog.now() where id=v_lead;
    end if;
  end if;

  return jsonb_build_object('order_id',v_order_id,'tracking_token',v_tracking,'status','pending','payment_status','pending','total',v_total,'currency',coalesce((select currency from public.products where business_id=v_business.id and currency is not null limit 1),'XOF'),'existing',false,'conversation_id',v_conversation,'lead_id',v_lead);
exception when unique_violation then
  select * into v_existing from public.orders where idempotency_key=p_idempotency_key limit 1;
  if found then return jsonb_build_object('order_id',v_existing.id,'tracking_token',v_existing.tracking_token,'status',v_existing.status,'payment_status',v_existing.payment_status,'total',v_existing.total,'currency',v_existing.currency,'existing',true); end if;
  raise;
end;
$function$;

revoke execute on function private.create_guest_order(uuid,uuid,text,text,text,text,text,text,jsonb,text,uuid) from public, anon;
grant execute on function private.create_guest_order(uuid,uuid,text,text,text,text,text,text,jsonb,text,uuid) to authenticated;
