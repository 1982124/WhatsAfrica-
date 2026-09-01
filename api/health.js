const startedAt = Date.now();

module.exports = async function handler(req, res) {
  const checks = { runtime: 'ok', database: 'unknown' };
  let status = 200;

  try {
    const url = process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
    const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const r = await fetch(`${url}/rest/v1/businesses?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    checks.database = r.ok ? 'ok' : 'degraded';
    if (!r.ok) status = 503;
  } catch (_) {
    checks.database = 'degraded';
    status = 503;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).json({
    status: status === 200 ? 'ok' : 'degraded',
    service: 'whatsafrica',
    version: 'health-v1',
    checks,
    uptime_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
};
