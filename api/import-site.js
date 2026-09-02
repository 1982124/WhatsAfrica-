const {URL}=require('url');
const dns=require('dns').promises;
const net=require('net');
const MAX_HTML=1000000;
const MAX_READER_TEXT=120000;
const MAX_REDIRECTS=10;
const MAX_READER_REDIRECTS=5;
const FETCH_TIMEOUT_MS=15000;
const READER_TIMEOUT_MS=20000;
const RATE_LIMIT=10;
const RATE_WINDOW=60;
const memoryBuckets=new Map();
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001F\u007F]/g,'').slice(0,n).trim():'';
const norm=s=>clean(s,300).toLowerCase().replace(/\s+/g,' ');
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,120)}
function memoryLimited(req){const ip=clientIp(req),now=Date.now();let b=memoryBuckets.get(ip);if(!b||now-b.start>=RATE_WINDOW*1000)b={start:now,count:0};b.count++;memoryBuckets.set(ip,b);return b.count<=RATE_LIMIT}
async function limited(req){const ip=clientIp(req),url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;if(!url||!key)return memoryLimited(req);try{const r=await fetch(`${url}/rest/v1/rpc/consume_rate_limit`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_key:`import-site:${ip}`,p_limit:RATE_LIMIT,p_window_seconds:RATE_WINDOW})});if(!r.ok)return memoryLimited(req);const result=await r.json();return result===true||result?.allowed===true}catch{return memoryLimited(req)}}
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
function readerProducts(text,base){
  const src=String(text||'');
  const image=(src.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)[^)]*\)/i)||[])[1]||'';
  const title=(src.match(/^#{1,3}\s+(.+)$/m)||[])[1]||((src.match(/(?:title|product)\s*:\s*(.+)/i)||[])[1]||'');
  const price=((src.match(/(?:FCFA|XOF|USD|EUR|€|\$)\s*[0-9][0-9\s.,]*/i)||[])[0]||'').replace(/[^0-9.,]/g,'').replace(/\s/g,'');
  const cleanTitle=strip(title).replace(/\s*\|.*$/,'').slice(0,180);
  if(!cleanTitle)return [];
  const lines=src.split(/\n+/).map(x=>strip(x)).filter(Boolean);
  const description=lines.filter(x=>x!==cleanTitle&&!/^image\s*:/i.test(x)).slice(0,8).join(' ').slice(0,700);
  return [{title:cleanTitle,description,price,currency:/\bXOF\b|FCFA/i.test(src)?'XOF':'FCFA',image_url:absolute(image,base),kind:'produit'}];
}
function cookieHeader(jar){return [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; ')}
function storeCookies(headers,jar){const values=typeof headers.getSetCookie==='function'?headers.getSetCookie():[];for(const raw of values){const first=String(raw).split(';',1)[0];const i=first.indexOf('=');if(i>0)jar.set(first.slice(0,i).trim(),first.slice(i+1).trim())}if(!values.length){const raw=headers.get('set-cookie');if(raw){for(const part of raw.split(/,(?=[^;]+=[^;]+)/)){const first=part.split(';',1)[0],i=first.indexOf('=');if(i>0)jar.set(first.slice(0,i).trim(),first.slice(0,i).trim()&&first.slice(i+1).trim())}}}}
function loopKey(u){const x=new URL(u.toString());x.hash='';if((x.protocol==='http:'&&x.port==='80')||(x.protocol==='https:'&&x.port==='443'))x.port='';return x.toString()}
async function fetchReader(start){
  await safeUrl(start);
  let target=`https://r.jina.ai/${start}`;
  const seen=new Set();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),READER_TIMEOUT_MS);
  try{
    for(let redirects=0;redirects<=MAX_READER_REDIRECTS;redirects++){
      const key=loopKey(new URL(target));
      if(seen.has(key))throw new Error('Le lecteur de secours a rencontré une boucle de redirection.');
      seen.add(key);
      const r=await fetch(target,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'WhatsAfricaImporter/2.3','Accept':'text/markdown,text/plain;q=0.9,*/*;q=0.5','X-Engine':'browser','X-Return-Format':'markdown'}});
      if(r.status>=300&&r.status<400){
        const location=r.headers.get('location');
        if(!location)throw new Error('Le lecteur de secours a renvoyé une redirection sans destination.');
        const next=absolute(location,target);
        if(!next)throw new Error('Le lecteur de secours a renvoyé une destination invalide.');
        const nextUrl=await safeUrl(next);
        if(nextUrl.hostname!=='r.jina.ai')throw new Error('Le lecteur de secours a renvoyé vers un domaine non autorisé.');
        target=nextUrl.toString();
        continue;
      }
      if(!r.ok)throw new Error(`Lecteur de secours indisponible (${r.status}).`);
      const text=(await r.text()).slice(0,MAX_READER_TEXT);
      if(!text.trim())throw new Error('Le lecteur de secours n’a retourné aucun contenu.');
      console.warn('import-site reader-fallback',{source:start});
      return {url:new URL(start),readerText:text,reader:true};
    }
    throw new Error('Le lecteur de secours a effectué trop de redirections.');
  }catch(e){
    if(e?.name==='AbortError')throw new Error('Le site a mis trop de temps à répondre, même via le lecteur de secours.');
    throw e;
  }finally{clearTimeout(timer)}
}
async function fetchHtml(start){
  let u=await safeUrl(start);
  const seen=new Set(),jar=new Map();
  let referer='';
  for(let redirects=0;;redirects++){
    const key=loopKey(u);
    if(seen.has(key)){
      console.warn('import-site redirect-loop',{url:u.toString(),redirects,chain:[...seen]});
      return fetchReader(start);
    }
    seen.add(key);
    if(redirects>MAX_REDIRECTS)return fetchReader(start);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT_MS);
    let r;
    try{
      const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 WhatsAfricaBot/2.3','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8','Accept-Language':'fr-FR,fr;q=0.9,en;q=0.8','Cache-Control':'no-cache','Pragma':'no-cache'};
      if(referer)headers.Referer=referer;
      const cookies=cookieHeader(jar);if(cookies)headers.Cookie=cookies;
      r=await fetch(u,{redirect:'manual',signal:controller.signal,headers});
      storeCookies(r.headers,jar);
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Le site a mis trop de temps à répondre.');
      if(/redirect/i.test(e?.message||''))return fetchReader(start);
      throw e;
    }finally{clearTimeout(timer)}
    if(r.status>=300&&r.status<400){
      const location=r.headers.get('location');
      if(!location)return fetchReader(start);
      const next=absolute(location,u.toString());
      if(!next)return fetchReader(start);
      referer=u.toString();
      u=await safeUrl(next);
      continue;
    }
    if(!r.ok){
      if(r.status===403||r.status===429||r.status===451)return fetchReader(start);
      throw new Error(`Le site a répondu avec le statut ${r.status}.`);
    }
    const contentType=r.headers.get('content-type')||'';
    if(!/text\/html|application\/xhtml\+xml/i.test(contentType))return fetchReader(start);
    return {url:u,html:(await r.text()).slice(0,MAX_HTML),reader:false};
  }
}
module.exports=async function(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée.'});
  if(!(await limited(req)))return res.status(429).json({error:'Trop de demandes. Réessayez dans une minute.'});
  try{
    const raw=clean(req.body?.url,1000);
    if(!raw)return res.status(400).json({error:'Le lien du site ou du produit est requis.'});
    const result=await fetchHtml(raw);
    let products=result.reader?readerProducts(result.readerText,result.url.toString()):jsonLd(result.html,result.url.toString());
    if(!result.reader&&!products.length)products=meta(result.html,result.url.toString());
    const seen=new Set();
    products=products.filter(p=>p.title&&!seen.has(norm(p.title))&&seen.add(norm(p.title))).slice(0,30);
    return res.status(200).json({source_url:result.url.toString(),products,count:products.length,method:result.reader?'browser-reader':'direct',message:products.length?'Analyse terminée. Vérifiez puis validez les produits proposés.':'Page récupérée, mais aucun produit structuré n’a été détecté.'});
  }catch(e){
    console.error('import-site',e);
    const status=/Adresse|lien doit|redirections|Boucle|page HTML|site a répondu|temps à répondre|lecteur de secours/i.test(e.message||'')?400:502;
    return res.status(status).json({error:e.message||'Import impossible.'});
  }
};