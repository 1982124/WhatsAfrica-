const { createClient } = require('@supabase/supabase-js');

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

function clean(value, max = 500) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max).trim() : '';
}

function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 120);
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= WINDOW_MS) bucket = { start: now, count: 0 };
  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (rateLimited(req)) return res.status(429).json({ error: 'Trop de demandes. Réessayez dans une minute.' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Service de téléchargement indisponible.' });

  const authHeader = String(req.headers.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Connexion requise.' });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(match[1]);
  const userId = userData?.user?.id;
  if (userError || !userId) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  const entitlementId = clean(req.body?.entitlement_id, 80);
  if (!entitlementId) return res.status(400).json({ error: 'Autorisation de téléchargement requise.' });

  try {
    const { data, error } = await supabase.rpc('consume_digital_entitlement', {
      p_entitlement_id: entitlementId,
      p_user_id: userId,
    });
    if (error) throw error;

    const asset = Array.isArray(data) ? data[0] : null;
    if (!asset?.storage_path) return res.status(403).json({ error: 'Téléchargement non autorisé, expiré ou quota atteint.' });

    const { data: signed, error: signError } = await supabase.storage
      .from('digital-products')
      .createSignedUrl(asset.storage_path, 600, { download: asset.file_name || true });
    if (signError || !signed?.signedUrl) return res.status(503).json({ error: 'Impossible de préparer le téléchargement.' });

    return res.status(200).json({
      download_url: signed.signedUrl,
      file_name: asset.file_name || 'download',
      mime_type: asset.mime_type || 'application/octet-stream',
      expires_in: 600,
    });
  } catch (error) {
    console.error('digital-download', error?.message || error);
    return res.status(500).json({ error: 'Impossible de préparer le téléchargement.' });
  }
};
