const startedAt = Date.now();
const DEFAULT_SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', error: 'Méthode non autorisée.' });
  }

  const checks = { runtime: 'ok', configuration: 'ok', database: 'unknown' };
  let status = 200;
  const url = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY).trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/businesses?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    checks.database = r.ok ? 'ok' : 'degraded';
    if (!r.ok) status = 503;
  } catch (_) {
    checks.database = 'degraded';
    status = 503;
  } finally {
    clearTimeout(timer);
  }

  return res.status(status).json({
    status: status === 200 ? 'ok' : 'degraded',
    service: 'whatsafrica',
    version: 'health-v2',
    checks,
    uptime_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
};
