create schema if not exists private;

create table if not exists private.wassafrica_partner_attribution_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.wassafrica_partner_referrals(id) on delete restrict,
  event_type text not null check (event_type in ('lead','qualified','application','approved','activated','transaction','commission_pending','commission_confirmed','disputed','cancelled','churned')),
  external_ref text,
  amount numeric(18,2),
  currency text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(referral_id,event_type,external_ref)
);

create index if not exists idx_wa_attr_referral on private.wassafrica_partner_attribution_events(referral_id,occurred_at desc);

create table if not exists private.wassafrica_partner_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  attribution_event_id uuid not null references private.wassafrica_partner_attribution_events(id) on delete restrict,
  referral_id uuid not null references public.wassafrica_partner_referrals(id) on delete restrict,
  partner_id uuid not null references public.wassafrica_partners(id) on delete restrict,
  service_id uuid references public.wassafrica_partner_services(id) on delete restrict,
  rule_id uuid references public.wassafrica_partner_commission_rules(id) on delete restrict,
  model text not null,
  basis_amount numeric(18,2),
  rate numeric(18,6),
  commission_amount numeric(18,2) not null default 0,
  currency text,
  status text not null default 'pending' check(status in ('pending','confirmed','disputed','cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique(attribution_event_id)
);

create index if not exists idx_wa_commission_referral on private.wassafrica_partner_commission_ledger(referral_id);
create index if not exists idx_wa_commission_partner on private.wassafrica_partner_commission_ledger(partner_id,status);

alter table private.wassafrica_partner_attribution_events enable row level security;
alter table private.wassafrica_partner_commission_ledger enable row level security;

revoke all on private.wassafrica_partner_attribution_events from anon, authenticated;
revoke all on private.wassafrica_partner_commission_ledger from anon, authenticated;

create or replace function private.wassafrica_record_partner_event(
  p_referral_id uuid,p_event_type text,p_external_ref text default null,p_amount numeric default null,
  p_currency text default null,p_payload jsonb default '{}'::jsonb,p_occurred_at timestamptz default now()
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare r record; e_id uuid; rule record; commission numeric := 0; rule_currency text;
begin
  if p_event_type not in ('lead','qualified','application','approved','activated','transaction','commission_pending','commission_confirmed','disputed','cancelled','churned') then raise exception 'invalid_event_type'; end if;
  select r.id,r.partner_id,r.service_id,r.status into r from public.wassafrica_partner_referrals r where r.id=p_referral_id for update;
  if not found then raise exception 'referral_not_found'; end if;
  insert into private.wassafrica_partner_attribution_events(referral_id,event_type,external_ref,amount,currency,payload,occurred_at)
  values(p_referral_id,p_event_type,p_external_ref,p_amount,p_currency,coalesce(p_payload,'{}'::jsonb),coalesce(p_occurred_at,now()))
  on conflict (referral_id,event_type,external_ref) do nothing returning id into e_id;
  if e_id is null then
    select id into e_id from private.wassafrica_partner_attribution_events where referral_id=p_referral_id and event_type=p_event_type and external_ref is not distinct from p_external_ref order by created_at desc limit 1;
    return jsonb_build_object('ok',true,'duplicate',true,'event_id',e_id);
  end if;
  update public.wassafrica_partner_referrals set status=case p_event_type
    when 'lead' then 'lead' when 'qualified' then 'qualified' when 'application' then 'application'
    when 'approved' then 'approved' when 'activated' then 'activated' when 'transaction' then 'transaction'
    when 'commission_pending' then 'commission_pending' when 'commission_confirmed' then 'commission_confirmed'
    when 'disputed' then 'disputed' when 'cancelled' then 'cancelled' when 'churned' then 'churned' else status end
  where id=p_referral_id;
  if p_event_type='transaction' and p_amount is not null then
    select cr.* into rule from public.wassafrica_partner_commission_rules cr
    where cr.partner_id=r.partner_id and (cr.service_id is null or cr.service_id=r.service_id) and cr.status='active'
      and cr.valid_from <= coalesce(p_occurred_at,now()) and (cr.valid_until is null or cr.valid_until >= coalesce(p_occurred_at,now()))
    order by (cr.service_id is not null) desc,cr.valid_from desc limit 1;
    if found then
      rule_currency:=coalesce(p_currency,rule.currency);
      commission:=case rule.model when 'revenue_share' then p_amount*rule.rate/100 when 'transaction' then p_amount*rule.rate/100 when 'flat' then rule.rate else 0 end;
      insert into private.wassafrica_partner_commission_ledger(attribution_event_id,referral_id,partner_id,service_id,rule_id,model,basis_amount,rate,commission_amount,currency)
      values(e_id,p_referral_id,r.partner_id,r.service_id,rule.id,rule.model,p_amount,rule.rate,commission,rule_currency)
      on conflict (attribution_event_id) do nothing;
    end if;
  end if;
  return jsonb_build_object('ok',true,'duplicate',false,'event_id',e_id,'referral_id',p_referral_id);
end $$;

revoke all on function private.wassafrica_record_partner_event(uuid,text,text,numeric,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function private.wassafrica_record_partner_event(uuid,text,text,numeric,text,jsonb,timestamptz) to service_role;