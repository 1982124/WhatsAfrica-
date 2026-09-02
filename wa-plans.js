/* WhatsAfrica — central plan/feature client helper. Server-side RPC remains authoritative. */
(function (global) {
  'use strict';
  const DEFAULTS = {
    free: { name: 'Free', monthly_price_xof: 0, ads_enabled: true },
    business: { name: 'Business', monthly_price_xof: 3500, ads_enabled: false },
    premium: { name: 'Premium', monthly_price_xof: 10000, ads_enabled: false }
  };
  async function getPlans(db) {
    if (!db) throw new Error('Client Supabase requis');
    const r = await db.from('subscription_plans').select('code,name,monthly_price_xof,ads_enabled,features').eq('is_active', true).order('monthly_price_xof');
    if (r.error) throw r.error;
    return r.data || [];
  }
  async function getCurrentPlan(db) {
    if (!db) return 'free';
    const r = await db.rpc('current_user_plan');
    if (r.error) return 'free';
    return r.data || 'free';
  }
  async function canUseFeature(db, feature) {
    if (!db || !feature) return false;
    const r = await db.rpc('user_can_use_feature', { p_feature: feature });
    return r.error ? false : r.data === true;
  }
  function formatXof(value) { return new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA/mois'; }
  global.WA_PLANS = { DEFAULTS, getPlans, getCurrentPlan, canUseFeature, formatXof };
})(window);
