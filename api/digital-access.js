const SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control','private, no-store, max-age=0').json(body);
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return json(res, 401, { error: 'authentication_required' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json(res, 503, { error: 'digital_delivery_not_configured' });

  const token = auth.slice(7).trim();
  if (!token) return json(res, 401, { error: 'authentication_required' });

  const productId = String(req.body?.product_id || '').trim();
  const entitlementId = String(req.body?.entitlement_id || '').trim();
  const mode = req.body?.mode === 'reader' ? 'reader' : 'download';
  if (!entitlementId || !/^[0-9a-f-]{36}$/i.test(entitlementId)) {
    return json(res, 400, { error: 'invalid_entitlement' });
  }

  const userResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }
  });
  if (!userResp.ok) return json(res, 401, { error: 'invalid_session' });
  const user = await userResp.json();

  const rpc = await fetch(SUPABASE_URL + '/rest/v1/rpc/consume_digital_entitlement', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_entitlement_id: entitlementId, p_user_id: user.id })
  });
  if (!rpc.ok) return json(res, 403, { error: 'digital_access_denied' });

  const rows = await rpc.json();
  const item = Array.isArray(rows) ? rows[0] : rows;
  if (!item || !item.digital_storage_path) return json(res, 404, { error: 'digital_file_unavailable' });
  if (productId && item.product_id !== productId) return json(res, 403, { error: 'product_mismatch' });

  const bucket = 'digital-products';
  const storagePath = String(item.digital_storage_path).replace(/^\/+/, '');
  const sign = await fetch(
    SUPABASE_URL + '/storage/v1/object/sign/' + encodeURIComponent(bucket) + '/' +
      storagePath.split('/').map(encodeURIComponent).join('/'),
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: mode === 'reader' ? 900 : 300 })
    }
  );
  if (!sign.ok) return json(res, 502, { error: 'signed_url_failed' });

  const signed = await sign.json();
  const signedURL = signed.signedURL || signed.signedUrl;
  if (!signedURL) return json(res, 502, { error: 'signed_url_missing' });

  const absolute = signedURL.startsWith('http')
    ? signedURL
    : SUPABASE_URL + '/storage/v1' + (signedURL.startsWith('/') ? signedURL : '/' + signedURL);

  return json(res, 200, {
    url: absolute,
    file_name: item.digital_file_name || 'document',
    mime_type: item.digital_mime_type || 'application/octet-stream',
    reading_mode: item.reading_mode || 'download',
    downloads_count: item.downloads_count,
    max_downloads: item.max_downloads
  });
}

module.exports = handler;
