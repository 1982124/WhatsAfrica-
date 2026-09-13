-- WASSAFRICA: canonical public Smart Link plans.
-- Free remains free; Starter and Pro are the only active paid tiers.
-- Legacy plan codes are preserved for compatibility but Premium is retired.

update public.subscription_plans
set monthly_price_xof = 2500,
    name = 'Starter'
where code = 'starter';

update public.subscription_plans
set name = 'Pro',
    monthly_price_xof = 7500,
    ads_enabled = false,
    features = '{"crm":true,"calls":true,"groups":true,"messages":true,"services":true,"assistant":true,"smartlink":true,"marketplace":true,"digital_products":true,"physical_products":true,"marketplace_boost":true,"advanced_analytics":true,"advanced_ai":true,"digital_collections":true}'::jsonb,
    is_active = true
where code = 'business';

update public.subscription_plans
set is_active = false
where code = 'premium';
