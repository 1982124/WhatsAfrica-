const {URL}=require('url');
const dns=require('dns').promises;
const net=require('net');
const MAX_HTML=1000000;
const MAX_REDIRECTS=15;
const FETCH_TIMEOUT_MS=15000;
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001F\u007F]/g,'').slice(0,n).trim():'';
const norm=s=>clean(s,300).toLowerCase().replace(/\s+/g,' ');
function privateIp(ip){
  if(!ip)return false;
  const v=ip.toLowerCase();
  if(v==='::1'||v.startsWith('fc')||v.startsWith('fd')||v.startsWith('fe80:'))return true;
  if(net.isIP(v)===4){
    const [a,b]=v.split('.').map(Number);
    return a===10||a===127||a===169&&b===254||a===192&&b===168||a===172&&b>=16&&b<=31;
  }
  if(net.isIP(v)===6&&v.startsWith('::ffff:'))return privateIp(v.slice(7));
  return false;
}
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
function cookieHeader(jar){return [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; ')}
function storeCookies(headers,jar){
  const values=typeof headers.getSetCookie==='function'?headers.getSetCookie():[];
  for(const raw of values){const first=String(raw).split(';',1)[0];const i=first.indexOf('=');if(i>0)jar.set(first.slice(0,i).trim(),first.slice(i+1).trim())}
  if(!values.length){const raw=headers.get('set-cookie');if(raw){for(const part of raw.split(/,(?=[^;]+=[^;]+)/)){const first=part.split(';',1)[0],i=first.indexOf('=');if(i>0)jar.set(first.slice(0,i).trim(),first.slice(i+1).trim())}}}
}
function loopKey(u){const x=new URL(u.toString());x.hash='';if((x.protocol==='http:'&&x.port==='80')||(x.protocol==='https:'&&x.port==='443'))x.port='';return x.toString()}
async function fetchHtml(start){
  let u=await safeUrl(start);
  const seen=new Set(),jar=new Map();
  let referer='';
  for(let redirects=0;;redirects++){
    const key=loopKey(u);
    if(seen.has(key)){
      console.warn('import-site redirect-loop',{url:u.toString(),redirects,chain:[...seen]});
      throw new Error('Boucle de redirection détectée. Le site demande probablement une session ou un accès navigateur.');
    }
    seen.add(key);
    if(redirects>MAX_REDIRECTS)throw new Error('Trop de redirections. Vérifiez le lien du site ou du produit.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
    let r;
    try{
      const headers={
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 WhatsAfricaBot/2.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language':'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control':'no-cache',
        'Pragma':'no-cache'
      };
      if(referer)headers.Referer=referer;
      const cookies=cookieHeader(jar);if(cookies)headers.Cookie=cookies;
      r=await fetch(u,{redirect:'manual',signal:controller.signal,headers});
      storeCookies(r.headers,jar);
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Le site a mis trop de temps à répondre.');
      if(/redirect/i.test(e?.message||''))throw new Error('Redirection impossible depuis ce lien.');
      throw e;
    }finally{clearTimeout(timer)}
    if(r.status>=300&&r.status<400){
      const location=r.headers.get('location');
      if(!location)throw new Error('Le site a renvoyé une redirection sans destination.');
      const next=absolute(location,u.toString());
      if(!next)throw new Error('Destination de redirection invalide.');
      referer=u.toString();
      u=await safeUrl(next);
      continue;
    }
    if(!r.ok)throw new Error(`Le site a répondu avec le statut ${r.status}.`);
    const contentType=r.headers.get('content-type')||'';
    if(!/text\/html|application\/xhtml\+xml/i.test(contentType))throw new Error('Cette URL ne contient pas de page HTML exploitable. Utilisez le lien d’un site internet ou d’une page produit.');
    return {url:u,html:(await r.text()).slice(0,MAX_HTML)};
  }
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
    const status=/Adresse|lien doit|redirections|Boucle|page HTML|site a répondu|temps à répondre/i.test(e.message||'')?400:502;
    return res.status(status).json({error:e.message||'Import impossible.'});
  }
};