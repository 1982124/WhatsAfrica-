export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const url = String(process.env.SUPABASE_URL || '').trim();
  const publicKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV').trim();
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
        'Content-Type': 'application/json'
      },
      body: '{}',
      signal: AbortSignal.timeout(5000)
    });
    if (rpc.status === 401) return res.status(401).json({ error: 'invalid_session' });
    if (rpc.status === 403) return res.status(403).json({ error: 'forbidden' });
    if (!rpc.ok) {
      console.error('admin-overview rpc', rpc.status, await rpc.text());
      return res.status(503).json({ error: 'admin_service_unavailable' });
    }
    const out = await rpc.json();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json(out);
  } catch (e) {
    console.error('admin-overview', e);
    return res.status(503).json({ error: 'admin_service_unavailable' });
  }
}
