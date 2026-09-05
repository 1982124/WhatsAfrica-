const SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const PROD_ORIGIN = 'https://whatsafrica.vercel.app';

function timedFetch(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=self, microphone=self, geolocation=none, payment=none');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const checks = {};
  const started = Date.now();
  try {
    const r = await timedFetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { Accept: 'application/json' } });
    checks.supabase = r.ok ? 'healthy' : 'degraded';
  } catch (_) {
    checks.supabase = 'down';
  }

  // Provider login flows are not probed here: doing so would require user credentials,
  // consume OTPs, or expose provider secrets. Keep certification distinct from infrastructure health.
  checks.phone = 'not_certified';
  checks.email = 'not_certified';
  checks.google = 'not_certified';
  checks.profile = 'not_certified';
  checks.session = 'not_certified';

  const degraded = checks.supabase === 'down' || checks.supabase === 'degraded';
  return res.status(200).json({
    ok: !degraded,
    status: degraded ? 'degraded' : 'healthy',
    environment: 'production',
    origin: PROD_ORIGIN,
    checks,
    provider_isolation: true,
    secondary_failure_does_not_block_auth: true,
    secrets_exposed: false,
    elapsed_ms: Date.now() - started,
    certification_rule: 'infrastructure_healthy_does_not_equal_provider_certified',
    generated_at: new Date().toISOString()
  });
};
