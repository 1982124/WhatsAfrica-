begin;
alter table public.digital_entitlements drop constraint if exists digital_entitlements_order_item_product_key;
alter table public.digital_entitlements add constraint digital_entitlements_order_item_product_key unique(order_item_id, product_id);

create or replace function private.issue_digital_entitlements_for_paid_order()
returns trigger language plpgsql security definer set search_path=pg_catalog, public as $$
begin
  if new.payment_status='paid' and (tg_op='INSERT' or old.payment_status is distinct from 'paid') then
    insert into public.digital_entitlements(order_id,order_item_id,product_id,buyer_user_id,status,max_downloads)
    select new.id,oi.id,oi.product_id,new.buyer_user_id,'active',p.digital_max_downloads
    from public.order_items oi join public.products p on p.id=oi.product_id
    where oi.order_id=new.id and p.product_type='digital'
    on conflict(order_item_id,product_id) do update
      set buyer_user_id=excluded.buyer_user_id,status='active',max_downloads=excluded.max_downloads,updated_at=now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_issue_digital_entitlements on public.orders;
create trigger trg_issue_digital_entitlements after insert or update of payment_status on public.orders for each row execute function private.issue_digital_entitlements_for_paid_order();
revoke all on function private.issue_digital_entitlements_for_paid_order() from public;
commit;