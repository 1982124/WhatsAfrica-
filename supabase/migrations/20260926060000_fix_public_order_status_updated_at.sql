create or replace function public.get_public_order_status(p_order_id uuid, p_tracking_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_order public.orders;
begin
  if p_order_id is null or nullif(trim(p_tracking_token),'') is null then
    raise exception 'tracking_invalid';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and tracking_token = trim(p_tracking_token);

  if not found then
    raise exception 'order_not_found';
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'total', v_order.total,
    'currency', v_order.currency,
    'payment_provider', v_order.payment_provider,
    'payment_paid_at', v_order.payment_paid_at,
    'payment_updated_at', v_order.payment_updated_at
  );
end;
$function$;
