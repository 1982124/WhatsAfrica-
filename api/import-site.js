const {URL}=require('url');
const dns=require('dns').promises;
const MAX_HTML=1000000;
const MAX_REDIRECTS=5;
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001F\u007F]/g,'').slice(0,n).trim():'';
const norm=s=>clean(s,300).toLowerCase().replace(/\s+/g,' ');
function privateIp(ip){return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip)}
async function safeUrl(raw){
  const u=new URL(raw);
  if(!['http:','https:'].includes(u.protocol))throw new Error('Le lien doit commencer par http:// ou https://');
  if(u.hostname==='localhost'||privateIp(u.hostname))throw new Error('Adresse de site non autorisée.');
  const addrs=await dns.lookup(u.hostname,{all:true});
  if(addrs.some(a=>privateIp(a.address)))throw new Error('Adresse réseau privée refusée.');
  return u;
}
const absolute=(v,b)=>{try{return new URL(v,b).toString()}catch{return ''}};
function strip(s){return clean(String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' '),700)}
function jsonLd(html,base){const out=[],re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))){try{const d=JSON.parse(m[1]),nodes=Array.isArray(d)?d:(d['@graph']||[d]);for(const x of nodes){const t=x?.['@type'];if(t==='Product'||(Array.isArray(t)&&t.includes('Product'))){const o=Array.isArray(x.offers)?x.offers[0]:x.offers;out.push({title:strip(x.name),description:strip(x.description),price:clean(o?.price,50),currency:clean(o?.priceCurrency,20)||'FCFA',image_url:absolute(Array.isArray(x.image)?x.image[0]:x.image,base),kind:'produit'})}}}catch{}}return out}
function meta(html,base){const tags=html.match(/<meta[^>]+>/gi)||[],m={};for(const t of tags){const n=(t.match(/(?:property|name)=["']([^"']+)["']/i)||[])[1],c=(t.match(/content=["']([^"']*)["']/i)||[])[1];if(n&&c)m[n.toLowerCase()]=c}return m['og:title']?[{title:strip(m['og:title']),description:strip(m['og:description']),price:'',currency:'FCFA',image_url:absolute(m['og:image'],base),kind:'produit'}]:[]}
async function fetchHtml(start){
  let u=await safeUrl(start);
  for(let redirects=0;redirects<=MAX_REDIRECTS;redirects++){
    const r=await fetch(u,{redirect:'manual',headers:{'User-Agent':'WhatsAfricaCatalogBot/1.1','Accept':'text/html,application/xhtml+xml'}});
    if(r.status>=300&&r.status<400){
      const location=r.headers.get('location');
      if(!location)throw new Error('Le site a renvoyé une redirection sans destination.');
      if(redirects===MAX_REDIRECTS)throw new Error('Trop de redirections. Vérifiez le lien du site ou du produit.');
      u=await safeUrl(absolute(location,u.toString()));
      continue;
    }
    if(!r.ok)throw new Error(`Le site a répondu avec le statut ${r.status}.`);
    const contentType=r.headers.get('content-type')||'';
    if(!/text\/html|application\/xhtml\+xml/i.test(contentType))throw new Error('Cette URL ne contient pas de page HTML exploitable. Utilisez le lien d’un site internet ou d’une page produit.');
    return {url:u,html:(await r.text()).slice(0,MAX_HTML)};
  }
  throw new Error('Import impossible.');
}
module.exports=async function(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
  try{
    const raw=clean(req.body?.url,1000);
    if(!raw)return res.status(400).json({error:'Le lien du site ou du produit est requis.'});
    const {url,html}=await fetchHtml(raw);
    let products=jsonLd(html,url.toString());
    if(!products.length)products=meta(html,url.toString());
    const seen=new Set();
    products=products.filter(p=>p.title&&!seen.has(norm(p.title))&&seen.add(norm(p.title))).slice(0,30);
    return res.status(200).json({source_url:url.toString(),products,count:products.length,message:products.length?'Analyse terminée. Vérifiez puis validez les produits proposés.':'Page récupérée, mais aucun produit structuré n’a été détecté.'});
  }catch(e){
    console.error('import-site',e);
    const status=/Adresse|lien doit|redirections|page HTML|site a répondu/i.test(e.message||'')?400:502;
    return res.status(status).json({error:e.message||'Import impossible.'});
  }
};
