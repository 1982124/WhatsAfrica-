-- WASSAFRICA AI cost guardrails.
-- Private ledger: no client access. Service-role server functions record usage.
create schema if not exists private;

create table if not exists private.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  surface text not null check (surface in ('smartlink_builder','smartlink_assistant')),
  model text,
  provider text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  estimated_cost_usd numeric(18,8) not null default 0,
  estimated_cost_xof numeric(18,2) not null default 0,
  status text not null default 'success' check (status in ('success','fallback','blocked','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_period_idx on private.ai_usage_events(user_id, surface, created_at desc);
create index if not exists ai_usage_events_created_idx on private.ai_usage_events(created_at desc);

create or replace function public.ai_budget_status(
  p_user_id uuid,
  p_surface text,
  p_budget_xof numeric default 350,
  p_request_cap integer default 40
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_catalog'
as $$
declare
  v_used numeric(18,2);
  v_requests integer;
  v_period timestamptz := date_trunc('month', now());
  v_budget numeric := greatest(coalesce(p_budget_xof,350),0);
  v_cap integer := greatest(coalesce(p_request_cap,40),0);
begin
  if p_user_id is null or p_surface not in ('smartlink_builder','smartlink_assistant') then raise exception 'AI_BUDGET_ARGUMENT_INVALID'; end if;
  select coalesce(sum(estimated_cost_xof),0), count(*) into v_used, v_requests
  from private.ai_usage_events
  where user_id=p_user_id and surface=p_surface and created_at>=v_period;
  return jsonb_build_object(
    'allowed', v_used < v_budget and v_requests < v_cap,
    'used_xof', round(v_used,2),
    'budget_xof', v_budget,
    'requests', v_requests,
    'request_cap', v_cap,
    'period_start', v_period
  );
end;
$$;

create or replace function public.record_ai_usage(
  p_user_id uuid,p_surface text,p_model text,p_provider text,
  p_prompt_tokens integer default 0,p_completion_tokens integer default 0,
  p_estimated_cost_usd numeric default 0,p_estimated_cost_xof numeric default 0,
  p_status text default 'success',p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path='public','private','pg_catalog'
as $$
declare v_id uuid;
begin
  if p_user_id is null or p_surface not in ('smartlink_builder','smartlink_assistant') then raise exception 'AI_USAGE_ARGUMENT_INVALID'; end if;
  insert into private.ai_usage_events(user_id,surface,model,provider,prompt_tokens,completion_tokens,estimated_cost_usd,estimated_cost_xof,status,metadata)
  values(p_user_id,p_surface,left(p_model,160),left(p_provider,80),greatest(coalesce(p_prompt_tokens,0),0),greatest(coalesce(p_completion_tokens,0),0),greatest(coalesce(p_estimated_cost_usd,0),0),greatest(coalesce(p_estimated_cost_xof,0),0),case when p_status in ('success','fallback','blocked','error') then p_status else 'success' end,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on table private.ai_usage_events from anon, authenticated;
revoke execute on function public.ai_budget_status(uuid,text,numeric,integer) from anon, authenticated;
revoke execute on function public.record_ai_usage(uuid,text,text,text,integer,integer,numeric,numeric,text,jsonb) from anon, authenticated;
grant execute on function public.ai_budget_status(uuid,text,numeric,integer) to service_role;
grant execute on function public.record_ai_usage(uuid,text,text,text,integer,integer,numeric,numeric,text,jsonb) to service_role;
