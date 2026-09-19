const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const DEFAULT_RECIPIENT = process.env.DEMAND_REPORT_EMAIL || 'neodigitalstartupacademy@gmail.com';

function csv(value) { return String(value || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 100); }
function normalizeArray(values) { return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, 100); }

async function validateAdminBearer(auth) {
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, reason: 'missing_bearer' };
  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, reason: 'empty_bearer' };
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { cache: 'no-store', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) return { ok: false, status: 401, reason: 'invalid_or_expired_token' };
  const user = await response.json().catch(() => null);
  if (!user?.id) return { ok: false, status: 401, reason: 'auth_user_missing' };
  return { ok: true, userId: user.id, token };
}

async function generateForAdmin({ token, hours, countries, zones, products }) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_generate_demand_report`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_hours: hours, p_countries: countries, p_zones: zones, p_products: products })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.message || data?.hint || data?.details || data?.code || 'demand_rpc_failed';
    if (response.status === 401 || response.status === 403) return { ok: false, status: response.status, reason: response.status === 403 ? 'platform_admin_required' : 'invalid_or_expired_token' };
    return { ok: false, status: 502, reason };
  }
  if (!data?.ok) return { ok: false, status: 502, reason: 'invalid_demand_rpc_response' };
  return data;
}

async function generateForCron({ hours, countries, zones, products }) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return { ok: false, status: 503, reason: 'supabase_cron_env_missing' };
  const start = new Date(Date.now() - hours * 60 * 60 * 1000), end = new Date();
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const url = new URL(`${SUPABASE_URL}/rest/v1/demand_observations`);
  url.searchParams.set('select', 'id,normalized_product,quantity,unit,public_contact,source_platform,location_text,country_code,status,observed_at');
  url.searchParams.set('observed_at', `gte.${start.toISOString()}`); url.searchParams.append('observed_at', `lte.${end.toISOString()}`); url.searchParams.set('status', 'neq.rejected'); url.searchParams.set('order', 'observed_at.desc');
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) return { ok: false, status: 502, reason: `observation_query_failed_${response.status}` };
  const observations = await response.json();
  const matches = (value, filters) => !filters.length || filters.some((filter) => String(value || '').toLowerCase().includes(filter.toLowerCase()));
  const filtered = observations.filter((item) => matches(item.country_code, countries) && matches(item.location_text, zones) && matches(item.normalized_product, products));
  const groups = new Map();
  for (const item of filtered) {
    const key = `${String(item.normalized_product || '').toLowerCase().trim()}|${String(item.unit || '').toLowerCase().trim()}`;
    if (key === '|') continue;
    if (!groups.has(key)) groups.set(key, { product: item.normalized_product, unit: item.unit, quantity: 0, count: 0, contacts: 0 });
    const group = groups.get(key); group.quantity += Number(item.quantity || 0); group.count += 1; if (item.public_contact) group.contacts += 1;
  }
  const clusters = [...groups.values()].sort((a, b) => b.count - a.count || b.quantity - a.quantity);
  const reportPayload = { period_start: start.toISOString(), period_end: end.toISOString(), demand_count: filtered.length, grouped_product_count: clusters.length, total_quantity: { value: clusters.reduce((sum, item) => sum + item.quantity, 0) }, top_demands: clusters, source_breakdown: filtered.reduce((acc, item) => { const key = item.source_platform || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}), contactable_count: filtered.filter((item) => item.public_contact).length, unresolved_count: filtered.filter((item) => ['detected', 'verified', 'clustered', 'contact_ready'].includes(item.status)).length, report: { generated_by: 'wassafrica-demand-intelligence', hours, scope: { countries, zones, products }, clusters }, generation_status: 'generated' };
  const reportResponse = await fetch(`${SUPABASE_URL}/rest/v1/demand_reports`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(reportPayload) });
  if (!reportResponse.ok) return { ok: false, status: 502, reason: `report_insert_failed_${reportResponse.status}` };
  const [saved] = await reportResponse.json();
  if (saved?.id && clusters.length) await fetch(`${SUPABASE_URL}/rest/v1/demand_report_items`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(clusters.map((cluster) => ({ report_id: saved.id, priority: cluster.count >= 10 ? 'urgent' : cluster.count >= 5 ? 'high' : 'normal', action_status: 'pending', notes: `${cluster.count} demande(s), ${cluster.quantity || 0} ${cluster.unit || ''}. Contacts publics détectés: ${cluster.contacts}.` }))) });
  return { ok: true, report_id: saved?.id || null, window_start: start.toISOString(), window_end: end.toISOString(), hours, scope: { countries, zones, products }, demand_count: filtered.length, cluster_count: clusters.length, total_quantity: clusters.reduce((sum, item) => sum + item.quantity, 0), clusters };
}

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
async function sendEmail({ subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.DEMAND_REPORT_FROM || 'WassAfrica Intelligence <onboarding@resend.dev>';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY_missing' };
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [DEFAULT_RECIPIENT], subject, html, text }) });
  if (!response.ok) return { sent: false, reason: `resend_${response.status}` }; const data = await response.json(); return { sent: true, id: data.id || null };
}

function cleanWeb(v,n=500){return String(v??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,n);}
function parseWebJson(text){
  const raw=String(text||'').replace(/^\`\`\`json/i,'').replace(/\`\`\`$/,'').trim();
  try{return JSON.parse(raw)}catch{}
  const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}
  return null;
}
function webAnnotations(response){
  const out=[];
  for(const item of (response?.output||[])) for(const part of (item?.content||[])) for(const a of (part?.annotations||[]))
    if(a?.type==='url_citation'&&a.url) out.push({url:a.url,title:a.title||a.url});
  const seen=new Set();
  return out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,30);
}
async function generateExternalWebDemand({hours,countries,zones,products}){
  const OPENAI_KEY=process.env.OPENAI_API_KEY||process.env.wassAfrica;
  if(!OPENAI_KEY)return {ok:false,status:503,reason:'OPENAI_API_KEY_missing'};
  const scope=[...countries,...zones].join(', ')||'monde entier';
  const productLabel=products.join(', ')||'produits et besoins';
  const prompt=`Tu es WASSAFRICA DEMAND INTELLIGENCE. Recherche le web actuel pour trouver des SIGNAUX DE DEMANDE, pas des vendeurs.
Périmètre: ${scope}. Produits/thèmes: ${productLabel}. Fenêtre cible: ${hours} heures, mais utilise les pages publiques récentes disponibles et indique leur date.

RÈGLE ABSOLUE:
- DEMANDE = personne/entreprise qui cherche, demande, veut acheter, demande un prix/devis, recherche un fournisseur, exprime un besoin ou une intention d'achat explicite.
- OFFRE = vendeur, boutique, catalogue, annonce de produit, stock, prix affiché, marketplace listing, fabricant ou distributeur qui propose le produit.
- Une OFFRE ne compte JAMAIS comme DEMANDE.
- Ne transforme jamais une annonce en acheteur.
- Si la source ne permet pas d'établir une intention de demande, classe-la "offer" ou "uncertain".
- Ne fabrique aucun demandeur, quantité, lieu, date ou contact.
- Les résultats doivent être sourcés par les pages réellement consultées.
- Donne priorité aux pages récentes, forums/posts publics et pages où une intention de recherche/achat est explicitement exprimée. Les marketplaces servent surtout à constater l'offre et doivent rester séparées.

Retourne UNIQUEMENT ce JSON:
{"demands":[{"product":"","location":"","intent":"","evidence":"","source_title":"","source_url":"","date":""}],"offers":[{"product":"","location":"","evidence":"","source_title":"","source_url":"","date":""}],"uncertain":[{"product":"","location":"","reason":"","source_title":"","source_url":""}],"summary":"","search_method":""}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-luna',tools:[{type:'web_search',search_context_size:'low'}],input:prompt,max_output_tokens:2500})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return {ok:false,status:r.status===429?429:502,reason:cleanWeb(data?.error?.message||'web_search_failed',500)};
  const outputText=String(data?.output_text||((data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x?.text||'').join('\n'))||'');
  const parsed=parseWebJson(outputText)||{demands:[],offers:[],uncertain:[],summary:outputText.slice(0,1200),search_method:'web_search'};
  const sources=webAnnotations(data);
  const sourceMap=new Map(sources.map(s=>[s.url,s]));
  const normalize=x=>Array.isArray(x)?x.map(i=>({...i,product:cleanWeb(i.product,180),location:cleanWeb(i.location,180),intent:cleanWeb(i.intent,240),evidence:cleanWeb(i.evidence,600),source_title:cleanWeb(i.source_title,240),source_url:cleanWeb(i.source_url,2000),date:cleanWeb(i.date,80)})).filter(i=>i.source_url):[];
  const demands=normalize(parsed.demands).filter(x=>/demand|request|search|buy|purchase|need|quote|supplier|looking|cherche|besoin|acheter|achat|devis|fournisseur/i.test(x.intent+' '+x.evidence));
  const offers=normalize(parsed.offers);
  for(const x of [...demands,...offers])if(x.source_url&&!sourceMap.has(x.source_url))sources.push({url:x.source_url,title:x.source_title||x.source_url});
  return {ok:true,scope:{countries,zones,products,hours},demand_count:demands.length,signal_count:demands.length+offers.length+(Array.isArray(parsed.uncertain)?parsed.uncertain.length:0),demands:demands.slice(0,30),offers:offers.slice(0,30),sources:sources.slice(0,30),summary:cleanWeb(parsed.summary,1200),note:'Les résultats web sont des signaux publics sourcés. Les offres/vendeurs ne sont jamais comptés comme demandes. Une vente réelle doit être confirmée par une transaction ou un signal WassAfrica.',search_method:'OpenAI Responses API + web search'};
}

// Shared web intelligence keeps the Hobby deployment within the serverless function budget.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const requestedHours = Number(req.query?.hours || 6); const hours = Number.isFinite(requestedHours) && requestedHours > 0 && requestedHours <= 168 ? requestedHours : 6;
  const countries = normalizeArray(csv(req.query?.countries || process.env.DEMAND_COUNTRIES)); const zones = normalizeArray(csv(req.query?.zones || process.env.DEMAND_ZONES)); const products = normalizeArray(csv(req.query?.products || req.query?.product || process.env.DEMAND_PRODUCTS));
  const auth = req.headers.authorization || ''; const cronAuthorized = Boolean(process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`);
  let result;
  if (cronAuthorized) result = await generateForCron({ hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'cron_generation_failed' }));
  else if (String(req.query?.web || '') === '1') result = await generateExternalWebDemand({ hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'web_search_failed' }));
  else {
    const admin = await validateAdminBearer(auth).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'authorization_error' }));
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.reason });
    result = await generateForAdmin({ token: admin.token, hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'admin_generation_failed' }));
  }
  if (!result?.ok) return res.status(result?.status || 500).json({ ok: false, error: result?.reason || 'demand_generation_failed' });
  const scopeLabel = [...(countries || []), ...(zones || [])].join(', ') || 'Monde entier'; const productLabel = products.length ? products.join(', ') : 'Tous produits / besoins'; const clusters = Array.isArray(result.clusters) ? result.clusters : [];
  const lines = clusters.map((x) => `- ${x.product}: ${x.quantity || 0} ${x.unit || ''} — ${x.count} demande(s) — ${x.contacts || 0} contact(s) public(s)`);
  const text = ['WASSAFRICA — RAPPORT DES BESOINS', `Période: ${result.window_start} → ${result.window_end}`, `Durée: ${result.hours} h`, `Zone(s): ${scopeLabel}`, `Produit(s): ${productLabel}`, `Demandes: ${result.demand_count}`, `Produits regroupés: ${result.cluster_count}`, '', ...(lines.length ? lines : ['Aucune demande détectée sur ce périmètre.']), '', `Rapport ID: ${result.report_id || 'n/a'}`].join('\n');
  const html = `<h2>WASSAFRICA — Rapport des besoins</h2><p><b>Période :</b> ${escapeHtml(result.window_start)} → ${escapeHtml(result.window_end)}</p><p><b>Durée :</b> ${result.hours} h · <b>Zone(s) :</b> ${escapeHtml(scopeLabel)}</p><p><b>Produit(s) :</b> ${escapeHtml(productLabel)}</p><p><b>Demandes :</b> ${result.demand_count} · <b>Produits regroupés :</b> ${result.cluster_count}</p><ul>${clusters.length ? clusters.map((x) => `<li><b>${escapeHtml(x.product)}</b> — ${escapeHtml(x.quantity || 0)} ${escapeHtml(x.unit || '')} — ${x.count} demande(s) — ${x.contacts || 0} contact(s) public(s)</li>`).join('') : '<li>Aucune demande détectée sur ce périmètre.</li>'}</ul><p>Rapport ID : ${escapeHtml(result.report_id || 'n/a')}</p>`;
  const email = await sendEmail({ subject: `WassAfrica — demandes — ${productLabel} — ${scopeLabel}`, html, text });
  return res.status(200).json({ ...result, email });
}
