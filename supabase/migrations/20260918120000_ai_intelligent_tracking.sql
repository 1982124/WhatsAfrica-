-- WASSAFRICA AI Intelligent Tracking
-- Deterministic, explainable intelligence first: no LLM spend, no opaque scoring.
-- Admin-only derived signals over existing event/commerce/partner data.

create table if not exists public.ai_tracking_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  signal_type text not null,
  severity text not null check (severity in ('info','warning','critical')),
  confidence numeric(5,4) not null default 1 check (confidence >= 0 and confidence <= 1),
  entity_type text,
  entity_id uuid,
  title text not null,
  explanation text not null,
  recommended_action text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_tracking_signals_status_idx
  on public.ai_tracking_signals(status, severity, last_detected_at desc);
create index if not exists ai_tracking_signals_entity_idx
  on public.ai_tracking_signals(entity_type, entity_id, last_detected_at desc);

alter table public.ai_tracking_signals enable row level security;
revoke all on public.ai_tracking_signals from public, anon, authenticated;
drop policy if exists omnicto_deny_all on public.ai_tracking_signals;
create policy omnicto_deny_all on public.ai_tracking_signals
  as restrictive for all to public using (false) with check (false);

create or replace function public.ai_refresh_tracking_signals(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  d integer := greatest(7, least(coalesce(p_days,30), 365));
  inserted_count integer := 0;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode='42501', message='admin_required';
  end if;

  -- Smart Link / commerce funnel: detect unusually weak downstream conversion.
  insert into public.ai_tracking_signals(
    signal_key, signal_type, severity, confidence, title, explanation,
    recommended_action, evidence, last_detected_at, updated_at
  )
  with f as (
    select
      count(*) filter (where event_type in ('view','page_view','landing_view','visit'))::numeric visits,
      count(*) filter (where event_type in ('click','cta_click','contact_click','whatsapp_click'))::numeric contacts,
      count(*) filter (where event_type in ('order','checkout','purchase','conversion'))::numeric conversions
    from public.smart_link_events
    where created_at >= now() - make_interval(days=>d)
  )
  select
    'global:smartlink:funnel:'||d,
    'funnel_drop',
    case when visits >= 100 and conversions / nullif(visits,0) < 0.01 then 'critical' else 'warning' end,
    least(0.99, greatest(0.70, visits/1000.0)),
    'Smart Link : fuite importante du parcours',
    'Le volume de visites est significatif mais la conversion finale est faible.',
    'Inspecter le prix, le CTA, le parcours de commande et la rapidité de réponse avant d''acheter du trafic.',
    jsonb_build_object('visits',visits,'contacts',contacts,'conversions',conversions,
      'contact_rate',round(contacts/nullif(visits,0)*100,2),
      'conversion_rate',round(conversions/nullif(visits,0)*100,2),'period_days',d),
    now(),now()
  from f
  where visits >= 20 and conversions / nullif(visits,0) < 0.02
  on conflict (signal_key) do update set
    severity=excluded.severity, confidence=excluded.confidence,
    explanation=excluded.explanation, recommended_action=excluded.recommended_action,
    evidence=excluded.evidence, last_detected_at=now(), updated_at=now(), status='open';

  get diagnostics inserted_count = row_count;

  -- Payment reliability signal.
  insert into public.ai_tracking_signals(
    signal_key, signal_type, severity, confidence, title, explanation,
    recommended_action, evidence, last_detected_at, updated_at
  )
  select
    'global:payments:failure-rate:'||d,
    'payment_failure_rate',
    case when failed::numeric/greatest(total,1) >= 0.40 then 'critical' else 'warning' end,
    least(0.99, greatest(0.75,total/100.0)),
    'Paiements : taux d''échec élevé',
    'Une part anormalement élevée des événements de paiement échoue sur la période.',
    'Vérifier le fournisseur, les erreurs de callback/webhook, les statuts et le parcours de paiement avant d''augmenter l''acquisition.',
    jsonb_build_object('total',total,'failed',failed,'failure_rate',round(failed::numeric/greatest(total,1)*100,2),'period_days',d),
    now(),now()
  from (
    select count(*) total, count(*) filter(where lower(status) in ('failed','error','declined','cancelled')) failed
    from public.payment_events where created_at >= now()-make_interval(days=>d)
  ) x
  where total >= 5 and failed::numeric/greatest(total,1) >= 0.20
  on conflict (signal_key) do update set
    severity=excluded.severity, confidence=excluded.confidence,
    explanation=excluded.explanation, recommended_action=excluded.recommended_action,
    evidence=excluded.evidence, last_detected_at=now(), updated_at=now(), status='open';

  -- Partner inactivity: protect commission spend by detecting inactive channels.
  insert into public.ai_tracking_signals(
    signal_key, signal_type, severity, confidence, entity_type, entity_id,
    title, explanation, recommended_action, evidence, last_detected_at, updated_at
  )
  select
    'partner:inactive:'||p.id,
    'partner_inactivity',
    'warning',
    0.95,
    'partner',p.id,
    'Partenaire actif mais inactif',
    'Le partenaire est marqué actif mais aucune activité récente n''a été observée.',
    'Contacter le partenaire, vérifier son objectif et suspendre les dépenses/incitations non justifiées tant qu''aucune activité réelle n''est constatée.',
    jsonb_build_object('partner_code',p.partner_code,'display_name',p.display_name,
      'country_code',p.country_code,'last_activity_at',p.last_activity_at),
    now(),now()
  from public.wassafrica_partners p
  where p.status='active'
    and (p.last_activity_at is null or p.last_activity_at < now()-interval '14 days')
  on conflict (signal_key) do update set
    severity=excluded.severity, confidence=excluded.confidence, entity_type=excluded.entity_type,
    entity_id=excluded.entity_id, title=excluded.title, explanation=excluded.explanation,
    recommended_action=excluded.recommended_action, evidence=excluded.evidence,
    last_detected_at=now(), updated_at=now(), status='open';

  -- Lead backlog: overdue follow-ups are a direct revenue leak.
  insert into public.ai_tracking_signals(
    signal_key, signal_type, severity, confidence, entity_type, entity_id,
    title, explanation, recommended_action, evidence, last_detected_at, updated_at
  )
  select
    'business:lead-backlog:'||l.business_id,
    'lead_backlog',
    case when count(*) >= 10 then 'critical' else 'warning' end,
    least(0.99,0.70+least(count(*),20)/100.0),
    'business',l.business_id,
    'Prospects sans relance',
    'Des prospects ont dépassé leur date de relance et risquent de sortir du tunnel commercial.',
    'Relancer les prospects échus avant toute nouvelle acquisition.',
    jsonb_build_object('overdue_leads',count(*)),
    now(),now()
  from public.leads l
  where l.next_follow_up_at < now()
    and l.status not in ('won','converted','closed','lost')
  group by l.business_id
  having count(*) >= 3
  on conflict (signal_key) do update set
    severity=excluded.severity, confidence=excluded.confidence, title=excluded.title,
    explanation=excluded.explanation, recommended_action=excluded.recommended_action,
    evidence=excluded.evidence,last_detected_at=now(),updated_at=now(),status='open';

  return jsonb_build_object('period_days',d,'signals_refreshed',true);
end
$function$;

revoke execute on function public.ai_refresh_tracking_signals(integer) from public, anon;
grant execute on function public.ai_refresh_tracking_signals(integer) to authenticated;

create or replace function public.admin_ai_tracking_overview(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  d integer := greatest(7, least(coalesce(p_days,30),365));
  result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode='42501', message='admin_required';
  end if;

  perform public.ai_refresh_tracking_signals(d);

  select jsonb_build_object(
    'period_days',d,
    'smartlink_events',(select count(*) from public.smart_link_events where created_at>=now()-make_interval(days=>d)),
    'smartlink_visits',(select count(*) from public.smart_link_events where created_at>=now()-make_interval(days=>d) and event_type in ('view','page_view','landing_view','visit')),
    'smartlink_contacts',(select count(*) from public.smart_link_events where created_at>=now()-make_interval(days=>d) and event_type in ('click','cta_click','contact_click','whatsapp_click')),
    'orders',(select count(*) from public.orders where created_at>=now()-make_interval(days=>d)),
    'paid_orders',(select count(*) from public.orders where created_at>=now()-make_interval(days=>d) and lower(payment_status) in ('paid','succeeded','success')),
    'payment_failures',(select count(*) from public.payment_events where created_at>=now()-make_interval(days=>d) and lower(status) in ('failed','error','declined','cancelled')),
    'overdue_leads',(select count(*) from public.leads where next_follow_up_at<now() and status not in ('won','converted','closed','lost')),
    'active_partners',(select count(*) from public.wassafrica_partners where status='active'),
    'inactive_partners',(select count(*) from public.wassafrica_partners where status='active' and (last_activity_at is null or last_activity_at<now()-interval '14 days')),
    'open_signals',(select count(*) from public.ai_tracking_signals where status='open'),
    'critical_signals',(select count(*) from public.ai_tracking_signals where status='open' and severity='critical'),
    'signals',coalesce((select jsonb_agg(s order by case s.severity when 'critical' then 1 when 'warning' then 2 else 3 end,s.last_detected_at desc) from (
      select id,signal_type,severity,confidence,entity_type,entity_id,title,explanation,recommended_action,evidence,last_detected_at,status
      from public.ai_tracking_signals
      where status='open'
      order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end,last_detected_at desc
      limit 50
    ) s),'[]'::jsonb)
  ) into result;

  return result;
end
$function$;

revoke execute on function public.admin_ai_tracking_overview(integer) from public, anon;
grant execute on function public.admin_ai_tracking_overview(integer) to authenticated;

-- High-cardinality event tables need predictable indexes for the tracking engine.
create index if not exists smart_link_events_created_type_idx
  on public.smart_link_events(created_at desc, event_type);
create index if not exists analytics_events_created_type_idx
  on public.analytics_events(created_at desc, event_type);
create index if not exists payment_events_created_status_idx
  on public.payment_events(created_at desc, status);
create index if not exists leads_followup_status_idx
  on public.leads(next_follow_up_at, status);
create index if not exists partner_activity_partner_time_idx
  on public.wassafrica_partner_activities(partner_id, occurred_at desc);
