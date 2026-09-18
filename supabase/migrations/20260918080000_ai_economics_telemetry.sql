begin;
alter table public.ai_generations add column if not exists estimated_cost_usd numeric(12,6);
alter table public.ai_generations add column if not exists cost_basis text;

create or replace function public.admin_ai_economics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare d integer:=greatest(1,least(coalesce(p_days,30),365));
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception using errcode='42501',message='admin_required'; end if;
 return jsonb_build_object(
  'period_days',d,
  'generated',(select count(*) from public.ai_generations where created_at >= now()-make_interval(days=>d)),
  'completed',(select count(*) from public.ai_generations where status='completed' and created_at >= now()-make_interval(days=>d)),
  'failed',(select count(*) from public.ai_generations where status in ('failed','error') and created_at >= now()-make_interval(days=>d)),
  'estimated_cost_usd',coalesce((select sum(estimated_cost_usd) from public.ai_generations where created_at >= now()-make_interval(days=>d)),0),
  'credits_debited',coalesce((select sum(amount) from public.ai_credit_transactions where type='generation' and created_at >= now()-make_interval(days=>d)),0),
  'credits_refunded',coalesce((select sum(amount) from public.ai_credit_transactions where type='refund' and created_at >= now()-make_interval(days=>d)),0),
  'daily',coalesce((select jsonb_agg(x order by x.metric_date desc) from (select date(created_at) as metric_date,count(*) generated,count(*) filter(where status='completed') completed,count(*) filter(where status in ('failed','error')) failed,coalesce(sum(estimated_cost_usd),0) estimated_cost_usd from public.ai_generations where created_at >= now()-make_interval(days=>d) group by date(created_at)) x),'[]'::jsonb)
 );
end$$;

revoke all on function public.admin_ai_economics(integer) from public,anon,authenticated;
grant execute on function public.admin_ai_economics(integer) to authenticated;
commit;