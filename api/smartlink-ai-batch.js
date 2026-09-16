const MAX_ITEMS = 10;
const MIN_ITEMS = 1;
const CONCURRENCY = 3;
const SUPABASE_URL = 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return res.end(JSON.stringify(body));
}

async function requireUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return r.json();
}

async function analyzeOne(url, token) {
  const r = await fetch('https://wassafrica.vercel.app/api/smartlink-ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url })
  });
  let data;
  try { data = await r.json(); } catch (_) { data = { ok: false, error: 'Réponse IA illisible.' }; }
  return { url, ok: Boolean(r.ok && data?.ok), status: r.status, source: data?.source || null, draft: data?.draft || null, error: data?.error || null };
}

async function runPool(items, workerCount, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function workerLoop() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { out[i] = await worker(items[i], i); }
      catch (e) { out[i] = { url: items[i], ok: false, status: 502, source: null, draft: null, error: String(e?.message || 'Analyse impossible.') }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, workerLoop));
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Méthode non autorisée.' });
  try {
    const user = await requireUser(req);
    if (!user?.id) return json(res, 401, { ok: false, error: 'Connectez-vous pour utiliser Smart Link IA.' });
    const raw = req.body?.urls;
    if (!Array.isArray(raw)) return json(res, 400, { ok: false, error: 'Envoyez un tableau de 1 à 10 liens dans "urls".' });
    const urls = [...new Set(raw.map(x => String(x || '').trim()).filter(Boolean))];
    if (urls.length < MIN_ITEMS || urls.length > MAX_ITEMS) return json(res, 400, { ok: false, error: 'Vous pouvez importer de 1 à 10 liens à la fois.' });
    const invalid = urls.findIndex(url => !/^https?:\/\//i.test(url) || url.length > 2048);
    if (invalid >= 0) return json(res, 400, { ok: false, error: `Le lien n°${invalid + 1} est invalide ou trop long.` });
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const results = await runPool(urls, CONCURRENCY, (url) => analyzeOne(url, token));
    return json(res, 200, { ok: true, count: results.length, successCount: results.filter(x => x.ok).length, failedCount: results.filter(x => !x.ok).length, results });
  } catch (error) {
    return json(res, 422, { ok: false, error: String(error?.message || 'Import groupé impossible.').slice(0, 300) });
  }
};
