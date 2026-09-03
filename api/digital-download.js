const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

function clean(value, max = 500) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max).trim() : '';
}

function rateLimited(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 120);
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= WINDOW_MS) bucket = { start: now, count: 0 };
  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > MAX_REQUESTS;
}

async function supabaseFetch(url, key, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${url}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { response, data, text };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (rateLimited(req)) return res.status(429).json({ error: 'Trop de demandes. Réessayez dans une minute.' });

  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Service de téléchargement indisponible.' });

  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Connexion requise.' });

  try {
    const token = match[1].trim();
    const auth = await supabaseFetch(url, serviceKey, '/auth/v1/user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userId = auth.data?.id;
    if (!auth.response.ok || !userId) return res.status(401).json({ error: 'Session invalide ou expirée.' });

    const entitlementId = clean(req.body?.entitlement_id, 80);
    if (!entitlementId) return res.status(400).json({ error: 'Autorisation de téléchargement requise.' });

    const rpc = await supabaseFetch(url, serviceKey, '/rest/v1/rpc/consume_digital_entitlement', {
      method: 'POST',
      body: JSON.stringify({ p_entitlement_id: entitlementId, p_user_id: userId }),
    });
    if (!rpc.response.ok) throw new Error(`entitlement_rpc_${rpc.response.status}`);

    const asset = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    if (!asset?.storage_path) return res.status(403).json({ error: 'Téléchargement non autorisé, expiré ou quota atteint.' });

    const storagePath = String(asset.storage_path).replace(/^\/+/, '');
    const sign = await supabaseFetch(
      url,
      serviceKey,
      `/storage/v1/object/sign/digital-products/${storagePath.split('/').map(encodeURIComponent).join('/')}`,
      {
        method: 'POST',
        body: JSON.stringify({
          expiresIn: 600,
          download: asset.file_name || true,
        }),
      },
    );
    if (!sign.response.ok) throw new Error(`storage_sign_${sign.response.status}`);

    const signedUrl = sign.data?.signedURL || sign.data?.signedUrl;
    if (!signedUrl) throw new Error('storage_sign_missing_url');

    const absoluteSignedUrl = /^https?:\/\//i.test(signedUrl)
      ? signedUrl
      : `${url}/storage/v1${signedUrl.startsWith('/') ? '' : '/'}${signedUrl}`;

    return res.status(200).json({
      download_url: absoluteSignedUrl,
      file_name: asset.file_name || 'download',
      mime_type: asset.mime_type || 'application/octet-stream',
      expires_in: 600,
    });
  } catch (error) {
    console.error('digital-download', error?.message || error);
    return res.status(500).json({ error: 'Impossible de préparer le téléchargement.' });
  }
};
