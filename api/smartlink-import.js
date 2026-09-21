async function fetchImportedImage(imageUrl,res){
  const u=new URL(imageUrl);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return res.status(400).json({error:'INVALID_IMAGE_URL'});
  if(u.port&&u.port!=='80'&&u.port!=='443')return res.status(400).json({error:'INVALID_IMAGE_PORT'});
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1'||host.startsWith('127.')||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('169.254.')||host.startsWith('172.16.')||host.startsWith('172.17.')||host.startsWith('172.18.')||host.startsWith('172.19.')||host.startsWith('172.2')||host.startsWith('172.30.')||host.startsWith('172.31.')||host.endsWith('.internal'))return res.status(400).json({error:'BLOCKED_HOST'});
  const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),10000);let r;
  try{r=await fetch(imageUrl,{method:'GET',redirect:'manual',signal:ac.signal,headers:{'User-Agent':'WASSAFRICA Smart Link Image Import/1.0','Accept':'image/avif,image/webp,image/png,image/jpeg,image/gif'}})}
  catch(e){return res.status(502).json({error:'IMAGE_FETCH_FAILED',message:e?.message||'Image fetch failed'})}
  finally{clearTimeout(timer)}
  if(r.status>=300&&r.status<400)return res.status(400).json({error:'REDIRECT_NOT_ALLOWED'});
  if(!r.ok)return res.status(502).json({error:'IMAGE_FETCH_FAILED',status:r.status});
  const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!/^image\/(jpeg|png|webp|gif|avif)$/.test(type))return res.status(415).json({error:'NOT_AN_IMAGE'});
  const len=Number(r.headers.get('content-length')||0);
  if(len>5*1024*1024)return res.status(413).json({error:'IMAGE_TOO_LARGE'});
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.length>5*1024*1024)return res.status(413).json({error:'IMAGE_TOO_LARGE'});
  res.setHeader('Content-Type',type);res.setHeader('Cache-Control','private, max-age=300');res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(200).send(buf)
}
async function fetchSourcePage(pageUrl){
  const first=new URL(pageUrl);
  if(!['http:','https:'].includes(first.protocol)||first.username||first.password)throw new Error('INVALID_SOURCE_URL');
  if(first.port&&first.port!=='80'&&first.port!=='443')throw new Error('INVALID_SOURCE_PORT');
  const isBlockedHost=(host)=>host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1'||host.startsWith('127.')||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('169.254.')||/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)||host.endsWith('.internal');
  if(isBlockedHost(first.hostname.toLowerCase()))throw new Error('BLOCKED_SOURCE_HOST');
  let url=pageUrl;
  for(let hop=0;hop<4;hop++){
    const u=new URL(url);if(isBlockedHost(u.hostname.toLowerCase()))throw new Error('BLOCKED_SOURCE_HOST');
    const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),10000);let r;
    try{r=await fetch(url,{redirect:'manual',signal:ac.signal,headers:{'User-Agent':'WASSAFRICA Smart Link Analyzer/1.0','Accept':'text/html,application/xhtml+xml'}})}
    catch(e){throw new Error('SOURCE_FETCH_FAILED:'+((e&&e.message)||'fetch failed'))}finally{clearTimeout(timer)}
    if(r.status>=300&&r.status<400){const loc=r.headers.get('location');if(!loc)throw new Error('SOURCE_REDIRECT_INVALID');url=new URL(loc,url).toString();continue}
    if(!r.ok)throw new Error('SOURCE_FETCH_HTTP_'+r.status);
    const type=(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html')&&!type.includes('application/xhtml+xml'))throw new Error('SOURCE_NOT_HTML');
    const html=await r.text();const clean=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ');
    const title=(clean.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').trim();
    const metas=[...clean.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|og:image|product:price:amount|product:price:currency)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)].map(m=>m[1]).filter(Boolean);
    const images=[...html.matchAll(/<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi)].map(m=>m[1].split(',')[0].trim()).filter(Boolean).map(x=>{try{return new URL(x,url).toString()}catch{return null}}).filter(Boolean).slice(0,10);
    const jsonld=[...html.matchAll(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1].trim()).filter(Boolean).slice(0,5);
    const text=clean.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\\s+/g,' ').trim().slice(0,14000);
    return {url,title,metas,images,jsonld,text};
  }
  throw new Error('SOURCE_TOO_MANY_REDIRECTS')
}
function extractResponseText(j){
  if(typeof j?.output_text==='string'&&j.output_text.trim())return j.output_text.trim();
  const parts=[];
  for(const item of Array.isArray(j?.output)?j.output:[]){
    for(const c of Array.isArray(item?.content)?item.content:[]){
      if(typeof c?.text==='string'&&c.text.trim())parts.push(c.text);
      if(typeof c?.json==='string'&&c.json.trim())parts.push(c.json);
    }
  }
  return parts.join('').trim();
}
export default async function handler(req,res){
  const route=String(req.query?.__route||'');
  if(req.method==='GET'&&route==='turn'){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Access-Control-Allow-Origin','*');
    const urlsRaw=process.env.TURN_URLS||process.env.TURN_URL||'';
    const username=process.env.TURN_USERNAME||'';
    const credential=process.env.TURN_PASSWORD||process.env.TURN_CREDENTIAL||'';
    const urls=urlsRaw.split(',').map(x=>x.trim()).filter(Boolean);
    const iceServers=[];
    if(urls.length&&username&&credential)iceServers.push({urls:urls.length===1?urls[0]:urls,username,credential});
    return res.status(200).json({iceServers,configured:iceServers.length>0});
  }
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const requestId=Math.random().toString(36).slice(2,10);res.setHeader('X-WassAfrica-Request-Id',requestId);res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.body?.image_url){
      const imageUrl=String(req.body.image_url).trim();
      if(!/^https?:\/\//i.test(imageUrl))return res.status(400).json({error:'INVALID_IMAGE_URL'});
      console.info('[SMARTLINK_AI]',requestId,'IMAGE_START');
      return await fetchImportedImage(imageUrl,res)
    }
    const urls=Array.isArray(req.body?.urls)?req.body.urls.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean).slice(0,20):[];
    if(!urls.length)return res.status(400).json({error:'NO_URLS',message:'Collez au moins un lien.'});
    if(urls.some(u=>!/^https?:\/\//i.test(u)))return res.status(400).json({error:'INVALID_URL',message:'Chaque lien doit commencer par http:// ou https://.'});
    console.info('[SMARTLINK_AI]',requestId,'START','url_count='+urls.length);
    const key=process.env.OPENAI_API_KEY;
    if(!key){console.error('[SMARTLINK_AI]',requestId,'CONFIG_MISSING');return res.status(503).json({error:'AI_NOT_CONFIGURED',message:'L’IA Smart Link nécessite OPENAI_API_KEY dans Vercel.'})}
    const sourcePages=[];
    for(const url of urls){
      try{sourcePages.push(await fetchSourcePage(url))}
      catch(e){sourcePages.push({url,error:e?.message||'SOURCE_FETCH_FAILED'})}
    }
    const sourceContext=sourcePages.map((p,i)=>`SOURCE ${i+1} URL: ${p.url}\nTITLE: ${p.title||''}\nMETA: ${(p.metas||[]).join(' | ')}\nIMAGE_URLS: ${(p.images||[]).join(' | ')}\nJSON_LD: ${(p.jsonld||[]).join(' | ')}\nPAGE_TEXT: ${p.text||''}\nFETCH_ERROR: ${p.error||''}`).join('\n\n').slice(0,180000);
    const prompt=`Tu es l'assistant commercial de WASSAFRICA. Les URLs ci-dessous ont été fournies directement par l'utilisateur. Analyse en priorité le contenu extrait de CHAQUE page fournie. Utilise la recherche web seulement comme complément si l'extrait est insuffisant. Pour chaque URL, crée UNE offre exploitable dans un Smart Link. Ne fabrique jamais un prix, une caractéristique, un stock ou une disponibilité absente de la source. Si une donnée manque, mets null ou une chaîne vide. Retourne uniquement un objet JSON avec une clé "offers", tableau de 1 à 20 objets. Champs: title, description, price(number|null), currency(string), stock(number|null), category, product_type(physical|digital|service), source_url, image_urls(array of up to 5 public image URLs). Les image_urls doivent privilégier les images réellement présentes dans IMAGE_URLS ou JSON_LD. URLs originales:\n${urls.join('\n')}\n\nCONTENU DES PAGES:\n${sourceContext}`;
    console.info('[SMARTLINK_AI]',requestId,'OPENAI_REQUEST');
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({
      model:'gpt-5.6-luna',
      tools:[{type:'web_search'}],
      input:prompt,
      text:{format:{type:'json_schema',name:'smartlink_offers',strict:true,schema:{
        type:'object',
        properties:{offers:{type:'array',minItems:0,maxItems:20,items:{type:'object',properties:{
          title:{type:'string'},description:{type:'string'},price:{type:['number','null']},currency:{type:'string'},stock:{type:['number','null']},category:{type:'string'},product_type:{type:'string',enum:['physical','digital','service']},source_url:{type:'string'},image_urls:{type:'array',items:{type:'string'},maxItems:5}
        },required:['title','description','price','currency','stock','category','product_type','source_url','image_urls'],additionalProperties:false}}},
        required:['offers'],additionalProperties:false
      }}}
    })});
    const j=await r.json();
    console.info('[SMARTLINK_AI]',requestId,'OPENAI_RESPONSE','status='+r.status);
    if(!r.ok){console.error('[SMARTLINK_AI]',requestId,'OPENAI_ERROR',j?.error?.code||'unknown');return res.status(502).json({error:'AI_REQUEST_FAILED',detail:j?.error?.message||'Erreur IA lors de l’analyse des liens.'})}
    const out=extractResponseText(j);
    if(!out){console.error('[SMARTLINK_AI]',requestId,'EMPTY_OUTPUT');return res.status(502).json({error:'AI_EMPTY_OUTPUT',message:'L’IA a répondu sans produire de données exploitables.'})}
    let data;try{data=JSON.parse(out)}catch(e){console.error('[SMARTLINK_AI]',requestId,'PARSE_FAILED');return res.status(502).json({error:'AI_INVALID_JSON',message:'La réponse IA n’a pas pu être interprétée.'})}
    const offers=Array.isArray(data?.offers)?data.offers.filter(o=>o&&typeof o==='object').slice(0,20):[];
    if(!offers.length){console.warn('[SMARTLINK_AI]',requestId,'NO_OFFERS');return res.status(200).json({offers:[],message:'L’IA a analysé les liens mais aucune offre exploitable n’a été trouvée.'})}
    console.info('[SMARTLINK_AI]',requestId,'SUCCESS','offers='+offers.length);
    return res.status(200).json({offers})
  }catch(e){
    console.error('[SMARTLINK_AI]',requestId,'FAILED',e?.name||'Error',e?.message||'Erreur import IA');
    return res.status(500).json({error:'IMPORT_FAILED',message:'L’importation IA a rencontré une erreur serveur.',detail:e?.message||'Erreur import IA'})
  }
}