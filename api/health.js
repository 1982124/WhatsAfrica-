const startedAt = Date.now();
const DEFAULT_SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';

function clean(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function isValidSupabaseUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co');
  } catch (_) {
    return false;
  }
}

async function timedFetch(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-WhatsAfrica-Health', 'v4');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', error: 'Méthode non autorisée.' });
  }

  const envUrl = clean(process.env.SUPABASE_URL);
  const envKey = String(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();
  const usingFallback = !envUrl || !envKey;
  const url = envUrl || DEFAULT_SUPABASE_URL;
  const key = envKey || DEFAULT_PUBLISHABLE_KEY;

  const checks = {
    runtime: 'ok',
    configuration: isValidSupabaseUrl(url) && key.length >= 20 ? 'ok' : 'degraded',
    database: 'unknown',
    auth: 'unknown',
    apis: 'unknown',
    storage: 'not_checked',
    realtime: 'not_checked',
  };

  let status = checks.configuration === 'ok' ? 200 : 503;

  if (checks.configuration === 'ok') {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
    };

    try {
      // Keep these probes aligned with the actual production schema:
      // products uses is_published (not status).
      const [businesses, products, services] = await Promise.all([
        timedFetch(`${url}/rest/v1/businesses?select=id&limit=1`, { headers }),
        timedFetch(`${url}/rest/v1/products?select=id&is_published=eq.true&limit=1`, { headers }),
        timedFetch(`${url}/rest/v1/marketplace_services?select=id&status=eq.published&limit=1`, { headers }),
      ]);

      checks.database = businesses.ok ? 'ok' : 'degraded';
      checks.apis = products.ok && services.ok ? 'ok' : 'degraded';
      if (!businesses.ok || !products.ok || !services.ok) status = 503;
    } catch (_) {
      checks.database = 'degraded';
      checks.apis = 'degraded';
      status = 503;
    }

    try {
      const auth = await timedFetch(`${url}/auth/v1/settings`, {
        headers: { apikey: key },
      });
      checks.auth = auth.ok ? 'ok' : 'degraded';
      if (!auth.ok) status = 503;
    } catch (_) {
      checks.auth = 'degraded';
      status = 503;
    }
  }

  return res.status(status).json({
    status: status === 200 ? 'ok' : 'degraded',
    service: 'whatsafrica',
    version: 'health-v4',
    checks,
    configuration_source: usingFallback ? 'publishable_fallback' : 'vercel_environment',
    checks_note: 'storage/realtime nécessitent des probes dédiées; non vérifiés par cette sonde publique.',
    uptime_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
};
