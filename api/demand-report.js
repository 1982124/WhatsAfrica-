const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function unauthorized(res) {
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) return unauthorized(res);
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: 'supabase_env_missing' });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
  const baseHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  const obsUrl = new URL(`${SUPABASE_URL}/rest/v1/demand_observations`);
  obsUrl.searchParams.set('select', 'id,normalized_product,quantity,unit,author_display_name,public_contact,public_contact_type,source_url,source_platform,confidence,location_text,status,observed_at');
  obsUrl.searchParams.set('observed_at', `gte.${start.toISOString()}`);
  obsUrl.searchParams.set('observed_at', `lte.${end.toISOString()}`);
  obsUrl.searchParams.set('status', 'neq.rejected');
  obsUrl.searchParams.set('order', 'observed_at.desc');

  const obsResponse = await fetch(obsUrl, { headers: baseHeaders });
  if (!obsResponse.ok) {
    return res.status(502).json({ ok: false, error: 'observation_query_failed', status: obsResponse.status });
  }
  const observations = await obsResponse.json();

  const groups = new Map();
  for (const item of observations) {
    const key = `${String(item.normalized_product || '').trim().toLowerCase()}|${String(item.unit || '').trim().toLowerCase()}`;
    if (!key || key === '|') continue;
    if (!groups.has(key)) groups.set(key, { product: item.normalized_product, unit: item.unit, quantity: 0, count: 0, contacts: 0, items: [] });
    const g = groups.get(key);
    g.quantity += Number(item.quantity || 0);
    g.count += 1;
    if (item.public_contact) g.contacts += 1;
    g.items.push(item.id);
  }

  const clusters = [...groups.values()].sort((a, b) => b.count - a.count || b.quantity - a.quantity);
  const report = {
    window_start: start.toISOString(),
    window_end: end.toISOString(),
    report_type: 'six_hour',
    status: 'generated',
    demand_count: observations.length,
    cluster_count: clusters.length,
    total_quantity: clusters.reduce((sum, x) => sum + x.quantity, 0),
    summary: { generated_by: 'wassafrica-demand-intelligence', clusters },
  };

  const reportResponse = await fetch(`${SUPABASE_URL}/rest/v1/demand_reports`, {
    method: 'POST', headers: { ...baseHeaders, Prefer: 'return=representation' }, body: JSON.stringify(report),
  });
  if (!reportResponse.ok) {
    return res.status(502).json({ ok: false, error: 'report_insert_failed', status: reportResponse.status });
  }
  const [saved] = await reportResponse.json();

  if (saved && clusters.length) {
    const items = clusters.map((cluster) => ({
      report_id: saved.id,
      priority: cluster.count >= 10 ? 'urgent' : cluster.count >= 5 ? 'high' : 'normal',
      action_status: 'pending',
      notes: `${cluster.count} demande(s), ${cluster.quantity || 0} ${cluster.unit || ''}. Contacts publics détectés: ${cluster.contacts}.`,
    }));
    await fetch(`${SUPABASE_URL}/rest/v1/demand_report_items`, {
      method: 'POST', headers: { ...baseHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(items),
    });
  }

  return res.status(200).json({ ok: true, report_id: saved?.id || null, window_start: start.toISOString(), window_end: end.toISOString(), demand_count: observations.length, cluster_count: clusters.length });
}
