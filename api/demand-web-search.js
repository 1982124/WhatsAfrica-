const SUPABASE_URL=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const OPENAI_KEY=process.env.OPENAI_API_KEY||process.env.wassAfrica;
function csv(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,20)}
function clean(v,n=500){return String(v??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,n)}
async function admin(req){
  const auth=String(req.headers.authorization||'');const token=auth.match(/^Bearer\s+(.+)$/i)?.[1];if(!token)return {ok:false,status:401};
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token},cache:'no-store'});
  if(!r.ok)return {ok:false,status:401};const user=await r.json().catch(()=>null);if(!user?.id)return {ok:false,status:401};
  const p=await fetch(SUPABASE_URL+'/rest/v1/rpc/is_platform_admin',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});const a=await p.json().catch(()=>false);
  if(!p.ok||a!==true)return {ok:false,status:403};return {ok:true,userId:user.id};
}
function annotations(response){
  const out=[];for(const item of (response?.output||[])){for(const part of (item?.content||[])){for(const a of (part?.annotations||[])){if(a?.type==='url_citation'&&a.url)out.push({url:a.url,title:a.title||a.url});}}}
  const seen=new Set();return out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,30);
}
function parseJson(text){
  const raw=String(text||'').replace(/^\`\`\`json/i,'').replace(/\`\`\`$/,'').trim();try{return JSON.parse(raw)}catch{}
  const a=raw.indexOf('{'),b=raw.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}
  return null;
}
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  if(!OPENAI_KEY)return res.status(503).json({ok:false,error:'OPENAI_API_KEY_missing'});
  const a=await admin(req).catch(()=>({ok:false,status:500}));if(!a.ok)return res.status(a.status||500).json({ok:false,error:a.status===403?'platform_admin_required':'invalid_or_expired_token'});
  const hours=Math.min(168,Math.max(1,Number(req.query?.hours||168)||168)),countries=csv(req.query?.countries),zones=csv(req.query?.zones),products=csv(req.query?.products||req.query?.product);
  const scope=[...countries,...zones].join(', ')||'monde entier', productLabel=products.join(', ')||'produits et besoins';
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
{"demands":[{"product":"","location":"","intent":"","evidence":"","source_title":"","source_url":"","date":""}],"offers":[{"product":"","location":"","evidence":"","source_title":"","source_url":"","date":""}],"uncertain":[{"product":"","location":"","reason":"","source_title":"","source_url":""}],"summary":"","search_method":""}
`;
  const body={model:process.env.WASSAFRICA_DEMAND_WEB_MODEL||'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:5000};
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));if(!r.ok)return res.status(502).json({ok:false,error:clean(data?.error?.message||'web_search_failed',300)});
  const parsed=parseJson(data.output_text||'')||{demands:[],offers:[],uncertain:[],summary:'',search_method:'web_search'};
  const sources=annotations(data);
  const sourceMap=new Map(sources.map(s=>[s.url,s]));
  const normalize=x=>Array.isArray(x)?x.map(i=>({...i,product:clean(i.product,180),location:clean(i.location,180),intent:clean(i.intent,240),evidence:clean(i.evidence,600),source_title:clean(i.source_title,240),source_url:clean(i.source_url,2000),date:clean(i.date,80)})).filter(i=>i.source_url):[];
  const demands=normalize(parsed.demands).filter(x=>/demand|request|search|buy|purchase|need|quote|supplier|looking/i.test(x.intent+' '+x.evidence));
  const offers=normalize(parsed.offers);
  for(const x of [...demands,...offers])if(x.source_url&&!sourceMap.has(x.source_url))sources.push({url:x.source_url,title:x.source_title||x.source_url});
  return res.status(200).json({ok:true,scope:{countries,zones,products,hours},demand_count:demands.length,signal_count:demands.length+offers.length+(Array.isArray(parsed.uncertain)?parsed.uncertain.length:0),demands:demands.slice(0,30),offers:offers.slice(0,30),sources:sources.slice(0,30),summary:clean(parsed.summary,1200),note:'Les résultats web sont des signaux publics sourcés. Les offres/vendeurs ne sont jamais comptés comme demandes. Une vente réelle doit être confirmée par une transaction ou un signal WassAfrica.',search_method:'OpenAI Responses API + web search'});
};