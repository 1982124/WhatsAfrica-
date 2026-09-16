export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'authentication_required' });
  const accessToken = auth.slice(7).trim();
  if (!accessToken) return res.status(401).json({ error: 'authentication_required' });

  const url = String(process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co').trim().replace(/\/$/, '');
  const publicKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV'
  ).trim();
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.ADMIN_OTP_FROM || 'WhatsAfrica <onboarding@resend.dev>').trim();

  if (!url || !publicKey || !resendKey) return res.status(503).json({ error: 'email_provider_not_configured' });

  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(7000)
    });
    const user = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !user?.id || !user?.email) return res.status(401).json({ error: 'authentication_required' });

    const adminRpc = await fetch(`${url}/rest/v1/rpc/is_platform_admin`, {
      method: 'POST',
      headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(7000)
    });
    const admin = await adminRpc.json().catch(() => null);
    if (!adminRpc.ok || admin !== true) return res.status(403).json({ error: 'forbidden' });

    const sessionId = user?.session_id;
    if (!sessionId) return res.status(401).json({ error: 'session_invalid' });

    const codeArray = new Uint32Array(1);
    crypto.getRandomValues(codeArray);
    const code = String(100000 + (codeArray[0] % 900000));

    const challengeRpc = await fetch(`${url}/rest/v1/rpc/request_admin_email_otp`, {
      method: 'POST',
      headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session_id: sessionId, p_code: code }),
      signal: AbortSignal.timeout(7000)
    });
    const challenge = await challengeRpc.json().catch(() => null);
    if (!challengeRpc.ok) return res.status(400).json({ error: challenge?.message || 'otp_challenge_failed' });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: 'Votre code de sécurité WhatsAfrica',
        text: `Votre code de sécurité administrateur WhatsAfrica est : ${code}\n\nCe code expire dans 10 minutes et ne peut être utilisé qu'une seule fois.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>WhatsAfrica — Sécurité administrateur</h2><p>Votre code de sécurité est :</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:18px;border:1px solid #ddd;border-radius:12px">${code}</div><p>Ce code expire dans <b>10 minutes</b> et ne peut être utilisé qu'une seule fois.</p></div>`
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!emailResponse.ok) {
      console.error('admin-send-otp resend', emailResponse.status, await emailResponse.text().catch(() => ''));
      return res.status(502).json({ error: 'email_send_failed' });
    }

    return res.status(200).json({ ok: true, challenge_id: challenge });
  } catch (error) {
    console.error('admin-send-otp', error);
    return res.status(503).json({ error: 'admin_email_service_unavailable' });
  }
}
