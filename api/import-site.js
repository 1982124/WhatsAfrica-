const MAX_HTML = 800000;
const clean = (v, n=500) => String(v || '').replace(/\s+/g,' ').trim().slice(0,n);
const abs = (u, base) => { try { return new URL(u, base).toString(); } catch { return ''; } };
function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(':','\\:')}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const m = html.match(re); return m ? clean(m[1],1000) : '';
}
function textBetween(s){ return clean(s.replace(/<[^>]+>/g,' '),300); }
function parseJsonLd(html, base) {
  const out=[]; const blocks=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const b of blocks){ try { const data=JSON.parse(b[1]); const arr=Array.isArray(data)?data:(data['@graph']||[data]); for(const x of arr){ const t=String(x?.['@type']||'').toLowerCase(); if(!t.includes('product')) continue; const offers=Array.isArray(x.offers)?x.offers[0]:x.offers; const image=Array.isArray(x.image)?x.image[0]:x.image; out.push({title:clean(x.name,160),description:clean(x.description,400),price:clean(offers?.price,40),currency:clean(offers?.priceCurrency,12)||'FCFA',image_url:abs(image,base),source_url:base,kind:'produit'}); } } catch {} }
  return out;
}
module.exports=async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Méthode non autorisée.'});
  try {
    const url=String(req.body?.url||'').trim(); if(!/^https?:\/\//i.test(url)) return res.status(400).json({error:'Entrez une URL complète commençant par https://'});
    const target=new URL(url); if(!['http:','https:'].includes(target.protocol)) throw new Error('URL non valide');
    const r=await fetch(target.toString(),{redirect:'follow',headers:{'User-Agent':'WhatsAfricaCatalogBot/1.0'}}); if(!r.ok) return res.status(502).json({error:`Le site a répondu avec le statut ${r.status}.`});
    const html=(await r.text()).slice(0,MAX_HTML); const finalUrl=r.url||target.toString();
    const products=parseJsonLd(html,finalUrl).slice(0,30);
    const pageTitle=meta(html,'og:title')||meta(html,'twitter:title')||textBetween((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
    const pageDescription=meta(html,'og:description')||meta(html,'description'); const pageImage=abs(meta(html,'og:image')||meta(html,'twitter:image'),finalUrl);
    if(!products.length && pageTitle) products.push({title:pageTitle,description:pageDescription,price:'',currency:'FCFA',image_url:pageImage,source_url:finalUrl,kind:'service'});
    return res.status(200).json({source_url:finalUrl,site:{title:pageTitle,description:pageDescription,image_url:pageImage},products});
  } catch(e){ console.error('import-site',e); return res.status(500).json({error:'Impossible de lire ce site. Vérifiez le lien et réessayez.'}); }
};