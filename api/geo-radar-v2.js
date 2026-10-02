const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';

const clean = (v, n = 500) => String(v ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const arr = v => [...new Set(String(v || '').split(',').map(x => clean(x, 120)).filter(Boolean))].slice(0, 50);
const json = v => { try { return JSON.parse(String(v || '')); } catch { return null; } };
const urlOf = v => { try { const u = new URL(String(v || '')); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };

async function admin(auth) {
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, reason: 'missing_bearer' };
  const token = auth.slice(7).trim();
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!r.ok) return { ok: false, status: 401, reason: 'invalid_or_expired_token' };
  const u = await r.json().catch(() => null);
  return u?.id ? { ok: true, token } : { ok: false, status: 401, reason: 'auth_user_missing' };
}

async function openaiSearch({ hours, locations, products }) {
  const key = process.env.OPENAI_API_KEY || process.env.wassAfrica;
  if (!key) return { ok: false, status: 503, reason: 'OPENAI_API_KEY_missing' };
  const scope = locations.map(x => `${x.country} — ${x.location}`).join(' | ');
  const wanted = products.length ? products.join(', ') : 'AUCUN PRODUIT IMPOSÉ : découvrir automatiquement les produits/services demandés';
  const prompt = `Tu es WASSAFRICA RADAR V2. Recherche sur le web public des SIGNAUX RÉCENTS DE DEMANDE pour chacune des zones suivantes : ${scope}. Produits/services : ${wanted}. Si aucun produit n'est fourni, découvre les besoins réellement exprimés dans chaque zone. Fenêtre cible : ${hours} heures ; conserve toujours la date réellement visible de la source.

RÈGLES ABSOLUES :
- DEMANDE uniquement si une personne/organisation cherche, veut acheter, demande un prix/devis, cherche un fournisseur, lance un appel d'offres ou exprime explicitement un besoin.
- OFFRE = vendeur, catalogue, boutique, stock, prix affiché, fabricant/distributeur. Une offre n'est JAMAIS une demande.
- INCERTAIN si l'intention n'est pas démontrable.
- Ne fabrique aucun produit, quantité, lieu, contact, date ou URL.
- Chaque demande doit avoir une URL publique réellement consultée.
- Les contacts doivent être professionnels et publiquement affichés.
- Les communautés doivent être publiques et vérifiables.
- Une zone sans preuve fiable doit rester vide.
- Regroupe les demandes similaires mais conserve les preuves.

Retourne UNIQUEMENT ce JSON : {"zones":[{"country":"","location":"","demand_count":0,"products":[{"product":"","category":"","signal_count":0,"intent":"","evidence":[{"text":"","source_title":"","source_url":"","date":""}],"communities":[{"name":"","type":"","url":""}],"professional_contacts":[{"organization":"","name":"","role":"","email":"","phone":"","website":"","source_url":""}],"confidence":"high|medium|low","last_seen":""}],"offers":[{"product":"","source_title":"","source_url":"","date":""}],"uncertain":[{"product":"","reason":"","source_title":"","source_url":""}]}],"summary":"","search_method":"OpenAI Responses API + web search"}`;
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.WASSAFRICA_DEMAND_WEB_MODEL || 'gpt-5.6-luna', tools: [{ type: 'web_search', search_context_size: 'high' }], input: prompt, max_output_tokens: 12000 }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(data?.error?.message || '').toLowerCase();
    const quota = r.status === 429 || /quota|billing|credit balance|insufficient|rate limit/.test(msg);
    return { ok: false, status: quota ? 503 : 502, reason: quota ? 'web_quota_exhausted' : 'web_provider_unavailable' };
  }
  const text = String(data?.output_text || (data?.output || []).flatMap(x => x?.content || []).filter(x => x?.type === 'output_text').map(x => x.text || '').join('\n'));
  let parsed = json(text);
  if (!parsed) { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a >= 0 && b > a) parsed = json(text.slice(a, b + 1)); }
  if (!parsed) return { ok: false, status: 502, reason: 'invalid_web_json' };
  return { ok: true, parsed };
}

async function supabaseGet(table, params) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return [];
  const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, cache: 'no-store' });
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}

async function persistReport({ hours, locations, products, zones }) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return { saved: false, reason: 'service_role_unavailable' };
  const now = new Date(), start = new Date(now.getTime() - hours * 3600000);
  const clusters = [];
  for (const z of zones) for (const p of z.products) clusters.push({ product: p.product, unit: null, quantity: 0, count: p.signal_count, contacts: p.professional_contacts.length, country: z.country, zone: z.location });
  const payload = { period_start: start.toISOString(), period_end: now.toISOString(), demand_count: clusters.reduce((n, x) => n + x.count, 0), grouped_product_count: clusters.length, total_quantity: { value: 0 }, top_demands: clusters, source_breakdown: { web: clusters.length }, contactable_count: clusters.reduce((n, x) => n + x.contacts, 0), unresolved_count: clusters.length, report: { generated_by: 'wassafrica-geo-radar-v2', hours, scope: { locations, products }, clusters }, generation_status: 'generated' };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/demand_reports`, { method: 'POST', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  if (!r.ok) return { saved: false, reason: `report_insert_failed_${r.status}` };
  const [saved] = await r.json().catch(() => []);
  return { saved: Boolean(saved?.id), report_id: saved?.id || null };
}

function tokens(s) { return clean(s, 300).toLowerCase().split(/[^a-z0-9à-ÿ]+/i).filter(x => x.length >= 3); }
function scoreOffer(p, need, zone) {
  const hay = tokens([p.title, p.category, p.description].join(' '));
  const wanted = tokens(need);
  const hits = wanted.filter(t => hay.includes(t)).length;
  const productScore = wanted.length ? hits / wanted.length : 0;
  const place = tokens([p.city, p.country].join(' '));
  const zoneScore = tokens(zone).some(t => place.includes(t)) ? 0.2 : 0;
  return productScore + zoneScore;
}

async function matching(zones) {
  const products = await supabaseGet('products', { select: 'id,title,description,price,currency,category,business_id,is_published,product_type,created_at', is_published: 'eq.true', order: 'created_at.desc', limit: '500' });
  const ids = [...new Set(products.map(p => p.business_id).filter(Boolean))];
  const businesses = ids.length ? await supabaseGet('businesses', { select: 'id,name,city,country', id: `in.(${ids.join(',')})`, limit: '500' }) : [];
  const bm = new Map(businesses.map(b => [b.id, b]));
  const offers = [];
  for (const z of zones) for (const need of z.products) {
    const candidates = products.map(p => { const b = bm.get(p.business_id) || {}; return { ...p, ...b, score: scoreOffer(p, need.product, z.location) }; }).filter(x => x.score >= 0.45).sort((a,b) => b.score-a.score).slice(0,5);
    offers.push({ country: z.country, location: z.location, demand: need.product, matches: candidates.map(x => ({ product_id:x.id, title:x.title, business:x.name || 'WASSAFRICA', city:x.city || '', country:x.country || '', price:x.price, currency:x.currency, score:Math.round(x.score*100) })) });
  }
  return offers;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'method_not_allowed' });
  const a = await admin(req.headers.authorization || '').catch(() => ({ ok:false,status:500,reason:'authorization_error' }));
  if (!a.ok) return res.status(a.status).json({ ok:false, error:a.reason });
  const requestedHours = Number(req.query?.hours || 24); const hours = Number.isFinite(requestedHours) && requestedHours >= 1 && requestedHours <= 168 ? requestedHours : 24;
  const locations = (() => { try { const x = JSON.parse(String(req.query?.locations || '[]')); return Array.isArray(x) ? x.map(v => ({ country:clean(v?.country,100), location:clean(v?.location,140) })).filter(v => v.country && v.location).slice(0,30) : []; } catch { return []; } })();
  const products = arr(req.query?.products);
  if (!locations.length) return res.status(400).json({ ok:false, error:'locations_required', message:'Indiquez au moins un pays et une zone.' });
  const result = await openaiSearch({ hours, locations, products });
  if (!result.ok) return res.status(result.status).json({ ok:false, available:false, web_available:false, web_error_code:result.reason, web_error_message:result.reason === 'web_quota_exhausted' ? 'Recherche web externe temporairement indisponible (quota fournisseur épuisé).' : 'Recherche web externe temporairement indisponible.', mode:'geo-radar-v2' });
  const zones = locations.map(loc => {
    const z = (result.parsed.zones || []).find(x => String(x.country||'').toLowerCase() === loc.country.toLowerCase() && String(x.location||'').toLowerCase() === loc.location.toLowerCase()) || {};
    const productsOut = (Array.isArray(z.products) ? z.products : []).map(p => ({ product:clean(p.product,180), category:clean(p.category,120), signal_count:Math.max(0,Number(p.signal_count)||0), intent:clean(p.intent,280), evidence:(Array.isArray(p.evidence)?p.evidence:[]).map(e=>({ text:clean(e.text,500), source_title:clean(e.source_title,220), source_url:urlOf(e.source_url), date:clean(e.date,80) })).filter(e=>e.source_url).slice(0,8), communities:(Array.isArray(p.communities)?p.communities:[]).map(c=>({name:clean(c.name,160),type:clean(c.type,80),url:urlOf(c.url)})).filter(c=>c.name&&c.url).slice(0,8), professional_contacts:(Array.isArray(p.professional_contacts)?p.professional_contacts:[]).map(c=>({organization:clean(c.organization,180),name:clean(c.name,140),role:clean(c.role,120),email:clean(c.email,180),phone:clean(c.phone,80),website:urlOf(c.website),source_url:urlOf(c.source_url)})).filter(c=>c.organization||c.email||c.phone).slice(0,8), confidence:/^(high|medium|low)$/i.test(String(p.confidence))?String(p.confidence).toLowerCase():'low', last_seen:clean(p.last_seen,80) })).filter(p=>p.product&&p.evidence.length).slice(0,50);
    return { country:loc.country, location:loc.location, demand_count:productsOut.reduce((n,p)=>n+p.signal_count,0), products:productsOut, offers:(Array.isArray(z.offers)?z.offers:[]).map(o=>({product:clean(o.product,180),source_title:clean(o.source_title,220),source_url:urlOf(o.source_url),date:clean(o.date,80)})).filter(o=>o.product&&o.source_url).slice(0,30), uncertain:(Array.isArray(z.uncertain)?z.uncertain:[]).map(o=>({product:clean(o.product,180),reason:clean(o.reason,350),source_title:clean(o.source_title,220),source_url:urlOf(o.source_url)})).filter(o=>o.product&&o.source_url).slice(0,30) };
  });
  const matches = await matching(zones).catch(() => []);
  const persistence = await persistReport({ hours, locations, products, zones }).catch(e => ({ saved:false, reason:e.message }));
  return res.status(200).json({ ok:true, mode:'geo-radar-v2', hours, locations, products, discovered_count:zones.reduce((n,z)=>n+z.products.length,0), signal_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.signal_count,0),0), zones, matches, persistence, generated_at:new Date().toISOString(), summary:clean(result.parsed.summary,1600), search_method:'OpenAI Responses API + web search + WASSAFRICA matching' });
};
