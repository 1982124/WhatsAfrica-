-- Red-team hardening: atomic AI credit consumption/refund + rollback-safe idempotency.
create unique index if not exists ai_credit_generation_type_once_idx
  on public.ai_credit_transactions (generation_id, type)
  where generation_id is not null and type in ('generation','refund');

create or replace function public.ai_consume_credit(p_generation_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_generation public.ai_generations%rowtype;
  v_balance integer;
  v_amount integer;
  v_existing public.ai_credit_transactions%rowtype;
  v_plan text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_generation_id is null then raise exception 'GENERATION_REQUIRED'; end if;
  select * into v_generation from public.ai_generations
    where id=p_generation_id and user_id=v_uid for update;
  if not found then raise exception 'GENERATION_NOT_FOUND'; end if;
  select * into v_existing from public.ai_credit_transactions
    where generation_id=p_generation_id and type='generation' limit 1;
  if found then
    select balance into v_balance from public.ai_credit_wallets where user_id=v_uid;
    return jsonb_build_object('ok',true,'already_consumed',true,'balance',coalesce(v_balance,0),'amount',abs(v_existing.amount));
  end if;
  if v_generation.status <> 'pending' then
    return jsonb_build_object('ok',false,'error','generation_already_started');
  end if;
  v_plan := public.current_user_plan();
  if v_plan not in ('premium','pro','business') then
    return jsonb_build_object('ok',false,'error','studio_premium_required','plan',coalesce(v_plan,'free'));
  end if;
  v_amount := case
    when coalesce(v_generation.generation_config->>'n','') ~ '^[1-3]$'
      then (v_generation.generation_config->>'n')::integer
    else 1 end;
  update public.ai_credit_wallets
     set balance=balance-v_amount, updated_at=now()
   where user_id=v_uid and balance>=v_amount
   returning balance into v_balance;
  if v_balance is null then
    return jsonb_build_object('ok',false,'error','credits_exhausted');
  end if;
  insert into public.ai_credit_transactions(user_id,generation_id,type,amount,balance_after,metadata)
  values(v_uid,p_generation_id,'generation',-v_amount,v_balance,jsonb_build_object('plan',v_plan,'amount',v_amount));
  update public.ai_generations set status='processing',error_message=null
    where id=p_generation_id and user_id=v_uid;
  return jsonb_build_object('ok',true,'already_consumed',false,'balance',v_balance,'amount',v_amount,'plan',v_plan);
exception when unique_violation then
  select balance into v_balance from public.ai_credit_wallets where user_id=v_uid;
  return jsonb_build_object('ok',true,'already_consumed',true,'balance',coalesce(v_balance,0));
end;
$function$;

create or replace function public.ai_refund_credit(p_generation_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_generation public.ai_generations%rowtype;
  v_charge public.ai_credit_transactions%rowtype;
  v_existing public.ai_credit_transactions%rowtype;
  v_balance integer;
  v_amount integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_generation from public.ai_generations
    where id=p_generation_id and user_id=v_uid for update;
  if not found then return jsonb_build_object('ok',false,'error','GENERATION_NOT_FOUND'); end if;
  select * into v_charge from public.ai_credit_transactions
    where generation_id=p_generation_id and type='generation' limit 1;
  if not found then return jsonb_build_object('ok',false,'error','NO_CHARGE_TO_REFUND'); end if;
  select * into v_existing from public.ai_credit_transactions
    where generation_id=p_generation_id and type='refund' limit 1;
  if found then
    select balance into v_balance from public.ai_credit_wallets where user_id=v_uid;
    return jsonb_build_object('ok',true,'already_refunded',true,'balance',coalesce(v_balance,0));
  end if;
  if v_generation.status not in ('failed','error') then
    return jsonb_build_object('ok',false,'error','GENERATION_NOT_FAILED');
  end if;
  v_amount := abs(v_charge.amount);
  update public.ai_credit_wallets set balance=balance+v_amount,updated_at=now()
    where user_id=v_uid returning balance into v_balance;
  if v_balance is null then return jsonb_build_object('ok',false,'error','WALLET_NOT_FOUND'); end if;
  insert into public.ai_credit_transactions(user_id,generation_id,type,amount,balance_after,metadata)
  values(v_uid,p_generation_id,'refund',v_amount,v_balance,jsonb_build_object('reason','generation_failed','amount',v_amount));
  return jsonb_build_object('ok',true,'already_refunded',false,'balance',v_balance,'amount',v_amount);
exception when unique_violation then
  select balance into v_balance from public.ai_credit_wallets where user_id=v_uid;
  return jsonb_build_object('ok',true,'already_refunded',true,'balance',coalesce(v_balance,0));
end;
$function$;

revoke all on function public.ai_consume_credit(uuid) from public, anon;
grant execute on function public.ai_consume_credit(uuid) to authenticated;
revoke all on function public.ai_refund_credit(uuid) from public, anon;
grant execute on function public.ai_refund_credit(uuid) to authenticated;
