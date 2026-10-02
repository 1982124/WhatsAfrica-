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
  const countryList=Array.isArray(countries)?countries.filter(Boolean):[];
  const zoneList=Array.isArray(zones)?zones.filter(Boolean):[];
  const locations=[];
  if(zoneList.length){
    for(let i=0;i<zoneList.length;i++){
      const country=countryList.length===1?countryList[0]:(countryList[i]||'');
      if(country) locations.push({country,location:zoneList[i]});
    }
  } else if(countryList.length){
    // Country-only CRON scopes use the country as the geographic location.
    for(const country of countryList) locations.push({country,location:country});
  }
  if(!locations.length)return {ok:false,status:400,reason:'cron_scope_requires_country_and_zone'};
  const internal=await generateInternalGeoDemandRadar({hours,locations,products});
  if(!internal?.ok)return internal;
  // CRON now follows the same durable Radar V2 pipeline as the manual Radar:
  // internal memory -> qualification -> temporal history -> Marketplace matching -> gaps -> persistence.
  const persistence=await persistRadarReport(internal).catch(error=>({persisted:false,reason:error?.message||'cron_persistence_failed'}));
  return {
    ...internal,
    mode:'geo-radar-cron',
    cron_pipeline:'radar-v2',
    scope:{countries:countryList,zones:zoneList,products},
    persistence
  };
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
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-sol',tools:[{type:'web_search',search_context_size:'low'}],input:prompt,max_output_tokens:2500})});
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

function radarNorm(v){return String(v||'').normalize('NFKC').toLowerCase().trim().replace(/\\s+/g,' ');}
function radarGeoEqual(a,b){
  const aa=radarNorm(a),bb=radarNorm(b);
  if(!aa||!bb)return false;
  if(aa===bb)return true;
  const parts=v=>v.split(/[,|/;]+/).map(x=>radarNorm(x)).filter(Boolean);
  return parts(aa).includes(bb)||parts(bb).includes(aa);
}
function radarEvidenceDate(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  const t=Date.parse(raw);
  return Number.isFinite(t)?new Date(t):null;
}
function radarFreshness(dateValue,hours,now=new Date()){
  const d=radarEvidenceDate(dateValue);
  if(!d)return {status:'unknown',hours:null,source_date:null};
  const age=(now.getTime()-d.getTime())/3600000;
  if(age< -6)return {status:'unknown',hours:null,source_date:d.toISOString()};
  return {status:age<=Number(hours||0)?'fresh':'stale',hours:Math.max(0,Math.round(age*10)/10),source_date:d.toISOString()};
}
function radarEvidenceLevel(text,intent){
  const s=String(text||'')+' '+String(intent||'');
  if(/cherche|recherche|looking for|need|besoin|veut acheter|want to buy|buy|purchase|devis|quote|fournisseur|supplier|prix|price/i.test(s))return 'E3';
  if(/demande|request|interested|int[ée]ress/i.test(s))return 'E2';
  if(s.trim())return 'E1';
  return 'E0';
}
function radarFingerprint(item){
  const product=radarNorm(item.product), country=radarNorm(item.country), zone=radarNorm(item.zone);
  return [product,country,zone].join('|');
}
function radarScopeComparable(a,b){
  const normScope=(s)=>({locations:(Array.isArray(s?.locations)?s.locations:[]).map(x=>radarNorm((x?.country||'')+'|'+(x?.location||''))).sort(),products:(Array.isArray(s?.products)?s.products:[]).map(radarNorm).sort()});
  const aa=normScope(a),bb=normScope(b);
  return JSON.stringify(aa)===JSON.stringify(bb);
}
function radarComparableWindow(currentHours, previous){
  const h=Number(currentHours||0), ph=Number(previous?.report?.hours||0);
  return h>0 && ph>0 && Math.abs(h-ph)<=Math.max(1,h*0.1);
}
async function loadComparableRadarHistory(result, headers){
  try{
    const url=new URL(SUPABASE_URL+'/rest/v1/demand_reports');
    url.searchParams.set('select','id,period_start,period_end,demand_count,grouped_product_count,top_demands,report,generation_status');
    url.searchParams.set('generation_status','eq.generated'); url.searchParams.set('order','period_end.desc'); url.searchParams.set('limit','50');
    const r=await fetch(url,{headers,cache:'no-store'}); if(!r.ok)return [];
    const rows=await r.json().catch(()=>[]), currentScope={locations:result.locations||[],products:result.products||[]};
    const currentEnd=new Date(result.generated_at||Date.now()).getTime();
    return rows.filter(x=>{if(!x?.period_end)return false;const end=new Date(x.period_end).getTime();return Number.isFinite(end)&&end<currentEnd&&radarScopeComparable(currentScope,x.report?.scope)&&radarComparableWindow(result.hours,x);});
  }catch{return []}
}
async function loadPreviousComparableRadar(result, headers){const history=await loadComparableRadarHistory(result,headers);return history[0]||null;}
function extractPreviousSignals(previous){
  const rows=Array.isArray(previous?.top_demands)?previous.top_demands:[];
  return rows.map(x=>({...x,fingerprint:x.fingerprint||radarFingerprint(x)})).filter(x=>x.product&&x.country&&x.zone);
}
async function loadPublishedMarketplaceOffers(headers){
  try{
    const url=new URL(SUPABASE_URL+'/rest/v1/products');
    url.searchParams.set('select','id,title,description,category,product_type,content_kind,business_id,is_published,price,currency,stock,created_at');
    url.searchParams.set('is_published','eq.true');
    url.searchParams.set('order','created_at.desc');
    url.searchParams.set('limit','500');
    const r=await fetch(url,{headers,cache:'no-store'}); if(!r.ok)return [];
    const products=await r.json().catch(()=>[]);
    const ids=[...new Set(products.map(x=>x.business_id).filter(Boolean))];
    if(!ids.length)return products.map(x=>({...x,business:null}));
    const bu=new URL(SUPABASE_URL+'/rest/v1/businesses');
    bu.searchParams.set('select','id,name,city,country');
    bu.searchParams.set('id','in.('+ids.join(',')+')');
    const br=await fetch(bu,{headers,cache:'no-store'}); const businesses=br.ok?await br.json().catch(()=>[]):[];
    const bm=new Map(businesses.map(x=>[x.id,x]));
    return products.map(x=>({...x,business:bm.get(x.business_id)||null}));
  }catch{return []}
}
function marketNorm(v){return String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\\s]/g,' ').replace(/\\s+/g,' ').trim()}

const MARKET_STOP=new Set(['de','du','des','la','le','les','un','une','et','a','au','aux','pour','avec','sur','dans','the','of','and','for','to','en','ou','par','from','with','dear','please']);
const MARKET_SYNONYM_GROUPS=[
  ['riz','rice'],['cereale','cereal','grain'],['mais','corn','maize'],['ble','wheat'],
  ['tomate','tomatoes','tomato'],['oignon','onions','onion'],['pomme','apple','apples'],
  ['banane','banana','bananas'],['huile','oil'],['sucre','sugar'],['farine','flour'],
  ['savon','soap'],['vetement','clothing','apparel'],['chaussure','shoes','footwear'],
  ['telephone','phone','smartphone','mobile'],['ordinateur','computer','laptop'],
  ['voiture','car','automobile'],['moto','motorcycle'],['camion','truck'],
  ['maison','house','home'],['meuble','furniture'],['materiel','equipment'],
  ['solaire','solar'],['panneau','panel'],['batterie','battery']
];
const MARKET_ALIAS=new Map();
for(const group of MARKET_SYNONYM_GROUPS){
  const canonical=group[0];
  for(const term of group)MARKET_ALIAS.set(term,canonical);
}
function marketCanonicalToken(token){return MARKET_ALIAS.get(token)||token}
function marketRawTokens(v){return marketNorm(v).split(' ').filter(x=>x.length>2&&!MARKET_STOP.has(x))}
function marketTokens(v){return marketRawTokens(v).map(marketCanonicalToken)}
function marketUniqueTokens(v){return [...new Set(marketTokens(v))]}
function marketPhrase(v){return marketNorm(v).split(' ').filter(Boolean).map(marketCanonicalToken).join(' ')}
function marketSynonymOverlap(demand,content){
  const dRaw=marketRawTokens(demand), cRaw=marketRawTokens(content);
  const dCanon=dRaw.map(marketCanonicalToken), cCanon=cRaw.map(marketCanonicalToken);
  const out=[];
  for(let i=0;i<dRaw.length;i++){
    if(dRaw[i]===dCanon[i])continue;
    if(cCanon.includes(dCanon[i]) && cRaw.some(x=>x!==dCanon[i]&&marketCanonicalToken(x)===dCanon[i])) out.push(dCanon[i]);
  }
  return [...new Set(out)];
}
function matchMarketplaceOffer(signal,offer){
  const demand=marketNorm(signal.product), title=marketNorm(offer.title), category=marketNorm(offer.category), desc=marketNorm(offer.description);
  if(!demand||!title)return null;

  // Web demand is matchable only when freshness and evidence are actually proven.
  // Internal memory remains matchable because its temporal scope is already enforced by the observation query.
  const sourceType=String(signal.source_type||'');
  const evidenceLevel=String(signal.evidence_level||'E0');
  const freshness=String(signal.freshness_status||'unknown');
  if(sourceType==='web' && !((evidenceLevel==='E2'||evidenceLevel==='E3') && freshness==='fresh')) return null;

  const dTokens=marketUniqueTokens(demand);
  const tTokens=[...new Set([...marketTokens(title),...marketTokens(category),...marketTokens(desc)])];
  const overlap=dTokens.filter(t=>tTokens.includes(t));
  const lexical=dTokens.length?overlap.length/dTokens.length:0;

  const demandPhrase=marketPhrase(demand);
  const titlePhrase=marketPhrase(title);
  const categoryPhrase=marketPhrase(category);
  const phrase=!!(demandPhrase&&titlePhrase&&(titlePhrase===demandPhrase||titlePhrase.includes(demandPhrase)||demandPhrase.includes(titlePhrase)));
  const categoryExact=!!(demandPhrase&&categoryPhrase&&(categoryPhrase===demandPhrase||categoryPhrase.includes(demandPhrase)||demandPhrase.includes(categoryPhrase)));

  // One generic token is deliberately NOT enough for a semantic/category claim.
  // It may still match when the published title/category contains the exact normalized phrase.
  const strongLexical=dTokens.length>=3
    ? overlap.length>=2&&lexical>=0.5
    : dTokens.length===2
      ? overlap.length===2
      : false;
  if(!phrase&&!categoryExact&&!strongLexical)return null;

  const geoCountry=radarGeoEqual(signal.country,offer.business?.country);
  const geoZone=radarGeoEqual(signal.zone,offer.business?.city);
  const synonymOverlap=marketSynonymOverlap(demand,[title,category,desc].join(' '));

  // A synonym match must actually cross languages/variants; canonical overlap alone is lexical.
  const type=phrase?'exact':categoryExact?'category':synonymOverlap.length?'synonym':'keyword';
  const scope=geoZone?'local_zone':geoCountry?'local_country':'cross_region';
  const baseConfidence=phrase||categoryExact?'high':lexical>=0.75?'high':'medium';
  const confidence=(geoZone||geoCountry)?baseConfidence:(baseConfidence==='high'?'medium':'low');
  const reason=phrase
    ? 'Correspondance exacte après normalisation du besoin et du contenu publié.'
    : categoryExact
      ? 'Correspondance directe entre le besoin normalisé et la catégorie publiée.'
      : type==='synonym'
        ? 'Correspondance déterministe via un alias multilingue explicite réellement présent dans le besoin et l’offre.'
        : 'Recoupement lexical suffisamment fort entre le besoin et le contenu publié.';

  const relevance=Math.min(1,Math.max(0,
    Math.min(1,lexical)+(phrase?0.35:0)+(categoryExact?0.25:0)+
    (geoCountry?0.10:0)+(geoZone?0.15:0)+(synonymOverlap.length?0.10:0)
  ));

  return {
    offer_id:offer.id,title:offer.title,product_type:offer.product_type||'physical',
    business_name:offer.business?.name||'Vendeur WASSAFRICA',
    city:offer.business?.city||'',country:offer.business?.country||'',
    price:offer.price,currency:offer.currency||'XOF',stock:offer.stock,
    match_type:type,match_reason:reason,match_scope:scope,match_confidence:confidence,
    matched_terms:overlap.slice(0,12),synonym_terms:synonymOverlap.slice(0,12),
    geographic_country_match:geoCountry,geographic_zone_match:geoZone,
    url:'/product/'+encodeURIComponent(offer.id),relevance:Math.round(relevance*100)/100
  };
}
async function enrichRadarWithMarketplaceMatching(signals,result,headers){
  const offers=await loadPublishedMarketplaceOffers(headers);
  const current=(Array.isArray(signals)?signals:[]).filter(x=>x.signal_state!=='disappeared');
  let matchedSignals=0, matchedDemand=0, unmatchedSignals=0, unmatchedDemand=0;
  const enriched=current.map(signal=>{
    const matches=[]; for(const offer of offers){const m=matchMarketplaceOffer(signal,offer);if(m)matches.push(m)}
    matches.sort((x,y)=>y.relevance-x.relevance||Number(y.geographic_zone_match)-Number(x.geographic_zone_match)||Number(y.geographic_country_match)-Number(x.geographic_country_match));
    const top=matches.slice(0,3), has=top.length>0;
    if(has){matchedSignals++;matchedDemand+=Number(signal.count||0)}else{unmatchedSignals++;unmatchedDemand+=Number(signal.count||0)}
    return {...signal,market_match_status:has?'matched':'unmatched',market_match_count:matches.length,market_matches:top};
  });
  const demandTotal=current.reduce((n,x)=>n+Number(x.count||0),0);
  const gaps = enriched.filter(x=>x.market_match_status==='unmatched').map(x=>({product:x.product||null,country:x.country||null,zone:x.zone||null,count:Number(x.count||0),confidence:x.confidence||'low',evidence_level:x.evidence_level||'E0',freshness_status:x.freshness_status||'unknown',signal_state:x.signal_state||'new',first_seen:x.first_seen||x.last_seen||null,last_seen:x.last_seen||null,fingerprint:x.fingerprint||null})).sort((a,b)=>b.count-a.count).slice(0,50);
  return {signals:enriched,marketplace_offer_count:offers.length,matched_signal_count:matchedSignals,unmatched_signal_count:unmatchedSignals,matched_demand_count:matchedDemand,unmatched_demand_count:unmatchedDemand,demand_signal_total:demandTotal,coverage_rate:demandTotal?Math.round(matchedDemand/demandTotal*10000)/100:0,gaps,matching_method:'published Marketplace offers only; deterministic normalized lexical + explicit multilingual synonym matching; web matches require fresh E2/E3 evidence; geography is corroborative',matching_version:'v4'};
}

async function persistRadarReport(result) {
  if (!SUPABASE_SERVICE_ROLE_KEY || !result?.ok) return { persisted: false, reason: 'service_role_unavailable' };
  const now = new Date();
  const start = new Date(now.getTime() - Number(result.hours || 6) * 60 * 60 * 1000);
  const zones = Array.isArray(result.zones) ? result.zones : [];
  const fallback = result.fallback === 'internal_memory';
  const sourceType = fallback ? 'internal_memory' : 'web';
  const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  // Build one logical signal per product/zone. Evidence URLs are used only to enrich identity;
  // multiple evidence lines from the same source never become multiple demand signals.
  const candidates = [];
  for (const z of zones) {
    for (const p of (Array.isArray(z.products) ? z.products : [])) {
      const evidence = Array.isArray(p.evidence) ? p.evidence : [];
      const urls = [...new Set(evidence.map(e => String(e?.source_url || '').trim()).filter(Boolean))];
      const sourceUrl = urls[0] || '';
      if(sourceType==='web' && p.eligible_for_demand===false) continue;
      const base = {
        product: p.product,
        unit: null,
        quantity: 0,
        count: Number(p.signal_count || 0),
        contacts: Array.isArray(p.professional_contacts) ? p.professional_contacts.length : 0,
        country: z.country,
        zone: z.location,
        confidence: p.confidence || 'low',
        last_seen: p.last_seen || null,
        source_url: sourceUrl,
        source_type: sourceType,
        evidence_count: evidence.length,
        unique_source_count: urls.length,
        evidence_level: p.evidence_level || evidence.reduce((best,e)=>({E0:0,E1:1,E2:2,E3:3}[e?.evidence_level]||0)>({E0:0,E1:1,E2:2,E3:3}[best]||0)?e.evidence_level:best,'E0'),
        freshness_status: p.freshness_status || (evidence.some(e=>e?.freshness_status==='fresh')?'fresh':evidence.some(e=>e?.freshness_status==='stale')?'stale':'unknown'),
        contact_type: (Array.isArray(p.professional_contacts)&&p.professional_contacts.length)?'public_professional':'none',
        contact_relation: (Array.isArray(p.professional_contacts)&&p.professional_contacts.length)?'source_context':'none'
      };
      base.fingerprint = radarFingerprint(base);
      candidates.push(base);
    }
  }

  // Exact logical duplicates in one run are merged without inflating their count.
  const dedup = new Map();
  for (const item of candidates) {
    const key = radarFingerprint(item);
    const existing = dedup.get(key);
    if (!existing) dedup.set(key, item);
    else {
      existing.count = Math.max(existing.count, item.count);
      existing.contacts = Math.max(existing.contacts, item.contacts);
      existing.evidence_count += item.evidence_count;
      existing.unique_source_count = Math.max(existing.unique_source_count, item.unique_source_count);
      if (item.last_seen && (!existing.last_seen || new Date(item.last_seen) > new Date(existing.last_seen))) existing.last_seen = item.last_seen;
    }
  }
  let topDemands = [...dedup.values()].sort((a,b) => b.count - a.count).slice(0, 100);

  const history = await loadComparableRadarHistory(result, headers);
  const previous = history[0] || null;
  const previousSignals = extractPreviousSignals(previous);
  const previousByFingerprint = new Map(previousSignals.map(x => [x.fingerprint, x]));
  const currentFingerprints = new Set(topDemands.map(x => x.fingerprint));
  const historicalSignalCounts = new Map();
  const historicalFirstSeen = new Map();
  const historicalBeforePrevious = new Set();
  for (let hi=0; hi<history.length; hi++) {
    const report = history[hi];
    for (const signal of extractPreviousSignals(report)) {
      historicalSignalCounts.set(signal.fingerprint,(historicalSignalCounts.get(signal.fingerprint)||0)+1);
      const seen = signal.first_seen || signal.last_seen || report.period_start || report.generated_at || null;
      if (seen) {
        const prior = historicalFirstSeen.get(signal.fingerprint);
        if (!prior || new Date(seen) < new Date(prior)) historicalFirstSeen.set(signal.fingerprint,seen);
      }
      if (hi >= 1) historicalBeforePrevious.add(signal.fingerprint);
    }
  }

  topDemands = topDemands.map(item => {
    const prev = previousByFingerprint.get(item.fingerprint);
    const pc = Number(prev?.count || 0);
    const cc = Number(item.count || 0);
    const delta = cc - pc;
    const deltaPercent = pc ? Math.round((delta / pc) * 100) : null;
    const historicalOccurrences=Number(historicalSignalCounts.get(item.fingerprint)||0);
    const recurringAfterGap = historicalBeforePrevious.has(item.fingerprint) && !prev;
    let state;
    if (prev) {
      state = delta > 0 ? 'progressing' : delta < 0 ? 'declining' : (historicalBeforePrevious.has(item.fingerprint) ? 'recurring' : 'stable');
    } else {
      state = historicalOccurrences >= 2 || recurringAfterGap ? 'recurring' : 'new';
    }
    return {
      ...item,
      signal_state: state,
      previous_count: pc,
      delta,
      delta_percent: deltaPercent,
      first_seen: historicalFirstSeen.get(item.fingerprint) || prev?.first_seen || item.last_seen || null,
      previous_report_id: previous?.id || null
    };
  });

  // A comparable previous report lets us explicitly retain disappeared signals.
  const disappeared = previousSignals
    .filter(x => !currentFingerprints.has(x.fingerprint))
    .slice(0, 50)
    .map(x => ({
      ...x,
      count: Number(x.count || 0),
      signal_state: 'disappeared',
      previous_count: Number(x.count || 0),
      delta: -Number(x.count || 0),
      delta_percent: -100,
      first_seen: x.first_seen || x.last_seen || null,
      previous_report_id: previous?.id || null
    }));

  const allStates = [...topDemands, ...disappeared];
  const stateCounts = allStates.reduce((acc,x)=>{acc[x.signal_state]=(acc[x.signal_state]||0)+1;return acc;},{});
  const matching = await enrichRadarWithMarketplaceMatching(topDemands,result,headers).catch(()=>({signals:topDemands,marketplace_offer_count:0,matched_signal_count:0,unmatched_signal_count:topDemands.length,matched_demand_count:0,unmatched_demand_count:topDemands.reduce((n,x)=>n+Number(x.count||0),0),demand_signal_total:topDemands.reduce((n,x)=>n+Number(x.count||0),0),coverage_rate:0,matching_method:'matching indisponible'}));
  topDemands = matching.signals;
  const mergedStates=[...topDemands,...disappeared];
  const sourceBreakdown = {[sourceType]: Number(result.signal_count || 0)};
  const eligibleDemandCount = zones.reduce((n,z)=>n+(Array.isArray(z.products)?z.products.filter(p=>sourceType!=='web'||p.eligible_for_demand!==false).reduce((m,p)=>m+Number(p.signal_count||0),0):0),0);

const previousGapMap = new Map();
  const historicalGapCounts = new Map();
  for (const report of history) {
    const gaps=Array.isArray(report?.report?.matching?.gaps)?report.report.matching.gaps:[];
    for (const g of gaps) { const key=radarFingerprint(g); historicalGapCounts.set(key,(historicalGapCounts.get(key)||0)+1); }
  }
  const prevMatching=previous?.report?.matching||{};
  for (const g of (Array.isArray(prevMatching.gaps)?prevMatching.gaps:[])) previousGapMap.set(radarFingerprint(g),g);
  for (const g of matching.gaps) {
    const key=radarFingerprint(g), prevGap=previousGapMap.get(key), occurrences=Number(historicalGapCounts.get(key)||0);
    g.previous_gap_count=Number(prevGap?.count||0); g.gap_delta=Number(g.count||0)-g.previous_gap_count;
    g.gap_state=prevGap?(g.gap_delta>0?'progressing':g.gap_delta<0?'declining':occurrences>=2?'recurring':'stable'):(occurrences>=2?'recurring':'new');
    g.gap_occurrences=occurrences+1; g.gap_persistence=occurrences>=2?'recurrent_history':prevGap?'confirmed_previous_period':'first_observed';
  }
  const gapPriority = (g) => {
    const count=Number(g.count||0), conf=g.confidence==='high'?3:g.confidence==='medium'?2:1;
    const persistence=g.gap_persistence==='confirmed_previous_period'?2:1;
    const state=g.gap_state==='progressing'?2:g.gap_state==='recurring'?2:g.gap_state==='declining'?1:1;
    return count*3 + conf*2 + persistence*2 + state;
  };
  for (const g of matching.gaps) g.priority_score=gapPriority(g);
  matching.gaps.sort((a,b)=>b.priority_score-a.priority_score || b.count-a.count);
  matching.gaps=matching.gaps.slice(0,50);
  matching.gap_prioritization={method:'volume + confidence + prior-period persistence + observed evolution',predictive:false};
  const payload = {
    period_start: start.toISOString(),
    period_end: now.toISOString(),
    demand_count: sourceType==='web' ? eligibleDemandCount : zones.reduce((n, z) => n + Number(z.demand_count || 0), 0),
    grouped_product_count: Number(result.discovered_count || 0),
    total_quantity: { value: 0 },
    top_demands: mergedStates.slice(0, 100),
    source_breakdown: sourceBreakdown,
    contactable_count: Number(result.contact_count || 0),
    unresolved_count: Number(result.signal_count || 0),
    report: {
      generated_by: 'wassafrica-geo-demand-radar',
      mode: 'geo-radar',
      hours: Number(result.hours || 6),
      scope: { locations: result.locations || [], products: result.products || [] },
      zones,
      sources: Array.isArray(result.sources) ? result.sources.slice(0, 120) : [],
      summary: result.summary || '',
      generated_at: result.generated_at || now.toISOString(),
      source_type: sourceType,
      matching: {
        marketplace_offer_count: matching.marketplace_offer_count,
        matched_signal_count: matching.matched_signal_count,
        unmatched_signal_count: matching.unmatched_signal_count,
        matched_demand_count: matching.matched_demand_count,
        unmatched_demand_count: matching.unmatched_demand_count,
        demand_signal_total: matching.demand_signal_total,
        coverage_rate: matching.coverage_rate,
        matching_method: matching.matching_method,
        gaps: Array.isArray(matching.gaps) ? matching.gaps : [],
        gap_history_reports: history.length,
        gap_prioritization: matching.gap_prioritization || null
      },
      evolution: {
        previous_report_id: previous?.id || null,
        comparable_previous_report: Boolean(previous),
        current_signal_count: topDemands.length,
        disappeared_count: disappeared.length,
        state_counts: stateCounts
      }
    },
    generation_status: 'generated'
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/demand_reports`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(payload)
  });
  if (!response.ok) return { persisted: false, reason: `report_insert_failed_${response.status}` };
  const saved = (await response.json().catch(() => []))[0];

  if (saved?.id && allStates.length) {
    const items = mergedStates.slice(0, 50).map((x) => ({
      report_id: saved.id,
      priority: x.signal_state === 'progressing' || x.count >= 10 ? 'urgent' : x.count >= 5 ? 'high' : 'normal',
      action_status: 'pending',
      notes: `${x.country || ''} / ${x.zone || ''} — ${x.product || 'Besoin'} — ${x.count} signal(s), état ${x.signal_state}, évolution ${x.delta >= 0 ? '+' : ''}${x.delta}, confiance ${x.confidence || 'low'}.`
    }));
    await fetch(`${SUPABASE_URL}/rest/v1/demand_report_items`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(items)
    }).catch(() => {});
  }
  return {
    persisted: Boolean(saved?.id),
    report_id: saved?.id || null,
    matching: {
      marketplace_offer_count: matching.marketplace_offer_count,
      matched_signal_count: matching.matched_signal_count,
      unmatched_signal_count: matching.unmatched_signal_count,
      matched_demand_count: matching.matched_demand_count,
      unmatched_demand_count: matching.unmatched_demand_count,
      demand_signal_total: matching.demand_signal_total,
      coverage_rate: matching.coverage_rate,
      matching_method: matching.matching_method,
      gaps: Array.isArray(matching.gaps) ? matching.gaps : [],
      gap_history_reports: history.length
    },
    evolution: {
      previous_report_id: previous?.id || null,
      comparable_history_count: history.length,
      comparable_previous_report: Boolean(previous),
      new_count: stateCounts.new || 0,
      matching: { matched_signal_count: matching.matched_signal_count, unmatched_signal_count: matching.unmatched_signal_count, coverage_rate: matching.coverage_rate },
      progressing_count: stateCounts.progressing || 0,
      stable_count: stateCounts.stable || 0,
      declining_count: stateCounts.declining || 0,
      disappeared_count: stateCounts.disappeared || 0
    }
  };
}

async function generateInternalGeoDemandRadar({hours,locations,products}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return { ok:false, status:503, reason:'internal_memory_unavailable' };
  const safeLocations=Array.isArray(locations)?locations.filter(x=>x&&x.country&&x.location).slice(0,30):[];
  if(!safeLocations.length)return {ok:false,status:400,reason:'locations_required'};
  const start=new Date(Date.now()-Number(hours||6)*60*60*1000), end=new Date();
  const url=new URL(SUPABASE_URL+'/rest/v1/demand_observations');
  url.searchParams.set('select','id,normalized_product,quantity,unit,public_contact,source_platform,location_text,country_code,status,observed_at');
  url.searchParams.set('observed_at','gte.'+start.toISOString());
  url.searchParams.append('observed_at','lte.'+end.toISOString());
  url.searchParams.set('status','neq.rejected');
  url.searchParams.set('order','observed_at.desc');
  url.searchParams.set('limit','1000');
  const r=await fetch(url,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY},cache:'no-store'});
  if(!r.ok)return {ok:false,status:502,reason:'internal_observation_query_failed_'+r.status};
  const observations=await r.json().catch(()=>[]);
  const norm=v=>String(v||'').trim().toLowerCase();
  const match=(value,filter)=>radarGeoEqual(value,filter);
  const zones=safeLocations.map(loc=>{
    const rows=observations.filter(o=>match(o.country_code,loc.country)||match(o.location_text,loc.location));
    const filtered=products.length?rows.filter(o=>products.some(p=>match(o.normalized_product,p))):rows;
    const groups=new Map();
    for(const o of filtered){
      const product=String(o.normalized_product||'').trim();
      if(!product)continue;
      const key=norm(product);
      if(!groups.has(key))groups.set(key,{product,category:'signal interne',signal_count:0,intents:new Set(),evidence:[],communities:[],professional_contacts:[],confidence:'low',last_seen:null});
      const g=groups.get(key);
      g.signal_count++;
      if(o.observed_at&&(!g.last_seen||new Date(o.observed_at)>new Date(g.last_seen)))g.last_seen=o.observed_at;
      if(o.source_platform)g.intents.add('Signal enregistré via '+o.source_platform);
      if(o.public_contact)g.professional_contacts.push({organization:'',name:'',role:'',email:'',phone:String(o.public_contact),website:'',source_url:'',contact_type:'public_contact',contact_relation:'source_observation'});
    }
    const productsOut=[...groups.values()].map(g=>{
      g.intent=[...g.intents].join(' · ')||'Besoin enregistré dans la mémoire WASSAFRICA';
      g.confidence=g.signal_count>=5?'high':g.signal_count>=2?'medium':'low';
      g.evidence=[{text:g.signal_count+' signal(s) interne(s) enregistré(s) dans WASSAFRICA sur la fenêtre demandée.',source_title:'Mémoire interne WASSAFRICA',source_url:'',date:g.last_seen||end.toISOString()}];
      g.professional_contacts=g.professional_contacts.slice(0,10);
      delete g.intents;
      return g;
    }).sort((a,b)=>b.signal_count-a.signal_count).slice(0,30);
    return {country:loc.country,location:loc.location,demand_count:productsOut.reduce((n,p)=>n+p.signal_count,0),products:productsOut,offers:[],uncertain:[]};
  });
  const signal_count=zones.reduce((n,z)=>n+z.demand_count,0);
  return {ok:true,available:true,web_available:false,fallback:'internal_memory',hours:Number(hours||6),locations:safeLocations,products, zones,discovered_count:zones.reduce((n,z)=>n+z.products.length,0),signal_count,contact_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.professional_contacts.length,0),0),sources:[{title:'Mémoire interne WASSAFRICA',url:''}],summary:signal_count?'Recherche web externe indisponible : résultats issus de la mémoire interne WASSAFRICA.':'Recherche web externe indisponible et aucun signal interne correspondant trouvé.',generated_at:new Date().toISOString(),search_method:'WASSAFRICA internal demand memory fallback'};
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
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-sol',tools:[{type:'web_search',search_context_size:'high'}],input:prompt,max_output_tokens:12000})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const msg=String(data?.error?.message||'').toLowerCase();const quota=r.status===429||/no credits|insufficient[_ -]?quota|quota|billing|credit balance|rate limit/.test(msg);if(quota){const fallback=await generateInternalGeoDemandRadar({hours,locations: safeLocations,products}).catch(()=>null);if(fallback?.ok){const persistence=await persistRadarReport(fallback).catch((error)=>({persisted:false,reason:error?.message||'radar_persistence_failed'}));return {...fallback,persistence};}return {ok:false,status:quota?503:502,reason:quota?'web_quota_exhausted':'web_provider_unavailable'};}}
  const outputText=String(data?.output_text||((data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x?.text||'').join('\\n'))||'');
  const parsed=parseWebJson(outputText)||{zones:[],summary:outputText.slice(0,1600),search_method:'web_search'};
  const cleanUrl=(v)=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const cleanArr=(v,max=20)=>Array.isArray(v)?v.map(x=>cleanWeb(x,max)).filter(Boolean).slice(0,max):[];
  const now=new Date();
  const zones=safeLocations.map(loc=>{const z=(Array.isArray(parsed.zones)?parsed.zones:[]).find(x=>radarGeoEqual(x.country,loc.country)&&radarGeoEqual(x.location,loc.location))||{};return {country:loc.country,location:loc.location,demand_count:Math.max(0,Number(z.demand_count)||0),products:(Array.isArray(z.products)?z.products:[]).map(p=>{const evidence=(Array.isArray(p.evidence)?p.evidence:[]).map(e=>{const date=cleanWeb(e.date,80);const freshness=radarFreshness(date,hours,now);return {text:cleanWeb(e.text,500),source_title:cleanWeb(e.source_title,220),source_url:cleanUrl(e.source_url),date,freshness_status:freshness.status,freshness_hours:freshness.hours,source_date:freshness.source_date,evidence_level:radarEvidenceLevel(e.text,p.intent)}}).filter(e=>e.source_url).slice(0,8);const fresh=evidence.filter(e=>e.freshness_status==='fresh');const freshness_status=fresh.length?'fresh':evidence.some(e=>e.freshness_status==='stale')?'stale':'unknown';const evidence_level=evidence.reduce((best,e)=>({E0:0,E1:1,E2:2,E3:3}[e.evidence_level]||0)>({E0:0,E1:1,E2:2,E3:3}[best]||0)?e.evidence_level:best,evidence[0]?.evidence_level||'E0');const eligible_for_demand=freshness_status==='fresh'&&(evidence_level==='E2'||evidence_level==='E3');return {product:cleanWeb(p.product,180),category:cleanWeb(p.category,120),signal_count:Math.max(0,Number(p.signal_count)||0),intent:cleanWeb(p.intent,280),evidence,communities:(Array.isArray(p.communities)?p.communities:[]).map(x=>({name:cleanWeb(x.name,160),type:cleanWeb(x.type,80),url:cleanUrl(x.url)})).filter(x=>x.name&&x.url).slice(0,8),professional_contacts:(Array.isArray(p.professional_contacts)?p.professional_contacts:[]).map(x=>({organization:cleanWeb(x.organization,180),name:cleanWeb(x.name,140),role:cleanWeb(x.role,120),email:cleanWeb(x.email,180),phone:cleanWeb(x.phone,80),website:cleanUrl(x.website),source_url:cleanUrl(x.source_url),contact_type:'professional_public',contact_relation:'source_context'})).filter(x=>x.organization||x.email||x.phone).slice(0,8),confidence:/^(high|medium|low)$/i.test(String(p.confidence))?String(p.confidence).toLowerCase():'low',evidence_level,freshness_status,eligible_for_demand,last_seen:cleanWeb(p.last_seen,80)};}).filter(p=>p.product&&p.evidence.length).slice(0,50),offers:(Array.isArray(z.offers)?z.offers:[]).map(x=>({product:cleanWeb(x.product,180),source_title:cleanWeb(x.source_title,220),source_url:cleanUrl(x.source_url),date:cleanWeb(x.date,80)})).filter(x=>x.product&&x.source_url).slice(0,30),uncertain:(Array.isArray(z.uncertain)?z.uncertain:[]).map(x=>({product:cleanWeb(x.product,180),reason:cleanWeb(x.reason,350),source_title:cleanWeb(x.source_title,220),source_url:cleanUrl(x.source_url)})).filter(x=>x.product&&x.source_url).slice(0,30)};});
  const sources=new Map();for(const z of zones){for(const p of z.products){for(const e of p.evidence)sources.set(e.source_url,{url:e.source_url,title:e.source_title||e.source_url});for(const x of p.communities)sources.set(x.url,{url:x.url,title:x.name});for(const x of p.professional_contacts)if(x.source_url)sources.set(x.source_url,{url:x.source_url,title:x.organization||x.source_url});}for(const x of [...z.offers,...z.uncertain])sources.set(x.source_url,{url:x.source_url,title:x.source_title||x.source_url});}
  const result={ok:true,mode:'geo-radar',hours,locations:safeLocations,products,discovered_count:zones.reduce((n,z)=>n+z.products.length,0),signal_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.signal_count,0),0),community_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.communities.length,0),0),contact_count:zones.reduce((n,z)=>n+z.products.reduce((m,p)=>m+p.professional_contacts.length,0),0),zones,summary:cleanWeb(parsed.summary,1600),sources:[...sources.values()].slice(0,120),generated_at:new Date().toISOString(),search_method:'OpenAI Responses API + web search'};
  const persistence=await persistRadarReport(result).catch((error)=>({persisted:false,reason:error?.message||'radar_persistence_failed'}));
  return {...result,persistence};
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
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-sol',tools:[{type:'web_search',search_context_size:'high'}],input:prompt,max_output_tokens:12000})});
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


async function generateBookDemandRadar({hours,title,description,countries,zones,languages}) {
  const OPENAI_KEY=process.env.OPENAI_API_KEY||process.env.wassAfrica;
  if(!OPENAI_KEY)return {ok:false,status:503,reason:'OPENAI_API_KEY_missing'};
  const safeTitle=cleanWeb(title,500), safeDescription=cleanWeb(description,1800);
  if(!safeTitle)return {ok:false,status:400,reason:'book_title_required'};
  const scope=[...countries,...zones].join(' | ')||'monde entier';
  const langLabel=languages.length?languages.join(', '):'déterminer les langues pertinentes selon les signaux';
  const prompt=`Tu es WASSAFRICA DIGITAL BOOK DEMAND INTELLIGENCE. Analyse ce livre et recherche sur le web public où ses thèmes correspondent à des signaux d'intérêt ou de demande éditoriale.
TITRE: ${safeTitle}
DESCRIPTION/AUTEUR: ${safeDescription||'non fournie'}
ZONES CIBLÉES: ${scope}
LANGUES: ${langLabel}
FENÊTRE CIBLE: ${hours} heures; utilise les sources publiques récentes disponibles et conserve leurs dates.

RÈGLES: décompose le livre en thèmes, sous-thèmes, entités, mots-clés et publics; recherche par pays/zone les discussions, questions, recherches de ressources et intentions de lecture; distingue DEMANDE/INTÉRÊT LECTEUR, OFFRE/CONCURRENCE et INCERTAIN; une offre ne compte jamais comme demande; ne transforme jamais un intérêt thématique en vente; ne fabrique aucun chiffre, contact, pays, date ou URL; chaque résultat doit avoir une source publique réellement consultée; les adaptations (langue, sous-titre, angle, format) ne sont proposées que lorsqu'elles sont appuyées par les signaux.

Retourne UNIQUEMENT ce JSON:
{"book":{"title":"","themes":[],"keywords":[],"audiences":[]},"markets":[{"country":"","location":"","languages":[],"theme":"","demand_signals":0,"interest_type":"","evidence":[{"text":"","source_title":"","source_url":"","date":""}],"communities":[{"name":"","url":"","type":""}],"competition":[{"title":"","source_url":"","date":""}],"coverage_gap":"","adaptation":"","confidence":"high|medium|low","last_seen":""}],"offers":[{"title":"","country":"","source_url":"","date":"","relevance":""}],"uncertain":[{"country":"","theme":"","reason":"","source_url":""}],"summary":"","search_method":"OpenAI Responses API + web search"}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-sol',tools:[{type:'web_search',search_context_size:'high'}],input:prompt,max_output_tokens:12000})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const msg=String(data?.error?.message||'').toLowerCase();const quota=r.status===429||/no credits|insufficient[_ -]?quota|quota|billing|credit balance|rate limit/.test(msg);return {ok:false,status:quota?503:502,reason:quota?'web_quota_exhausted':'web_provider_unavailable'};}
  const outputText=String(data?.output_text||((data?.output||[]).filter(x=>x?.type==='message').flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text').map(x=>x?.text||'').join('\n'))||'');
  const parsed=parseWebJson(outputText)||{book:{title:safeTitle,themes:[],keywords:[],audiences:[]},markets:[],offers:[],uncertain:[],summary:outputText.slice(0,1600),search_method:'web_search'};
  const cleanUrl=(v)=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const arr=(v,n=20)=>Array.isArray(v)?v.map(x=>cleanWeb(x,n)).filter(Boolean).slice(0,n):[];
  const markets=Array.isArray(parsed.markets)?parsed.markets.map(m=>({country:cleanWeb(m.country,100),location:cleanWeb(m.location,140),languages:arr(m.languages,8),theme:cleanWeb(m.theme,180),demand_signals:Math.max(0,Number(m.demand_signals)||0),interest_type:cleanWeb(m.interest_type,240),evidence:(Array.isArray(m.evidence)?m.evidence:[]).map(e=>({text:cleanWeb(e.text,500),source_title:cleanWeb(e.source_title,220),source_url:cleanUrl(e.source_url),date:cleanWeb(e.date,80)})).filter(e=>e.source_url).slice(0,8),communities:(Array.isArray(m.communities)?m.communities:[]).map(c=>({name:cleanWeb(c.name,160),url:cleanUrl(c.url),type:cleanWeb(c.type,80)})).filter(c=>c.name&&c.url).slice(0,8),competition:(Array.isArray(m.competition)?m.competition:[]).map(c=>({title:cleanWeb(c.title,200),source_url:cleanUrl(c.source_url),date:cleanWeb(c.date,80)})).filter(c=>c.title&&c.source_url).slice(0,8),coverage_gap:cleanWeb(m.coverage_gap,500),adaptation:cleanWeb(m.adaptation,500),confidence:/^(high|medium|low)$/i.test(String(m.confidence))?String(m.confidence).toLowerCase():'low',last_seen:cleanWeb(m.last_seen,80)})).filter(m=>m.country&&m.evidence.length).slice(0,60):[];
  const book={title:safeTitle,themes:arr(parsed.book?.themes,30),keywords:arr(parsed.book?.keywords,40),audiences:arr(parsed.book?.audiences,20)};
  const offers=Array.isArray(parsed.offers)?parsed.offers.map(o=>({title:cleanWeb(o.title,200),country:cleanWeb(o.country,100),source_url:cleanUrl(o.source_url),date:cleanWeb(o.date,80),relevance:cleanWeb(o.relevance,300)})).filter(o=>o.title&&o.source_url).slice(0,50):[];
  const uncertain=Array.isArray(parsed.uncertain)?parsed.uncertain.map(x=>({country:cleanWeb(x.country,100),theme:cleanWeb(x.theme,180),reason:cleanWeb(x.reason,400),source_url:cleanUrl(x.source_url)})).filter(x=>x.source_url).slice(0,40):[];
  const sourceSet=new Map();for(const m of markets){for(const e of m.evidence)sourceSet.set(e.source_url,{url:e.source_url,title:e.source_title||e.source_url});for(const c of m.communities)sourceSet.set(c.url,{url:c.url,title:c.name});for(const c of m.competition)sourceSet.set(c.source_url,{url:c.source_url,title:c.title});}for(const o of offers)sourceSet.set(o.source_url,{url:o.source_url,title:o.title});for(const u of uncertain)sourceSet.set(u.source_url,{url:u.source_url,title:u.theme||u.source_url});for(const s of webAnnotations(data))sourceSet.set(s.url,s);
  return {ok:true,mode:'book-radar',book,scope:{countries,zones,languages,hours},market_count:markets.length,signal_count:markets.reduce((n,m)=>n+m.demand_signals,0),markets,offers,uncertain,sources:[...sourceSet.values()].slice(0,160),summary:cleanWeb(parsed.summary,1800),generated_at:new Date().toISOString(),note:'Le radar mesure des signaux publics thématiques et éditoriaux; un intérêt pour un sujet ne constitue pas une vente ni une intention d’achat certaine. Les offres concurrentes sont séparées.',search_method:'OpenAI Responses API + web search'};
}

// Shared web intelligence keeps the Hobby deployment within the serverless function budget.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const requestedHours = Number(req.query?.hours || 6); const hours = Number.isFinite(requestedHours) && requestedHours > 0 && requestedHours <= 168 ? requestedHours : 6;
  const countries = normalizeArray(csv(req.query?.countries || process.env.DEMAND_COUNTRIES)); const zones = normalizeArray(csv(req.query?.zones || process.env.DEMAND_ZONES)); const products = normalizeArray(csv(req.query?.products || req.query?.product || process.env.DEMAND_PRODUCTS)); const locations = (()=>{ try { const raw=String(req.query?.locations||''); return raw ? JSON.parse(raw).filter(x=>x&&x.country&&x.location) : []; } catch { return []; } })(); const languages = normalizeArray(csv(req.query?.languages || '')); const bookTitle=String(req.query?.book_title||'').trim(); const bookDescription=String(req.query?.book_description||'').trim();
  const auth = req.headers.authorization || ''; const cronAuthorized = Boolean(process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`);
  let result;
  if (cronAuthorized) result = await generateForCron({ hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'cron_generation_failed' }));
  else {
    const admin = await validateAdminBearer(auth).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'authorization_error' }));
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.reason });
    if (String(req.query?.mode || '') === 'book-radar') {
      result = await generateBookDemandRadar({ hours, title: bookTitle, description: bookDescription, countries, zones, languages }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'book_radar_search_failed' }));
    } else if (String(req.query?.mode || '') === 'geo-radar') {
      result = await generateGeoDemandRadar({ hours, locations, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'geo_radar_search_failed' }));
    } else if (String(req.query?.mode || '') === 'radar') {
      const target = Number(req.query?.target || 100);
      result = await generateGlobalDemandRadar({ hours, target }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'radar_search_failed' }));
    } else if (String(req.query?.web || '') === '1') {
      result = await generateExternalWebDemand({ hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'web_search_failed' }));
    } else {
      result = await generateForAdmin({ token: admin.token, hours, countries, zones, products }).catch((error) => ({ ok: false, status: 500, reason: error?.message || 'admin_generation_failed' }));
    }
  }

  if (!result?.ok) {
    if (String(req.query?.web || '') === '1' || ['radar','geo-radar','book-radar'].includes(String(req.query?.mode || ''))) {
      const quota = result.reason === 'web_quota_exhausted';
      return res.status(result.status || 503).json({
        ok: false,
        available: false,
        web_available: false,
        web_error_code: quota ? 'quota_exhausted' : 'provider_unavailable',
        web_error_message: quota ? 'Recherche web externe temporairement indisponible (quota fournisseur épuisé).' : 'Recherche web externe temporairement indisponible.',
        mode: ['radar','geo-radar','book-radar'].includes(String(req.query?.mode || '')) ? String(req.query?.mode || '') : 'web',
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
  if (['radar','geo-radar','book-radar'].includes(String(req.query?.mode || ''))) return res.status(200).json(result);
  const scopeLabel = [...(countries || []), ...(zones || [])].join(', ') || 'Monde entier'; const productLabel = products.length ? products.join(', ') : 'Tous produits / besoins'; const clusters = Array.isArray(result.clusters) ? result.clusters : [];
  const lines = clusters.map((x) => `- ${x.product}: ${x.quantity || 0} ${x.unit || ''} — ${x.count} demande(s) — ${x.contacts || 0} contact(s) public(s)`);
  const text = ['WASSAFRICA — RAPPORT DES BESOINS', `Période: ${result.window_start} → ${result.window_end}`, `Durée: ${result.hours} h`, `Zone(s): ${scopeLabel}`, `Produit(s): ${productLabel}`, `Demandes: ${result.demand_count}`, `Produits regroupés: ${result.cluster_count}`, '', ...(lines.length ? lines : ['Aucune demande détectée sur ce périmètre.']), '', `Rapport ID: ${result.report_id || 'n/a'}`].join('\n');
  const html = `<h2>WASSAFRICA — Rapport des besoins</h2><p><b>Période :</b> ${escapeHtml(result.window_start)} → ${escapeHtml(result.window_end)}</p><p><b>Durée :</b> ${result.hours} h · <b>Zone(s) :</b> ${escapeHtml(scopeLabel)}</p><p><b>Produit(s) :</b> ${escapeHtml(productLabel)}</p><p><b>Demandes :</b> ${result.demand_count} · <b>Produits regroupés :</b> ${result.cluster_count}</p><ul>${clusters.length ? clusters.map((x) => `<li><b>${escapeHtml(x.product)}</b> — ${escapeHtml(x.quantity || 0)} ${escapeHtml(x.unit || '')} — ${x.count} demande(s) — ${x.contacts || 0} contact(s) public(s)</li>`).join('') : '<li>Aucune demande détectée sur ce périmètre.</li>'}</ul><p>Rapport ID : ${escapeHtml(result.report_id || 'n/a')}</p>`;
  const email = await sendEmail({ subject: `WassAfrica — demandes — ${productLabel} — ${scopeLabel}`, html, text });
  return res.status(200).json({ ...result, email });
}