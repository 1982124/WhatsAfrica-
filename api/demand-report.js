const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const DEFAULT_RECIPIENT = process.env.DEMAND_REPORT_EMAIL || 'neodigitalstartupacademy@gmail.com';

function csv(value) { return String(value || '').split(',').map((x) => x.trim()).filter(Boolean); }
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function matchesZone(locationText, zones) { if (!zones.length) return true; const value = normalize(locationText); return zones.some((zone) => value.includes(normalize(zone))); }
function matchesProduct(productName, filters) { if (!filters.length) return true; const value = normalize(productName); return filters.some((filter) => value.includes(normalize(filter))); }

async function isAdminBearer(auth) {
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, reason: 'missing_bearer' };
  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, reason: 'empty_bearer' };
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return { ok: false, status: 503, reason: 'supabase_server_env_missing' };
  if (!SUPABASE_PUBLISHABLE_KEY) return { ok: false, status: 503, reason: 'supabase_publishable_key_missing' };

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    cache: 'no-store',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) {
    console.warn('[demand-report] bearer rejected by Supabase Auth', userResponse.status);
    return { ok: false, status: 401, reason: 'invalid_or_expired_token' };
  }

  const user = await userResponse.json().catch(() => null);
  const userId = user?.id;
  if (!userId) return { ok: false, status: 401, reason: 'auth_user_missing' };

  const adminUrl = new URL(`${SUPABASE_URL}/rest/v1/platform_admins`);
  adminUrl.searchParams.set('select', 'user_id');
  adminUrl.searchParams.set('user_id', `eq.${userId}`);
  adminUrl.searchParams.set('limit', '1');
  const adminResponse = await fetch(adminUrl, {
    cache: 'no-store',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  if (!adminResponse.ok) {
    console.error('[demand-report] platform admin lookup failed', adminResponse.status);
    return { ok: false, status: 503, reason: 'admin_lookup_failed' };
  }
  const admins = await adminResponse.json().catch(() => []);
  if (!Array.isArray(admins) || admins.length === 0) return { ok: false, status: 403, reason: 'platform_admin_required' };
  return { ok: true, userId };
}

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
async function sendEmail({ subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DEMAND_REPORT_FROM || 'WassAfrica Intelligence <onboarding@resend.dev>';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY_missing' };
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [DEFAULT_RECIPIENT], subject, html, text }) });
  if (!response.ok) return { sent: false, reason: `resend_${response.status}` };
  const data = await response.json();
  return { sent: true, id: data.id || null };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const cronAuthorized = Boolean(secret && auth === `Bearer ${secret}`);
  if (!cronAuthorized) {
    const authz = await isAdminBearer(auth).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'authorization_error' }));
    if (!authz.ok) {
      console.warn('[demand-report] unauthorized request', authz.reason);
      return res.status(authz.status).json({ ok: false, error: authz.status === 403 ? 'forbidden' : authz.reason });
    }
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ ok: false, error: 'supabase_env_missing' });

  const end = new Date();
  const requestedHours = Number(req.query?.hours || 6);
  const hours = Number.isFinite(requestedHours) && requestedHours > 0 && requestedHours <= 168 ? requestedHours : 6;
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  const requestedZones = csv(req.query?.zones);
  const configuredZones = csv(process.env.DEMAND_ZONES);
  const zones = requestedZones.length ? requestedZones : configuredZones;
  const countries = csv(req.query?.countries || process.env.DEMAND_COUNTRIES);
  const requestedProducts = csv(req.query?.products || req.query?.product);
  const configuredProducts = csv(process.env.DEMAND_PRODUCTS);
  const products = requestedProducts.length ? requestedProducts : configuredProducts;
  const locationFilters = [...zones, ...countries];
  const baseHeaders = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const obsUrl = new URL(`${SUPABASE_URL}/rest/v1/demand_observations`);
  obsUrl.searchParams.set('select', 'id,normalized_product,quantity,unit,author_display_name,public_contact,public_contact_type,source_url,source_platform,confidence,location_text,status,observed_at');
  obsUrl.searchParams.set('observed_at', `gte.${start.toISOString()}`);
  obsUrl.searchParams.set('observed_at', `lte.${end.toISOString()}`);
  obsUrl.searchParams.set('status', 'neq.rejected');
  obsUrl.searchParams.set('order', 'observed_at.desc');
  const obsResponse = await fetch(obsUrl, { headers: baseHeaders });
  if (!obsResponse.ok) return res.status(502).json({ ok: false, error: 'observation_query_failed', status: obsResponse.status });
  let observations = await obsResponse.json();
  if (locationFilters.length) observations = observations.filter((item) => matchesZone(item.location_text, locationFilters));
  if (products.length) observations = observations.filter((item) => matchesProduct(item.normalized_product, products));
  const groups = new Map();
  for (const item of observations) {
    const key = `${normalize(item.normalized_product)}|${normalize(item.unit)}`;
    if (!key || key === '|') continue;
    if (!groups.has(key)) groups.set(key, { product: item.normalized_product, unit: item.unit, quantity: 0, count: 0, contacts: 0, items: [] });
    const g = groups.get(key);
    g.quantity += Number(item.quantity || 0); g.count += 1; if (item.public_contact) g.contacts += 1; g.items.push(item.id);
  }
  const clusters = [...groups.values()].sort((a, b) => b.count - a.count || b.quantity - a.quantity);
  const scopeLabel = locationFilters.length ? locationFilters.join(', ') : 'Toutes zones';
  const productLabel = products.length ? products.join(', ') : 'Tous produits / besoins';
  const report = { window_start: start.toISOString(), window_end: end.toISOString(), report_type: 'six_hour', status: 'generated', scope: { zones, countries, products }, demand_count: observations.length, cluster_count: clusters.length, total_quantity: clusters.reduce((sum, x) => sum + x.quantity, 0), summary: { generated_by: 'wassafrica-demand-intelligence', scope: scopeLabel, products: productLabel, hours, clusters } };
  const reportResponse = await fetch(`${SUPABASE_URL}/rest/v1/demand_reports`, { method: 'POST', headers: { ...baseHeaders, Prefer: 'return=representation' }, body: JSON.stringify(report) });
  if (!reportResponse.ok) return res.status(502).json({ ok: false, error: 'report_insert_failed', status: reportResponse.status });
  const [saved] = await reportResponse.json();
  if (saved && clusters.length) {
    const items = clusters.map((cluster) => ({ report_id: saved.id, priority: cluster.count >= 10 ? 'urgent' : cluster.count >= 5 ? 'high' : 'normal', action_status: 'pending', notes: `${cluster.count} demande(s), ${cluster.quantity || 0} ${cluster.unit || ''}. Contacts publics détectés: ${cluster.contacts}.` }));
    await fetch(`${SUPABASE_URL}/rest/v1/demand_report_items`, { method: 'POST', headers: { ...baseHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(items) });
  }
  const lines = clusters.map((x) => `- ${x.product}: ${x.quantity || 0} ${x.unit || ''} — ${x.count} demande(s) — ${x.contacts} contact(s) public(s)`);
  const text = ['WASSAFRICA — RAPPORT DES BESOINS', `Période: ${start.toISOString()} → ${end.toISOString()}`, `Durée: ${hours} h`, `Zone(s): ${scopeLabel}`, `Produit(s) ciblé(s): ${productLabel}`, `Demandes: ${observations.length}`, `Produits regroupés: ${clusters.length}`, '', ...(lines.length ? lines : ['Aucune demande détectée sur ce périmètre.']), '', `Rapport ID: ${saved?.id || 'n/a'}`].join('\n');
  const html = `<h2>WASSAFRICA — Rapport des besoins</h2><p><b>Période :</b> ${escapeHtml(start.toISOString())} → ${escapeHtml(end.toISOString())}</p><p><b>Durée :</b> ${hours} h · <b>Zone(s) :</b> ${escapeHtml(scopeLabel)}</p><p><b>Produit(s) ciblé(s) :</b> ${escapeHtml(productLabel)}</p><p><b>Demandes :</b> ${observations.length} · <b>Produits regroupés :</b> ${clusters.length}</p><ul>${clusters.length ? clusters.map((x) => `<li><b>${escapeHtml(x.product)}</b> — ${escapeHtml(x.quantity || 0)} ${escapeHtml(x.unit || '')} — ${x.count} demande(s) — ${x.contacts} contact(s) public(s)</li>`).join('') : '<li>Aucune demande détectée sur ce périmètre.</li>'}</ul><p>Rapport ID : ${escapeHtml(saved?.id || 'n/a')}</p>`;
  const email = await sendEmail({ subject: `WassAfrica — demandes — ${productLabel} — ${scopeLabel}`, html, text });
  return res.status(200).json({ ok: true, report_id: saved?.id || null, window_start: start.toISOString(), window_end: end.toISOString(), scope: { zones, countries, products }, hours, demand_count: observations.length, cluster_count: clusters.length, email });
}
