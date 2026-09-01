export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const url = String(process.env.SUPABASE_URL || '').trim();
  // Prefer the current Supabase server-side secret key; retain legacy service_role compatibility.
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !secretKey) return res.status(503).json({ error: 'admin_service_not_configured' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'authentication_required' });
  const accessToken = auth.slice(7).trim();
  if (!accessToken) return res.status(401).json({ error: 'authentication_required' });

  const common = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  try {
    const me = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: secretKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(3500)
    });
    if (!me.ok) return res.status(401).json({ error: 'invalid_session' });
    const user = await me.json();
    if (!user?.id) return res.status(401).json({ error: 'invalid_session' });

    const admin = await fetch(`${url.replace(/\/$/, '')}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`, {
      headers: common, signal: AbortSignal.timeout(3500)
    });
    if (!admin.ok) return res.status(403).json({ error: 'forbidden' });
    const rows = await admin.json();
    if (!Array.isArray(rows) || rows.length !== 1) return res.status(403).json({ error: 'forbidden' });

    const tables = ['businesses','products','groups','messages_v2','orders','reports','business_live_sessions'];
    const counts = await Promise.all(tables.map(async table => {
      const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=1`, {
        method: 'HEAD', headers: { ...common, Prefer: 'count=exact' }, signal: AbortSignal.timeout(3500)
      });
      if (!r.ok) throw new Error(`count_failed:${table}`);
      const range = r.headers.get('content-range') || '*/0';
      return [table, Number(range.split('/')[1] || 0)];
    }));
    const users = await fetch(`${url.replace(/\/$/, '')}/rest/v1/profiles?select=id&limit=1`, {
      method: 'HEAD', headers: { ...common, Prefer: 'count=exact' }, signal: AbortSignal.timeout(3500)
    });
    if (!users.ok) throw new Error('count_failed:users');
    const userRange = users.headers.get('content-range') || '*/0';
    const out = Object.fromEntries(counts);
    out.users = Number(userRange.split('/')[1] || 0);
    out.open_reports = out.reports;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json(out);
  } catch (e) {
    console.error('admin-overview', e);
    return res.status(503).json({ error: 'admin_service_unavailable' });
  }
}
