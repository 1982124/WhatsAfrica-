export default async function handler(req, res) {
  const url = String(process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co').trim();
  const publicKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV').trim();
  if (!url || !publicKey) return res.status(503).json({ error: 'admin_service_not_configured' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'authentication_required' });
  const accessToken = auth.slice(7).trim();
  if (!accessToken) return res.status(401).json({ error: 'authentication_required' });
  const base = url.replace(/\/$/, '');

  function claims(token) {
    try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return null; }
  }

  try {
    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action !== 'send_admin_otp') return res.status(400).json({ error: 'invalid_action' });
      const c = claims(accessToken);
      if (!c?.sub || !c?.session_id) return res.status(401).json({ error: 'session_invalid' });
      const userResponse = await fetch(`${base}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(7000) });
      const user = await userResponse.json().catch(() => null);
      if (!userResponse.ok || !user?.id || !user?.email || user.id !== c.sub) return res.status(401).json({ error: 'authentication_required' });
      const adminRpc = await fetch(`${base}/rest/v1/rpc/is_platform_admin`, { method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(7000) });
      const admin = await adminRpc.json().catch(() => null);
      if (!adminRpc.ok || admin !== true) return res.status(403).json({ error: 'forbidden' });
      const codeArray = new Uint32Array(1); crypto.getRandomValues(codeArray); const code = String(100000 + (codeArray[0] % 900000));
      const challengeRpc = await fetch(`${base}/rest/v1/rpc/request_admin_email_otp`, { method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_session_id: c.session_id, p_code: code }), signal: AbortSignal.timeout(7000) });
      const challenge = await challengeRpc.json().catch(() => null);
      if (!challengeRpc.ok) return res.status(400).json({ error: challenge?.message || 'otp_challenge_failed' });
      const resendKey = String(process.env.RESEND_API_KEY || '').trim();
      if (!resendKey) return res.status(503).json({ error: 'email_provider_not_configured' });
      const from = String(process.env.ADMIN_OTP_FROM || 'WhatsAfrica <onboarding@resend.dev>').trim();
      const emailResponse = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [user.email], subject: 'Votre code de sécurité WhatsAfrica', text: `Votre code de sécurité administrateur WhatsAfrica est : ${code}\n\nCe code reste valable pendant 10 minutes. Vous pouvez le réutiliser pendant cette période.`, html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>WhatsAfrica — Sécurité administrateur</h2><p>Votre code de sécurité est :</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:18px;border:1px solid #ddd;border-radius:12px">${code}</div><p>Ce code reste valable pendant <b>10 minutes</b>. Vous pouvez le réutiliser pendant cette période.</p></div>` }), signal: AbortSignal.timeout(10000) });
      if (!emailResponse.ok) { console.error('admin-overview otp resend', emailResponse.status, await emailResponse.text().catch(() => '')); return res.status(502).json({ error: 'email_send_failed' }); }
      return res.status(200).json({ ok: true, challenge_id: challenge });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    const rpc = await fetch(`${base}/rest/v1/rpc/platform_admin_overview`, { method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}', signal: AbortSignal.timeout(7000) });
    const raw = await rpc.text(); let payload = null; try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }
    if (rpc.ok) { res.setHeader('Cache-Control', 'private, no-store, max-age=0'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-WassAfrica-Admin-API', 'ok'); return res.status(200).json(payload || {}); }
    const pgCode = payload?.code || ''; const pgMessage = String(payload?.message || '').toLowerCase();
    if (rpc.status === 401 || pgCode === 'PGRST301' || /jwt|authentication|session/.test(pgMessage)) return res.status(401).json({ error: 'invalid_session' });
    if (rpc.status === 403 || /forbidden|not authorized|permission denied/.test(pgMessage)) return res.status(403).json({ error: 'forbidden' });
    if (/email_mfa_required|mfa_required/.test(pgMessage)) return res.status(403).json({ error: 'email_mfa_required' });
    console.error('admin-overview rpc', rpc.status, payload || raw.slice(0, 500)); return res.status(503).json({ error: 'admin_service_unavailable' });
  } catch (e) { console.error('admin-overview', e); return res.status(503).json({ error: 'admin_service_unavailable' }); }
}
