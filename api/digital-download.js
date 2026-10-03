const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

function clean(value, max = 500) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max).trim()
    : '';
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
    const productId = clean(req.body?.product_id, 80);
    if (!entitlementId && !productId) return res.status(400).json({ error: 'Produit ou autorisation de téléchargement requis.' });

    let query = `buyer_user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id,product_id,downloads_count,max_downloads,expires_at,status,buyer_user_id&order=created_at.desc&limit=1`;
    if (entitlementId) query += `&id=eq.${encodeURIComponent(entitlementId)}`;
    else query += `&product_id=eq.${encodeURIComponent(productId)}`;

    const ent = await supabaseFetch(url, serviceKey, `/rest/v1/digital_entitlements?${query}`);
    if (!ent.response.ok) throw new Error(`entitlement_lookup_${ent.response.status}`);
    const entitlement = Array.isArray(ent.data) ? ent.data[0] : null;
    if (!entitlement) return res.status(403).json({ error: 'Accès numérique non autorisé.' });
    if (entitlement.expires_at && new Date(entitlement.expires_at).getTime() <= Date.now()) {
      return res.status(403).json({ error: 'Accès numérique expiré.' });
    }
    if (entitlement.max_downloads !== null && entitlement.downloads_count >= entitlement.max_downloads) {
      return res.status(403).json({ error: 'Limite de téléchargements atteinte.' });
    }

    const product = await supabaseFetch(
      url,
      serviceKey,
      `/rest/v1/products?id=eq.${encodeURIComponent(entitlement.product_id)}&product_type=eq.digital&select=id,title,digital_storage_path,digital_file_name,digital_mime_type,reading_mode&limit=1`,
    );
    if (!product.response.ok) throw new Error(`product_lookup_${product.response.status}`);
    const asset = Array.isArray(product.data) ? product.data[0] : null;
    if (!asset?.digital_storage_path) return res.status(409).json({ error: 'Fichier numérique indisponible.' });

    const claim = await supabaseFetch(url, serviceKey, '/rest/v1/rpc/consume_digital_entitlement', {
      method: 'POST',
      body: JSON.stringify({ p_entitlement_id: entitlement.id, p_user_id: userId }),
    });
    if (!claim.response.ok) throw new Error(`entitlement_claim_${claim.response.status}`);
    const claimed = Array.isArray(claim.data) ? claim.data[0] : claim.data;
    if (!claimed) return res.status(403).json({ error: 'Limite de téléchargements atteinte.' });

    const storagePath = String(asset.digital_storage_path).replace(/^\/+/, '');
    const sign = await supabaseFetch(
      url,
      serviceKey,
      `/storage/v1/object/sign/digital-products/${storagePath.split('/').map(encodeURIComponent).join('/')}`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresIn: 600, download: asset.digital_file_name || true }),
      },
    );
    if (!sign.response.ok) throw new Error(`storage_sign_${sign.response.status}`);

    const signedUrl = sign.data?.signedURL || sign.data?.signedUrl;
    if (!signedUrl) throw new Error('storage_sign_missing_url');

    const absoluteSignedUrl = /^https?:\/\//i.test(signedUrl)
      ? signedUrl
      : `${url}/storage/v1${signedUrl.startsWith('/') ? '' : '/'}${signedUrl}`;

    return res.status(200).json({
      ok: true,
      product_id: asset.id,
      title: asset.title,
      download_url: absoluteSignedUrl,
      url: absoluteSignedUrl,
      file_name: asset.digital_file_name || 'download',
      mime_type: asset.digital_mime_type || 'application/octet-stream',
      reading_mode: asset.reading_mode || null,
      downloads_count: claimed.downloads_count,
      max_downloads: claimed.max_downloads,
      expires_in: 600,
    });
  } catch (error) {
    console.error('digital-download', error?.message || error);
    return res.status(500).json({ error: 'Impossible de préparer le téléchargement.' });
  }
};
