const SUPABASE_URL='https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const SITE='https://wassafrica.vercel.app';
const FALLBACK_IMAGE=SITE+'/icon-512.svg';

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clean(v,max=240){return String(v??'').replace(/\s+/g,' ').trim().slice(0,max);}
function absImage(v){if(!v)return FALLBACK_IMAGE;try{const u=new URL(v,SITE);return ['http:','https:'].includes(u.protocol)?u.href:FALLBACK_IMAGE;}catch{return FALLBACK_IMAGE;}}
async function rows(table,params){
  const u=new URL(SUPABASE_URL+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
  const r=await fetch(u.toString(),{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'},signal:AbortSignal.timeout(4500)});
  if(!r.ok)throw new Error('PUBLIC_DATA_'+table+'_'+r.status);
  const j=await r.json();return Array.isArray(j)?j:[];
}
async function first(table,params){return (await rows(table,params))[0]||null;}
async function build(kind,id,slug){
  let title='WASSAFRICA — Connecter l’Afrique, ouvrir le monde';
  let description='Découvrez des produits, services et offres africaines sur WASSAFRICA.';
  let image=FALLBACK_IMAGE,url=SITE+(slug?'/'+encodeURIComponent(slug):'/');
  let type='website',price=null,currency=null;
  if(kind==='product'){
    const p=await first('products',{id:'eq.'+id,is_published:'eq.true',select:'id,title,description,price,currency,image_url,business_id,product_type'});
    if(p){
      title=clean(p.title,120)+' — WASSAFRICA';description=clean(p.description||('Découvrez '+p.title+' sur WASSAFRICA.'),240);
      image=absImage(p.image_url);url=SITE+'/product/'+encodeURIComponent(p.id);type='product';price=p.price;currency=p.currency||'XOF';
    }
  }else if(kind==='collection'){
    const c=await first('product_collections',{id:'eq.'+id,is_published:'eq.true',select:'id,name,subtitle,description,cover_url,price,currency,business_id'});
    if(c){
      title=clean(c.name,120)+' — Collection WASSAFRICA';description=clean(c.subtitle||c.description||('Découvrez la collection '+c.name+' sur WASSAFRICA.'),240);
      image=absImage(c.cover_url);url=SITE+'/collection/'+encodeURIComponent(c.id);type='product.group';price=c.price;currency=c.currency||'XOF';
    }
  }else{
    const l=await first('smart_links',{slug:'eq.'+slug,is_public:'eq.true',select:'id,business_id,title,description,slug,link_type,source_metadata'});
    if(l){
      const b=await first('businesses',{id:'eq.'+l.business_id,select:'id,name,description,presentation,tagline,city,country,logo_url,cover_image_url,slug,phone'});
      if(b){
        title=clean(b.name||l.title||'WASSAFRICA',120)+' — WASSAFRICA';
        description=clean(b.presentation||b.description||b.tagline||l.description||('Découvrez '+(b.name||'cette activité')+' sur WASSAFRICA.'),240);
        image=absImage(b.cover_image_url||b.logo_url);url=SITE+'/'+encodeURIComponent(slug);
        if(l.link_type==='product'&&l.source_metadata?.product_id){
          const p=await first('products',{id:'eq.'+l.source_metadata.product_id,business_id:'eq.'+b.id,is_published:'eq.true',select:'id,title,description,price,currency,image_url'});
          if(p){title=clean(p.title,120)+' — '+clean(b.name||'WASSAFRICA',80);description=clean(p.description||('Découvrez '+p.title+' sur WASSAFRICA.'),240);image=absImage(p.image_url||b.cover_image_url||b.logo_url);type='product';price=p.price;currency=p.currency||'XOF';}
        }
      }
    }
  }
  return {title,description,image,url,type,price,currency};
}
function html(m){
  const tags=[
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="description" content="'+esc(m.description)+'">',
    '<meta property="og:site_name" content="WASSAFRICA"><meta property="og:locale" content="fr_FR">',
    '<meta property="og:type" content="'+esc(m.type)+'"><meta property="og:title" content="'+esc(m.title)+'">',
    '<meta property="og:description" content="'+esc(m.description)+'"><meta property="og:url" content="'+esc(m.url)+'">',
    '<meta property="og:image" content="'+esc(m.image)+'"><meta property="og:image:secure_url" content="'+esc(m.image)+'">',
    '<meta property="og:image:alt" content="'+esc(m.title)+'"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+esc(m.title)+'"><meta name="twitter:description" content="'+esc(m.description)+'"><meta name="twitter:image" content="'+esc(m.image)+'">',
    m.price!=null?'<meta property="product:price:amount" content="'+esc(m.price)+'"><meta property="product:price:currency" content="'+esc(m.currency||'XOF')+'">':'',
    '<link rel="canonical" href="'+esc(m.url)+'"><title>'+esc(m.title)+'</title>'
  ].join('');
  return '<!doctype html><html lang="fr"><head>'+tags+'</head><body><main><h1>'+esc(m.title)+'</h1><p>'+esc(m.description)+'</p><p><a href="'+esc(m.url)+'">Voir sur WASSAFRICA</a></p><img src="'+esc(m.image)+'" alt="'+esc(m.title)+'" style="max-width:100%;height:auto"></main></body></html>';
}
module.exports=async function handler(req,res){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options','nosniff');
  const kind=String(req.query?.kind||'business');
  const id=String(req.query?.id||'').trim();
  const slug=String(req.query?.slug||'').trim();
  if(!['business','product','collection'].includes(kind)||((kind==='product'||kind==='collection')&&!/^[a-zA-Z0-9-]{1,128}$/.test(id))||(kind==='business'&&!/^[a-zA-Z0-9-]{1,160}$/.test(slug))){
    res.statusCode=400;return res.end(html({title:'WASSAFRICA',description:'Découvrez les offres sur WASSAFRICA.',image:FALLBACK_IMAGE,url:SITE+'/',type:'website'}));
  }
  try{const meta=await build(kind,id,slug);res.statusCode=200;return res.end(html(meta));}
  catch(e){
    // A preview failure must not break link sharing; return safe WASSAFRICA metadata.
    res.statusCode=200;return res.end(html({title:'WASSAFRICA — Connecter l’Afrique, ouvrir le monde',description:'Découvrez des produits, services et offres africaines sur WASSAFRICA.',image:FALLBACK_IMAGE,url:kind==='product'?SITE+'/product/'+encodeURIComponent(id):kind==='collection'?SITE+'/collection/'+encodeURIComponent(id):SITE+'/'+encodeURIComponent(slug),type:'website'}));
  }
};
