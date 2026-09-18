-- Red-team hardening: exposed SECURITY DEFINER RPCs must not be callable anonymously.
-- Guest-facing SECURITY DEFINER RPCs intentionally remain available to anon.
revoke all on function public.ai_studio_status() from anon;
grant execute on function public.ai_studio_status() to authenticated;

revoke all on function public.admin_create_discount_code(text,integer,integer,integer,timestamptz) from anon;
revoke all on function public.admin_grant_permanent_free(uuid) from anon;
revoke all on function public.admin_list_smartlink_tariffs() from anon;
revoke all on function public.admin_search_users(text) from anon;
revoke all on function public.admin_upsert_smartlink_tariff(uuid,text,text,text,numeric,integer,timestamptz,timestamptz,boolean) from anon;
revoke all on function public.platform_admin_overview() from anon;
revoke all on function public.ai_budget_status(uuid,text,numeric,integer) from anon;
revoke all on function public.record_ai_usage(uuid,text,text,text,integer,integer,numeric,numeric,text,jsonb) from anon;
revoke all on function public.smartlink_current_tariff() from anon;

create or replace function public.ai_studio_status()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  plan_code text := 'free';
  w public.ai_credit_wallets%rowtype;
  grant_amount integer := 0;
  month text := to_char(now(),'YYYY-MM');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  begin
    select public.current_user_plan() into plan_code;
  exception when others then
    plan_code := 'free';
  end;
  if plan_code='premium' then grant_amount:=100;
  elsif plan_code in ('business','pro') then grant_amount:=50;
  end if;
  insert into public.ai_credit_wallets(user_id,balance,monthly_grant,month_key)
  values(auth.uid(),grant_amount,grant_amount,month)
  on conflict(user_id) do nothing;
  select * into w from public.ai_credit_wallets where user_id=auth.uid();
  if w.month_key<>month then
    update public.ai_credit_wallets
      set balance=grant_amount,monthly_grant=grant_amount,month_key=month,updated_at=now()
      where user_id=auth.uid();
    select * into w from public.ai_credit_wallets where user_id=auth.uid();
    insert into public.ai_credit_transactions(user_id,type,amount,balance_after,metadata)
      values(auth.uid(),'grant',grant_amount,w.balance,jsonb_build_object('month',month,'plan',plan_code));
  end if;
  return jsonb_build_object('plan',plan_code,'enabled',grant_amount>0,'credits',w.balance,'monthly_grant',grant_amount);
end
$function$;
