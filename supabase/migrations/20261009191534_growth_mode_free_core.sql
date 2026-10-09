-- WASSAFRICA growth mode: keep the core product free while acquisition is the priority.
-- AI remains free with a fair monthly allowance; this does not promise unlimited paid compute.
begin;

update public.subscription_plans
set
  monthly_price_xof = 0,
  is_active = (code = 'free'),
  features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
    'smartlink', true,
    'marketplace', true,
    'physical_products', true,
    'digital_products', true,
    'digital_collections', true,
    'services', true,
    'messages', true,
    'calls', true,
    'groups', true,
    'assistant', true,
    'crm', true,
    'advanced_ai', true,
    'ai_visual_studio', true,
    'advanced_analytics', true,
    'marketplace_boost', true,
    'ai_monthly_credits', 50
  )
where code = 'free';

update public.subscription_plans
set monthly_price_xof = 0, is_active = false
where code <> 'free';

comment on table public.subscription_plans is
  'WASSAFRICA plans. Growth mode: only the free plan is active; core features are available at 0 XOF. AI has a fair monthly allowance rather than unlimited compute.';

commit;
