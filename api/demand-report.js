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
  if(!r.ok){
    const providerMessage=String(data?.error?.message||'').toLowerCase();
    const quota=r.status===429||/no credits|insufficient[_ -]?quota|quota|billing|credit balance|rate limit/.test(providerMessage);
    return {ok:false,status:quota?503:502,reason:quota?'web_quota_exhausted':'web_provider_unavailable'};
  }
  const outputText=String(data?.output_text||((data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x?.text||'').join('\n'))||'');
  const parsed=parseWebJson(outputText)||{demands:[],offers:[],uncertain:[],summary:outputText.slice(0,1200),search_method:'web_search'};
  const sources=webAnnotations(data);
  const sourceMap=new Map(sources.map(s=>[s.url,s]));
  const normalize=x=>Array.isArray(x)?x.map(i=>({...i,product:cleanWeb(i.product,180),location:cleanWeb(i.location,180),intent:cleanWeb(i.intent,240),evidence:cleanWeb(i.evidence,600),source_title:cleanWeb(i.source_title,240),source_url:cleanWeb(i.source_url,2000),date:cleanWeb(i.date,80)})).filter(i=>i.source_url):[];
  const demands=normalize(parsed.demands).filter(x=>/demand|request|search|buy|purchase|need|quote|supplier|looking|cherche|besoin|acheter|achat|devis|fournisseur/i.test(x.intent+' '+x.evidence));
  const offers=normalize(parsed.offers);
  for(const x of [...demands,...offers])if(x.source_url&&!sourceMap.has(x.source_url))sources.push({url:x.source_url,title:x.source_title||x.source_url});
  const uncertain=Array.isArray(parsed.uncertain)?parsed.uncertain.slice(0,30).map(i=>({...i,product:cleanWeb(i.product,180),location:cleanWeb(i.location,180),reason:cleanWeb(i.reason,400),source_title:cleanWeb(i.source_title,240),source_url:cleanWeb(i.source_url,2000)})).filter(i=>i.source_url):[];
  return {ok:true,scope:{countries,zones,products,hours},demand_count:demands.length,signal_count:demands.length+offers.length+uncertain.length,offer_count:offers.length,uncertain_count:uncertain.length,demands:demands.slice(0,30),offers:offers.slice(0,30),uncertain,sources:sources.slice(0,30),summary:cleanWeb(parsed.summary,1200),generated_at:new Date().toISOString(),note:'Les résultats web sont des signaux publics sourcés. Les offres/vendeurs ne sont jamais comptés comme demandes. Une vente réelle doit être confirmée par une transaction ou un signal WassAfrica.',search_method:'OpenAI Responses API + web search'};
}

async function generateGeoDemandRadar({hours,locations,products}) {
  const OPENAI_KEY=process.env.OPENAI_API_KEY||process.env.wassAfrica;
  if(!OPENAI_KEY)return {ok:false,status:503,reason:'OPENAI_API_KEY_missing'};
  const safeLocations=Array.isArray(locations)?locations.filter(x=>x&&x.country&&x.location).slice(0,30):[];
  if(!safeLocations.length)return {ok:false,status:400,reason:'locations_required'};
  const productLabel=products.length?products.join(', '):'AUCUN PRODUIT IMPOSÉ — découvrir automatiquement les produits/services demandés';
  const locationLabel=safeLocations.map(x=>x.country+' — '+x.location).join(' | ');
  const prompt=`Tu es WASSAFRICA GEO DEMAND INTELLIGENCE. Recherche sur le web public des SIGNAUX RÉCENTS DE DEMANDE pour chacune des zones suivantes: ${locationLabel}.
Produits/services: ${productLabel}. Si aucun produit n'est fourni, découvre toi-même les produits/services demandés dans chaque zone. Fenêtre cible: ${hours} heures; utilise les sources publiques récentes disponibles et conserve leurs dates.

RÈGLES:
- DEMANDE = personne/entreprise qui cherche, veut acheter, demande un devis/prix, cherche un fournisseur ou exprime explicitement un besoin.
- OFFRE = vendeur, boutique, catalogue, stock, prix affiché, fabricant/distributeur. Une offre n'est JAMAIS une demande.
- Ne fabrique rien: aucun produit, volume, contact, groupe, date ou URL.
- Chaque résultat doit être rattaché à une zone précise et avoir une source URL publique.
- Contacts uniquement professionnels et explicitement publics.
- Groupes/communautés uniquement publics et vérifiables.
- Regroupe les demandes similaires mais conserve les preuves.
- Si une zone n'a pas de signal fiable, retourne une liste vide pour cette zone.
- Les résultats doivent être séparés par zone.

Retourne UNIQUEMENT ce JSON:
{"zones":[{"country":"","location":"","demand_count":0,"products":[{"product":"","category":"","signal_count":0,"intent":"","evidence":[{"text":"","source_title":"","source_url":"","date":""}],"communities":[{"name":"","type":"","url":""}],"professional_contacts":[{"organization":"","name":"","role":"","email":"","phone":"","website":"","source_url":""}],"confidence":"high|medium|low","last_seen":""}],"offers":[{"product":"","source_title":"","source_url":"","date":""}],"uncertain":[{"product":"","reason":"","source_title":"","source_url":""}]}],"summary":"","search_method":"OpenAI Responses API + web search"}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-luna',tools:[{type:'web_search',search_context_size:'high'}],input:prompt,max_output_tokens:12000})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const msg=String(data?.error?.message||'').toLowerCase();const quota=r.status===429||/no credits|insufficient[_ -]?quota|quota|billing|credit balance|rate limit/.test(msg);return {ok:false,status:quota?503:502,reason:quota?'web_quota_exhausted':'web_provider_unavailable'};}
  const outputText=String(data?.output_text||((data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x?.text||'').join('\\n'))||'');
  const parsed=parseWebJson(outputText)||{zones:[],summary:outputText.slice(0,1600),search_method:'web_search'};
  const cleanUrl=(v)=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const cleanArr=(v,max=20)=>Array.isArray(v)?v.map(x=>cleanWeb(x,max)).filter(Boolean).slice(0,max):[];
  const zones=safeLocations.map(loc=>{const z=(Array.isArray(parsed.zones)?parsed.zones:[]).find(x=>String(x.country||'').toLowerCase()===loc.country.toLowerCase()&&String(x.location||'').toLowerCase()===loc.location.toLowerCase())||{};return {country:loc.country,location:loc.location,demand_count:Math.max(0,Number(z.demand_count)||0),products:(Array.isArray(z.products)?z.products:[]).map(p=>({product:cleanWeb(p.product,180),category:cleanWeb(p.category,120),signal_count:Math.max(0,Number(p.signal_count)||0),intent:cleanWeb(p.intent,280),evidence:(Array.isArray(p.evidence)?p.evidence:[]).map(e=>({text:cleanWeb(e.text,500),source_title:cleanWeb(e.source_title,220),source_url:cleanUrl(e.source_url),date:cleanWeb(e.date,80)})).filter(e=>e.source_url).slice(0,8),communities:(Array.isArray(p.communities)?p.communities:[]).map(x=>({name:cleanWeb(x.name,160),type:cleanWeb(x.type,80),url:cleanUrl(x.url)})).filter(x=>x.name&&x.url).slice(0,8),professional_contacts:(Array.isArray(p.professional_contacts)?p.professional_contacts:[]).map(x=>({organization:cleanWeb(x.organization,180),name:cleanWeb(x.name,140),role:cleanWeb(x.role,120),email:cleanWeb(x.email,180),phone:cleanWeb(x.phone,80),website:cleanUrl(x.website),source_url:cleanUrl(x.source_url)})).filter(x=>x.organization||x.email||x.phone).slice(0,8),confidence:/^(high|medium|low)$/i.test(String(p.confidence))?String(p.confidence).toLowerCase():'low',last_seen:cleanWeb(p.last_seen,80)})).filter(p=>p.product&&p.evidence.length).slice(0,50),offers:(Array.isArray(z.offers)?z.offers:[]).map(x=>({product:cleanWeb(x.product,180),source_title:cleanWeb(x.source_title,220),source_url:cleanUrl(x.source_url),date:cleanWeb(x.date,80)})).filter(x=>x.product&&x.source_url).slice(0,30),uncertain:(Array.isArray(z.uncertain)?z.uncertain:[]).map(x=>({product:cleanWeb(x.product,180),reason:cleanWeb(x.reason,350),source_title:cleanWeb(x.source_title,220),source_url:cleanUrl(x.source_url)})).filter(x=>x.product&&x.source_url).slice(0,30)};});
  const sources=new Map();for(const z of zones){for(const p of z.products){for(const e of p.evidence)sources.set(e.source_url,{url:e.source_url,title:e.source_title||e.source_url});for(const x of p.communities)sources.set(x.url,{url:x.url,title:x.name});for(const x of p.professional_contacts)if(x.source_url)sources.set(x.source_url,{url:x.source_url,title:x.organization||x.source_url});}for(const x of [...z.offers,...z.uncertain])sources.set(x.source_url,{url:x.source_url,title:x.source_title||x.source_url});}
  return {ok:true,mode:'geo-radar',hours,locations:safeLocations,products,discovered_count:zones.reduce((n,z)=>n+z.products.length,0),signal_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.signal_count,0),0),community_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.communities.length,0),0),contact_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.professional_contacts.length,0),0),zones,summary:cleanWeb(parsed.summary,1600),sources:[...sources.values()].slice(0,120),generated_at:new Date().toISOString(),search_method:'OpenAI Responses API + web search'};
}

async function generateGlobalDemandRadar({hours,target=100}){
  const OPENAI_KEY=process.env.OPENAI_API_KEY||process.env.wassAfrica;
  if(!OPENAI_KEY)return {ok:false,status:503,reason:'OPENAI_API_KEY_missing'};
  const safeTarget=Math.max(25,Math.min(Number(target)||100,150));
  const prompt=`Tu es WASSAFRICA GLOBAL DEMAND RADAR. Découvre sur le web public les produits et besoins faisant l'objet des SIGNAUX DE DEMANDE les plus documentés. Tu dois viser ${safeTarget} produits/besoins distincts si les sources disponibles le permettent.

Périmètre: MONDE ENTIER. Fenêtre cible: ${hours} heures, mais utilise les pages publiques récentes disponibles et indique leur date. Explore plusieurs familles: agriculture/agroalimentaire, alimentation, construction, immobilier, machines, automobile/pièces, énergie/solaire, textile, beauté, santé, emballage, fournitures professionnelles, électronique, téléphonie, maison, transport/logistique, services professionnels, numérique, livres/culture, formation, tourisme, artisanat, B2B et autres catégories détectées.

RÈGLES ABSOLUES:
- DEMANDE = intention d'achat/recherche d'approvisionnement explicitement exprimée publiquement: demande de devis, recherche de fournisseur, acheteur recherchant un produit, appel d'offres, besoin B2B, importateur recherchant un produit, personne/entreprise disant vouloir acheter ou obtenir un produit/service.
- OFFRE = vendeur, boutique, catalogue, annonce, stock, prix affiché, fabricant ou distributeur qui propose.
- Une OFFRE ne compte JAMAIS comme DEMANDE.
- Ne fabrique aucune donnée, aucune URL, aucun contact, aucun groupe.
- Les contacts doivent être uniquement professionnels et publiquement affichés; rattache chaque contact à sa source.
- Les communautés/groupes doivent être publics et vérifiables.
- Si un champ n'est pas disponible, mets [] ou null, jamais une supposition.
- Regroupe les variantes d'un même besoin, mais conserve plusieurs preuves/sources.
- Classe les produits par force documentaire de la demande, sans inventer de volume.
- Ne prétends pas que « 100 » a été trouvé si moins de 100 résultats distincts sont vérifiables.

Retourne UNIQUEMENT ce JSON:
{"products":[{"rank":1,"product":"","category":"","demand_signal_count":0,"demand_intent":"","countries":[],"locations":[],"evidence":[{"text":"","source_title":"","source_url":"","date":""}],"communities":[{"name":"","type":"","url":"","country":""}],"professional_contacts":[{"organization":"","name":"","role":"","email":"","phone":"","website":"","source_url":""}],"confidence":"high|medium|low","last_seen":""}],"offers":[{"product":"","location":"","source_title":"","source_url":"","date":""}],"uncertain":[{"product":"","location":"","reason":"","source_title":"","source_url":""}],"summary":"","search_method":"OpenAI Responses API + web search"}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-luna',tools:[{type:'web_search',search_context_size:'high'}],input:prompt,max_output_tokens:12000})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const providerMessage=String(data?.error?.message||'').toLowerCase();
    const quota=r.status===429||/no credits|insufficient[_ -]?quota|quota|billing|credit balance|rate limit/.test(providerMessage);
    return {ok:false,status:quota?503:502,reason:quota?'web_quota_exhausted':'web_provider_unavailable'};
  }
  const outputText=String(data?.output_text||((data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x?.text||'').join('\n'))||'');
  const parsed=parseWebJson(outputText)||{products:[],offers:[],uncertain:[],summary:outputText.slice(0,1600),search_method:'web_search'};
  const cleanUrl=(v)=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const cleanArr=(v,max=20)=>Array.isArray(v)?v.map(x=>cleanWeb(x,max)).filter(Boolean).slice(0,max):[];
  const products=Array.isArray(parsed.products)?parsed.products.map((p,i)=>({
    rank:i+1,product:cleanWeb(p.product,180),category:cleanWeb(p.category,120),
    demand_signal_count:Math.max(0,Number(p.demand_signal_count)||0),demand_intent:cleanWeb(p.demand_intent,300),
    countries:cleanArr(p.countries,20),locations:cleanArr(p.locations,20),
    evidence:Array.isArray(p.evidence)?p.evidence.map(e=>({text:cleanWeb(e.text,500),source_title:cleanWeb(e.source_title,220),source_url:cleanUrl(e.source_url),date:cleanWeb(e.date,80)})).filter(e=>e.source_url).slice(0,8):[],
    communities:Array.isArray(p.communities)?p.communities.map(c=>({name:cleanWeb(c.name,160),type:cleanWeb(c.type,80),url:cleanUrl(c.url),country:cleanWeb(c.country,80)})).filter(c=>c.name&&c.url).slice(0,8):[],
    professional_contacts:Array.isArray(p.professional_contacts)?p.professional_contacts.map(c=>({organization:cleanWeb(c.organization,180),name:cleanWeb(c.name,140),role:cleanWeb(c.role,120),email:cleanWeb(c.email,180),phone:cleanWeb(c.phone,80),website:cleanUrl(c.website),source_url:cleanUrl(c.source_url)})).filter(c=>c.organization||c.email||c.phone).slice(0,8):[],
    confidence:/^(high|medium|low)$/i.test(String(p.confidence))?String(p.confidence).toLowerCase():'low',last_seen:cleanWeb(p.last_seen,80)
  })).filter(p=>p.product&&p.evidence.length).slice(0,safeTarget):[];
  const offers=Array.isArray(parsed.offers)?parsed.offers.map(x=>({product:cleanWeb(x.product,180),location:cleanWeb(x.location,140),source_title:cleanWeb(x.source_title,220),source_url:cleanUrl(x.source_url),date:cleanWeb(x.date,80)})).filter(x=>x.product&&x.source_url).slice(0,50):[];
  const uncertain=Array.isArray(parsed.uncertain)?parsed.uncertain.map(x=>({product:cleanWeb(x.product,180),location:cleanWeb(x.location,140),reason:cleanWeb(x.reason,350),source_title:cleanWeb(x.source_title,220),source_url:cleanUrl(x.source_url)})).filter(x=>x.product&&x.source_url).slice(0,50):[];
  const sourceSet=new Map();
  for(const p of products)for(const e of p.evidence)sourceSet.set(e.source_url,{url:e.source_url,title:e.source_title||e.source_url});
  for(const p of products)for(const c of p.communities)sourceSet.set(c.url,{url:c.url,title:c.name});
  for(const p of products)for(const c of p.professional_contacts)if(c.source_url)sourceSet.set(c.source_url,{url:c.source_url,title:c.organization||c.source_url});
  for(const x of [...offers,...uncertain])sourceSet.set(x.source_url,{url:x.source_url,title:x.source_title||x.source_url});
  for(const s of webAnnotations(data))sourceSet.set(s.url,s);
  return {ok:true,mode:'radar',target:safeTarget,discovered_count:products.length,signal_count:products.reduce((n,p)=>n+p.demand_signal_count,0),community_count:products.reduce((n,p)=>n+p.communities.length,0),contact_count:products.reduce((n,p)=>n+p.professional_contacts.length,0),products,offers,uncertain,sources:[...sourceSet.values()].slice(0,120),summary:cleanWeb(parsed.summary,1600),generated_at:new Date().toISOString(),note:'Radar fondé uniquement sur des signaux publics sourcés. Les offres ne sont jamais comptées comme demandes. Les contacts sont limités aux informations professionnelles publiquement affichées.',search_method:'OpenAI Responses API + web search'};
}

// Shared web intelligence keeps the Hobby deployment within the serverless function budget.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const requestedHours = Number(req.query?.hours || 6); const hours = Number.isFinite(requestedHours) && requestedHours > 0 && requestedHours <= 168 ? requestedHours : 6;
  const countries = normalizeArray(csv(req.query?.countries || process.env.DEMAND_COUNTRIES)); const zones = normalizeArray(csv(req.query?.zones || process.env.DEMAND_ZONES)); const products = normalizeArray(csv(req.query?.products || req.query?.product || process.env.DEMAND_PRODUCTS)); const locations = (()=>{ try { const raw=String(req.query?.locations||''); return raw ? JSON.parse(raw).filter(x=>x&&x.country&&x.location) : []; } catch { return []; } })();
  const auth = req.headers.authorization || ''; const cronAuthorized = Boolean(process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`);
  let result;
  if (cronAuthorized) result = await generateForCron({ hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'cron_generation_failed' }));
  else {
    const admin = await validateAdminBearer(auth).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'authorization_error' }));
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.reason });
    if (String(req.query?.mode || '') === 'geo-radar') {
      result = await generateGeoDemandRadar({ hours, locations, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'geo_radar_search_failed' }));
    } else if (String(req.query?.mode || '') === 'radar' || String(req.query?.mode || '') === 'geo-radar') {
      const target = Number(req.query?.target || 100);
      result = await generateGlobalDemandRadar({ hours, target }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'radar_search_failed' }));
    } else if (String(req.query?.web || '') === '1') {
      result = await generateExternalWebDemand({ hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'web_search_failed' }));
    } else {
      result = await generateForAdmin({ token: admin.token, hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'admin_generation_failed' }));
    }
  }

  if (!result?.ok) {
    if (String(req.query?.web || '') === '1' || String(req.query?.mode || '') === 'radar') {
      const quota = result.reason === 'web_quota_exhausted';
      return res.status(result.status || 503).json({
        ok: false,
        available: false,
        web_available: false,
        web_error_code: quota ? 'quota_exhausted' : 'provider_unavailable',
        web_error_message: quota ? 'Recherche web externe temporairement indisponible (quota fournisseur épuisé).' : 'Recherche web externe temporairement indisponible.',
        mode: String(req.query?.mode || '') === 'radar' ? 'radar' : (String(req.query?.mode || '') === 'geo-radar' ? 'geo-radar' : 'web'),
        demand_count: 0,
        signal_count: 0,
        offer_count: 0,
        uncertain_count: 0,
        demands: [],
        offers: [],
        uncertain: [],
        sources: [],
        generated_at: new Date().toISOString()
      });
    }
    return res.status(result?.status || 500).json({ ok: false, error: result?.reason || 'demand_generation_failed' });
  }
  if (String(req.query?.mode || '') === 'radar' || String(req.query?.mode || '') === 'geo-radar') return res.status(200).json(result);
  const scopeLabel = [...(countries || []), ...(zones || [])].join(', ') || 'Monde entier'; const productLabel = products.length ? products.join(', ') : 'Tous produits / besoins'; const clusters = Array.isArray(result.clusters) ? result.clusters : [];
  const lines = clusters.map((x) => `- ${x.product}: ${x.quantity || 0} ${x.unit || ''} — ${x.count} demande(s) — ${x.contacts || 0} contact(s) public(s)`);
  const text = ['WASSAFRICA — RAPPORT DES BESOINS', `Période: ${result.window_start} → ${result.window_end}`, `Durée: ${result.hours} h`, `Zone(s): ${scopeLabel}`, `Produit(s): ${productLabel}`, `Demandes: ${result.demand_count}`, `Produits regroupés: ${result.cluster_count}`, '', ...(lines.length ? lines : ['Aucune demande détectée sur ce périmètre.']), '', `Rapport ID: ${result.report_id || 'n/a'}`].join('\n');
  const html = `<h2>WASSAFRICA — Rapport des besoins</h2><p><b>Période :</b> ${escapeHtml(result.window_start)} → ${escapeHtml(result.window_end)}</p><p><b>Durée :</b> ${result.hours} h · <b>Zone(s) :</b> ${escapeHtml(scopeLabel)}</p><p><b>Produit(s) :</b> ${escapeHtml(productLabel)}</p><p><b>Demandes :</b> ${result.demand_count} · <b>Produits regroupés :</b> ${result.cluster_count}</p><ul>${clusters.length ? clusters.map((x) => `<li><b>${escapeHtml(x.product)}</b> — ${escapeHtml(x.quantity || 0)} ${escapeHtml(x.unit || '')} — ${x.count} demande(s) — ${x.contacts || 0} contact(s) public(s)</li>`).join('') : '<li>Aucune demande détectée sur ce périmètre.</li>'}</ul><p>Rapport ID : ${escapeHtml(result.report_id || 'n/a')}</p>`;
  const email = await sendEmail({ subject: `WassAfrica — demandes — ${productLabel} — ${scopeLabel}`, html, text });
  return res.status(200).json({ ...result, email });
}
