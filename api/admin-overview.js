export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const url = String(process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co').trim();
  const publicKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV'
  ).trim();
  if (!url || !publicKey) return res.status(503).json({ error: 'admin_service_not_configured' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'authentication_required' });
  const accessToken = auth.slice(7).trim();
  if (!accessToken) return res.status(401).json({ error: 'authentication_required' });

  const base = url.replace(/\/$/, '');
  try {
    const rpc = await fetch(`${base}/rest/v1/rpc/platform_admin_overview`, {
      method: 'POST',
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: '{}',
      signal: AbortSignal.timeout(7000)
    });

    const raw = await rpc.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }

    if (rpc.ok) {
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-WassAfrica-Admin-API', 'ok');
      return res.status(200).json(payload || {});
    }

    const pgCode = payload?.code || '';
    const pgMessage = String(payload?.message || '').toLowerCase();
    if (rpc.status === 401 || pgCode === 'PGRST301' || /jwt|authentication|session/.test(pgMessage)) {
      return res.status(401).json({ error: 'invalid_session' });
    }
    if (rpc.status === 403 || /forbidden|not authorized|permission denied/.test(pgMessage)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (/email_mfa_required|mfa_required/.test(pgMessage)) {
      return res.status(403).json({ error: 'email_mfa_required' });
    }

    console.error('admin-overview rpc', rpc.status, payload || raw.slice(0, 500));
    return res.status(503).json({ error: 'admin_service_unavailable' });
  } catch (e) {
    console.error('admin-overview', e);
    return res.status(503).json({ error: 'admin_service_unavailable' });
  }
}
