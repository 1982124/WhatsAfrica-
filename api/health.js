const startedAt = Date.now();

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
  res.setHeader('X-WhatsAfrica-Health', 'v3');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', error: 'Méthode non autorisée.' });
  }

  const url = clean(process.env.SUPABASE_URL);
  const key = String(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();

  const checks = {
    runtime: 'ok',
    configuration: 'unknown',
    database: 'unknown',
    auth: 'unknown',
    apis: 'unknown',
    storage: 'not_checked',
    realtime: 'not_checked',
  };

  let status = 200;

  // Production health must not silently pass because of hardcoded credentials.
  checks.configuration = isValidSupabaseUrl(url) && key.length >= 20 ? 'ok' : 'degraded';
  if (checks.configuration !== 'ok') status = 503;

  if (checks.configuration === 'ok') {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
    };

    try {
      const [businesses, products, services] = await Promise.all([
        timedFetch(`${url}/rest/v1/businesses?select=id&limit=1`, { headers }),
        timedFetch(`${url}/rest/v1/products?select=id&status=eq.published&limit=1`, { headers }),
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

    // Supabase Auth exposes its public settings endpoint. This validates that
    // the authentication service is reachable without exposing secrets.
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

  // Storage and Realtime are intentionally reported as not_checked here:
  // a publishable key cannot safely perform privileged bucket inspection or
  // websocket verification. They should be monitored by authenticated probes.

  return res.status(status).json({
    status: status === 200 ? 'ok' : 'degraded',
    service: 'whatsafrica',
    version: 'health-v3',
    checks,
    uptime_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
};
