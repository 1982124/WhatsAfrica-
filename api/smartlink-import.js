const { safeExternalFetch } = require('./_lib/safe-external-fetch');

async function fetchImportedImage(imageUrl,res){
  let r;
  try{
    r=await safeExternalFetch(imageUrl,{method:'GET',maxBytes:5*1024*1024,timeoutMs:5000,headers:{'User-Agent':'WASSAFRICA Smart Link Image Import/1.0','Accept':'image/avif,image/webp,image/png,image/jpeg,image/gif'}});
  }catch(e){
    const code=String(e?.message||'');
    if(['INVALID_SOURCE_URL','INVALID_SOURCE_PORT','BLOCKED_SOURCE_HOST','BLOCKED_SOURCE_ADDRESS','SOURCE_URL_TOO_LONG'].includes(code))return res.status(400).json({error:code});
    return res.status(502).json({error:code==='SOURCE_TOO_LARGE'?'IMAGE_TOO_LARGE':'IMAGE_FETCH_FAILED',message:'Image fetch failed'});
  }
  if(r.status>=300&&r.status<400)return res.status(400).json({error:'REDIRECT_NOT_ALLOWED'});
  if(!r.ok)return res.status(502).json({error:'IMAGE_FETCH_FAILED',status:r.status});
  const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!/^image\/(jpeg|png|webp|gif|avif)$/.test(type))return res.status(415).json({error:'NOT_AN_IMAGE'});
  const len=Number(r.headers.get('content-length')||0);
  if(len>5*1024*1024)return res.status(413).json({error:'IMAGE_TOO_LARGE'});
  const buf=Buffer.from(await r.arrayBuffer());
  if(!buf.length||buf.length>5*1024*1024)return res.status(413).json({error:'IMAGE_TOO_LARGE'});
  res.setHeader('Content-Type',type);res.setHeader('Cache-Control','private, max-age=300');res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(200).send(buf);
}
async function fetchSourcePage(pageUrl){
  let url=String(pageUrl);
  for(let hop=0;hop<4;hop++){
    let r;
    try{
      r=await safeExternalFetch(url,{method:'GET',maxBytes:4*1024*1024,timeoutMs:10000,headers:{'User-Agent':'WASSAFRICA Smart Link Analyzer/1.0','Accept':'text/html,application/xhtml+xml'}});
    }catch(e){
      throw new Error(String(e?.message||'SOURCE_FETCH_FAILED'));
    }
    if(r.status>=300&&r.status<400){
      const loc=r.headers.get('location');
      if(!loc)throw new Error('SOURCE_REDIRECT_INVALID');
      try{url=new URL(loc,url).toString()}catch{throw new Error('SOURCE_REDIRECT_INVALID')}
      continue;
    }
    if(!r.ok)throw new Error('SOURCE_FETCH_HTTP_'+r.status);
    const type=(r.headers.get('content-type')||'').toLowerCase();
    if(!type.includes('text/html')&&!type.includes('application/xhtml+xml'))throw new Error('SOURCE_NOT_HTML');
    const declaredLength=Number(r.headers.get('content-length')||0);
    if(declaredLength>4*1024*1024)throw new Error('SOURCE_TOO_LARGE');
    const htmlBuffer=Buffer.from(await r.arrayBuffer());
    if(htmlBuffer.length>4*1024*1024)throw new Error('SOURCE_TOO_LARGE');
    const html=htmlBuffer.toString('utf8');
    const clean=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ');
    const title=(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').trim();
    const metas=[...clean.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|og:image|product:price:amount|product:price:currency)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)].map(m=>m[1]).filter(Boolean);
    const images=[...html.matchAll(/<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi)].map(m=>m[1].split(',')[0].trim()).filter(Boolean).map(x=>{try{return new URL(x,url).toString()}catch{return null}}).filter(Boolean).slice(0,10);
    const jsonld=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].trim()).filter(Boolean).slice(0,5);
    const text=clean.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,14000);
    return {url,title,metas,images,jsonld,text};
  }
  throw new Error('SOURCE_TOO_MANY_REDIRECTS');
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
async function paymentAuthUser(auth){
  if(!auth?.startsWith('Bearer '))return null;const token=auth.slice(7).trim();if(!token)return null;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  const r=await fetch((process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co')+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});
  return r.ok?await r.json().catch(()=>null):null;
}
function paymentServerKey(){return process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SECRET||''}
function paymentServerHeaders(key){const h={apikey:key};if(!String(key||'').startsWith('sb_secret_'))h.Authorization='Bearer '+key;return h}
async function paymentRpc(name,body,key,bearer){
  const base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const headers={apikey:key,'Content-Type':'application/json'};
  if(bearer)headers.Authorization='Bearer '+bearer;
  else if(!String(key||'').startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
  const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(body)});
  const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.hint||d?.details||'rpc_failed');return d;
}
async function paymentServicePatch(table,query,patch){
  const key=paymentServerKey(),base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co',u=new URL(base+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(query))u.searchParams.set(k,v);
  const r=await fetch(u,{method:'PATCH',headers:{...paymentServerHeaders(key),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)});
  if(!r.ok)throw new Error('service_patch_'+r.status);return r.json().catch(()=>[]);
}
async function paymentServiceGet(path,params){
  const key=paymentServerKey(),base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co',u=new URL(base+'/rest/v1/'+path);
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:paymentServerHeaders(key)});if(!r.ok)throw new Error('service_get_'+r.status);return r.json();
}
function paymentUrlSafe(value){try{const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&(h==='moneyfusion.net'||h.endsWith('.moneyfusion.net'))}catch{return false}}
async function paymentStart(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const sk=paymentServerKey(),pk=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  if(!sk||!pk)return res.status(503).json({ok:false,error:'supabase_payment_env_missing'});
  const user=await paymentAuthUser(req.headers.authorization);if(!user?.id)return res.status(401).json({ok:false,error:'authentication_required'});
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{},orderId=String(b.order_id||'').trim(),method=String(b.method||'mobile_money').trim(),idem=String(b.idempotency_key||'').trim();
  if(!orderId||idem.length<16)return res.status(400).json({ok:false,error:'invalid_payment_request'});
  const bearer=req.headers.authorization.slice(7).trim();
  const intent=await paymentRpc('create_order_payment_intent',{p_order_id:orderId,p_provider:'moneyfusion',p_method:method,p_idempotency_key:idem},pk,bearer);
  const orders=await paymentServiceGet('orders',{id:'eq.'+orderId,select:'id,business_id,buyer_name,buyer_phone,total,currency,tracking_token'});if(!orders[0])return res.status(404).json({ok:false,error:'order_not_found'});const order=orders[0];
  const sellers=await paymentServiceGet('businesses',{id:'eq.'+order.business_id,select:'owner_id'});const sellerId=sellers[0]?.owner_id;
  if(!sellerId)return res.status(409).json({ok:false,error:'seller_account_missing',message:'Le compte vendeur n’est pas correctement configuré.'});
  const creds=await paymentRpc('get_payment_connection_secret_for_service',{p_user_id:sellerId},sk);const connection=Array.isArray(creds)?creds[0]:creds;
  const apiUrl=String(connection?.secret||'').trim(),apiKey=String(process.env.MONEYFUSION_API_KEY||'').trim();
  if(!apiUrl)return res.status(503).json({ok:false,error:'moneyfusion_not_configured',message:'Le vendeur doit connecter Money Fusion depuis son cockpit.'});
  if(!/^https:\/\//i.test(apiUrl)||!paymentUrlSafe(apiUrl))return res.status(400).json({ok:false,error:'moneyfusion_api_url_invalid'});
  const items=await paymentServiceGet('order_items',{order_id:'eq.'+orderId,select:'title_snapshot,unit_price,quantity'});
  const base=process.env.PUBLIC_APP_URL||'https://wassafrica.vercel.app';
  const payload={totalPrice:Number(order.total),article:items.map(i=>({name:String(i.title_snapshot||'Article').slice(0,120),price:Number(i.unit_price||0),quantity:Number(i.quantity||1)})),numeroSend:String(order.buyer_phone||''),nomclient:String(order.buyer_name||'Client'),personal_Info:[{userId:user.id,orderId:order.id}],return_url:base+'/commande/'+encodeURIComponent(b.tracking_token||order.tracking_token||'')+'?order_id='+encodeURIComponent(order.id),webhook_url:base+'/api/payment-moneyfusion-webhook'};
  const headers={'Content-Type':'application/json'};if(apiKey)headers['moneyfusion-private-key']=apiKey;
  const pr=await fetch(apiUrl,{method:'POST',headers,body:JSON.stringify(payload)}),pd=await pr.json().catch(()=>null);
  if(!pr.ok||pd?.statut===false)return res.status(502).json({ok:false,error:'moneyfusion_payment_request_failed',provider_status:pr.status,provider_message:pd?.message||null});
  const token=String(pd?.tokenPay||pd?.token||pd?.data?.tokenPay||'').trim(),paymentUrl=String(pd?.url||pd?.data?.url||'').trim();if(!token)return res.status(502).json({ok:false,error:'moneyfusion_token_missing'});
  await paymentServicePatch('payment_intents',{id:'eq.'+intent.payment_intent_id},{status:'requires_action',provider_reference:token,metadata:{order_id:order.id,provider_response:pd},updated_at:new Date().toISOString()});
  await paymentServicePatch('orders',{id:'eq.'+order.id},{payment_provider:'moneyfusion',payment_transaction_id:token,payment_updated_at:new Date().toISOString()});
  return res.status(200).json({ok:true,payment_intent_id:intent.payment_intent_id,order_id:order.id,status:'requires_action',provider:'moneyfusion',provider_reference:token,payment_url:paymentUrl||null});
}
async function verifyMoneyFusionPayment(token){
  const url='https://pay.moneyfusion.net/paiementNotif/'+encodeURIComponent(token);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(url,{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
    if(!response.ok)throw new Error('moneyfusion_status_http_'+response.status);
    const payload=await response.json(),data=payload?.data||payload?.result||null;
    if(payload?.statut===false||!data||String(data.tokenPay||'').trim()!==token)throw new Error('moneyfusion_status_unverified');
    return data;
  }finally{clearTimeout(timer)}
}
async function paymentWebhook(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const sk=paymentServerKey();
  if(!sk)return res.status(503).json({ok:false,error:'supabase_env_missing'});
  let p;
  try{p=typeof req.body==='string'?JSON.parse(req.body):req.body||{}}
  catch{return res.status(400).json({ok:false,error:'invalid_json'})}
  const event=String(p.event||''),token=String(p.tokenPay||p.token||'').trim();
  const eventStatus={'payin.session.completed':'paid','payin.session.cancelled':'cancelled','payin.session.pending':'pending'}[event];
  if(!token)return res.status(400).json({ok:false,error:'provider_token_missing'});
  if(!eventStatus)return res.status(202).json({ok:true,ignored:true,reason:'unsupported_event'});
  const intents=await paymentServiceGet('payment_intents',{provider:'eq.moneyfusion',provider_reference:'eq.'+token,select:'id,order_id,amount,status,provider_reference'});
  const intent=intents[0];
  if(!intent?.order_id)return res.status(404).json({ok:false,error:'payment_intent_not_found'});
  let verified;
  try{verified=await verifyMoneyFusionPayment(token)}
  catch(e){console.warn('[PAYMENT_WEBHOOK] provider status could not be verified',e?.message||e);return res.status(503).json({ok:false,error:'provider_status_unavailable'})}
  const providerStatus=String(verified.statut||verified.status||'').trim().toLowerCase();
  const allowedStatuses={
    'payin.session.completed':['paid','completed','success','successful'],
    'payin.session.cancelled':['cancelled','canceled','failed','failure','expired','no paid','not paid'],
    'payin.session.pending':['pending','processing','initiated','in progress','in_progress']
  };
  if(!allowedStatuses[event].includes(providerStatus))return res.status(409).json({ok:false,error:'provider_status_mismatch'});
  const personalInfo=Array.isArray(verified.personal_Info)?verified.personal_Info:[];
  const providerOrderId=personalInfo.map(x=>String(x?.orderId||'').trim()).find(Boolean);
  if(providerOrderId&&providerOrderId!==String(intent.order_id))return res.status(409).json({ok:false,error:'provider_order_mismatch'});
  const amount=Number(verified.Montant??verified.montant),fees=Number(verified.frais??0),expectedAmount=Number(intent.amount);
  if(Number.isFinite(amount)&&Number.isFinite(expectedAmount)&&Math.abs(amount+(Number.isFinite(fees)?fees:0)-expectedAmount)>0.01&&Math.abs(amount-expectedAmount)>0.01)return res.status(409).json({ok:false,error:'amount_mismatch'});
  const transaction=String(verified.numeroTransaction||verified._id||token).trim();
  const result=await paymentRpc('apply_payment_webhook_event_for_service',{p_order_id:intent.order_id,p_provider:'moneyfusion',p_provider_event_id:token+':'+event,p_event_type:event,p_transaction_id:transaction,p_status:eventStatus,p_payload_hash:null},sk);
  return res.status(200).json({ok:true,event,status:eventStatus,result});
}
async function marketGet(path,params){
  // Marketplace reads are public. Try the configured server key first, but never let
  // an invalid/expired service key blank the public market when the publishable key works.
  const base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const candidates=[process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_PUBLISHABLE_KEY,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV'].map(x=>String(x||'').trim()).filter(Boolean);
  const keys=[...new Set(candidates)];
  let lastStatus=0;
  for(const key of keys){
    const u=new URL(base+'/rest/v1/'+path);
    Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
    const headers={apikey:key};
    // Supabase publishable/secret keys are opaque API keys, not JWTs.
    // Do not send sb_* keys as Authorization Bearer; Data API authentication uses apikey.
    if(!key.startsWith('sb_'))headers.Authorization='Bearer '+key;
    const r=await fetch(u,{headers,cache:'no-store'});
    if(r.ok)return r.json();
    lastStatus=r.status;
    if(r.status!==401&&r.status!==403)throw new Error('market_get_'+r.status);
  }
  throw new Error('market_get_'+(lastStatus||401));
}
async function marketData(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  res.setHeader('Cache-Control','private, no-store, max-age=0, must-revalidate');
  res.setHeader('X-WASSAFRICA-Market-Version','market-v4-server-key-failsoft');
  // Marketplace delivery must be fail-soft: one optional category or enrichment query
  // must never blank the entire public market.
  const read=async(path,params)=>{try{return {data:await marketGet(path,params),error:null}}catch(e){console.warn('[MARKET_SOURCE]',path,e?.message||e);return {data:[],error:e}}};
  try{
    const searchRaw=String(req.query?.q||'').trim().slice(0,120);
    // Search is executed server-side so the browser is not limited to the first 1,000
    // published products. Sanitize the PostgREST OR expression before use.
    const searchTerm=searchRaw.replace(/[\\,()]/g,' ').replace(/\*/g,' ').replace(/\s+/g,' ').trim();
    const productParams={select:'id,title,description,price,currency,image_url,category,product_type,business_id,is_published,created_at,digital_file_name,digital_byte_size,digital_version',is_published:'eq.true',order:'created_at.desc',limit:'1000'};
    if(searchTerm){
      const pattern='*'+searchTerm+'*';
      productParams.or=['title.ilike.'+pattern,'description.ilike.'+pattern,'category.ilike.'+pattern,'product_type.ilike.'+pattern].join(',');
    }
    const [sl,pr,ms,pc]=await Promise.all([
      read('smart_links',{select:'business_id,slug,title,description',is_public:'eq.true',order:'created_at.desc',limit:'1000'}),
      read('products',productParams),
      read('marketplace_services',{select:'id,title,description,category,price,currency,seller_id,status,metadata,created_at',status:'eq.published',order:'created_at.desc',limit:'1000'}),
      read('product_collections',{select:'id,name,subtitle,description,category,cover_url,is_published,price,currency,created_at',is_published:'eq.true',order:'created_at.desc',limit:'1000'})
    ]);
    const smart_links=sl.data;
    // Hide only exact duplicate digital listings in the public catalog. Keep every database row intact.
    // The API query is newest-first; the newest matching listing remains the one users see.
    const seenDigitalListings=new Set();
    const products=(pr.data||[]).filter(product=>{
      if(String(product.product_type||'').trim().toLowerCase()!=='digital')return true;
      const filename=String(product.digital_file_name||'').trim().toLowerCase();
      const bytes=Number(product.digital_byte_size||0);
      if(!filename||!bytes)return true;
      const signature=[
        String(product.business_id||''),
        String(product.title||'').trim().toLowerCase().replace(/\s+/g,' '),
        String(Number(product.price||0)),
        String(product.currency||'').trim().toUpperCase(),
        filename,
        String(bytes),
        String(product.digital_version||'').trim()
      ].join('|');
      if(seenDigitalListings.has(signature))return false;
      seenDigitalListings.add(signature);
      return true;
    }).map(({digital_file_name,digital_byte_size,digital_version,...product})=>product);
    const marketplace_services=ms.data,product_collections=pc.data;
    const businessIds=[...new Set([...products.map(x=>x.business_id),...smart_links.map(x=>x.business_id)].filter(Boolean))];
    const ownerIds=[...new Set(marketplace_services.map(x=>x.seller_id).filter(Boolean))];
    const b1=businessIds.length?await read('businesses',{select:'id,owner_id,name,description,city,country,logo_url,cover_image_url,business_type,slug',id:'in.('+businessIds.join(',')+')'}):{data:[]};
    const b2=ownerIds.length?await read('businesses',{select:'id,owner_id,name,description,city,country,logo_url,cover_image_url,business_type,slug',owner_id:'in.('+ownerIds.join(',')+')'}):{data:[]};
    const businesses=b1.data,ownerBusinesses=b2.data;
    const sourceErrors=[sl,pr,ms,pc,b1,b2].filter(x=>x.error).map(x=>x.error?.message||'source_error');
    return res.status(200).json({ok:true,partial:sourceErrors.length>0,sourceErrors,smart_links,products,marketplace_services,product_collections,businesses,ownerBusinesses});
  }catch(e){
    console.error('[MARKET]',e?.message||e);
    // Even an unexpected enrichment failure should not turn the market into a blank page.
    return res.status(200).json({ok:true,partial:true,sourceErrors:[e?.message||'MARKET_PARTIAL_FAILURE'],smart_links:[],products:[],marketplace_services:[],product_collections:[],businesses:[],ownerBusinesses:[]});
  }
}

async function discoverGet(path,params){
  const base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  if(!key)throw new Error('DISCOVER_SUPABASE_KEY_MISSING');
  const u=new URL(base+'/rest/v1/'+path);
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:{apikey:key},cache:'no-store'});
  if(!r.ok)throw new Error('discover_get_'+r.status);
  return r.json();
}
async function discoverRpc(args){
  const base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  if(!key)throw new Error('DISCOVER_SUPABASE_KEY_MISSING');
  const r=await fetch(base+'/rest/v1/rpc/discover_public_businesses',{
    method:'POST',
    headers:{apikey:key,...(!key.startsWith('sb_')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},
    body:JSON.stringify(args)
  });
  const body=await r.text();
  if(!r.ok)throw new Error('discover_rpc_'+r.status+':'+body.slice(0,220));
  return JSON.parse(body);
}
async function discoverData(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  res.setHeader('Cache-Control','private, no-store, max-age=0, must-revalidate');
  res.setHeader('X-WASSAFRICA-Discover-Version','discover-v3-rpc');
  const clean=s=>String(s??'').trim().slice(0,120);
  const q=clean(req.query?.q),country=clean(req.query?.country),city=clean(req.query?.city);
  const kind=String(req.query?.kind||'').trim().toLowerCase();
  const limit=Math.min(60,Math.max(1,Number(req.query?.limit||24))||24);
  const offset=Math.max(0,Number(req.query?.offset||0)||0);
  try{
    const data=await discoverRpc({p_q:q,p_country:country,p_city:city,p_kind:kind,p_limit:limit,p_offset:offset});
    const results=Array.isArray(data?.results)?data.results:[];
    const count=Number(data?.count||0);
    return res.status(200).json({ok:true,partial:false,results,count,offset:Number(data?.offset??offset),limit:Number(data?.limit??limit),has_more:offset+results.length<count});
  }catch(e){
    console.error('[DISCOVER]',e?.message||e);
    return res.status(503).json({ok:false,partial:true,results:[],count:0,offset,limit,has_more:false,error:'DISCOVER_UNAVAILABLE'});
  }
}


const SHARE_PREVIEW_SITE='https://wassafrica.vercel.app';
const SHARE_PREVIEW_FALLBACK=SHARE_PREVIEW_SITE+'/icon-512.svg';
function shareEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function shareClean(v,max=240){return String(v??'').replace(/\\s+/g,' ').trim().slice(0,max);}
function sharePriceLabel(price,currency){
  if(price===null||price===undefined||price===''||!Number.isFinite(Number(price))||Number(price)<0)return '';
  const value=Number(price)===0?'Gratuit':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(price))+' '+String(currency||'XOF').trim().toUpperCase();
  return 'Prix : '+value+'.';
}
function shareProductTeaser(description,title,price,currency){
  const priceLabel=sharePriceLabel(price,currency);
  const fallback='Découvrez '+String(title||'cette offre')+' sur WASSAFRICA.';
  const raw=shareClean(description||fallback,2000);
  if(!priceLabel)return shareClean(raw,240);
  const budget=Math.max(40,240-priceLabel.length-3);
  let base=raw;
  if(base.length>budget){
    let excerpt=base.slice(0,budget-1);
    const lastSpace=excerpt.lastIndexOf(' ');
    if(lastSpace>Math.min(35,budget*0.55))excerpt=excerpt.slice(0,lastSpace);
    base=excerpt.trimEnd()+'…';
  }
  return shareClean(base?base+' · '+priceLabel:priceLabel,240);
}
function shareImage(v){if(!v)return SHARE_PREVIEW_FALLBACK;try{const u=new URL(v,SHARE_PREVIEW_SITE);return ['http:','https:'].includes(u.protocol)?u.href:SHARE_PREVIEW_FALLBACK}catch{return SHARE_PREVIEW_FALLBACK}}
async function shareFirst(table,params){const rows=await marketGet(table,params);return Array.isArray(rows)?rows[0]||null:null;}
async function sharePreviewData(kind,id,slug){
  let m={title:'WASSAFRICA — Connecter l’Afrique, ouvrir le monde',description:'Découvrez des produits, services et offres africaines sur WASSAFRICA.',image:SHARE_PREVIEW_FALLBACK,url:SHARE_PREVIEW_SITE+(slug?'/'+encodeURIComponent(slug):'/'),type:'website',price:null,currency:'XOF'};
  if(kind==='product'){
    const p=await shareFirst('products',{id:'eq.'+id,is_published:'eq.true',select:'id,title,description,price,currency,image_url,business_id,product_type,content_kind'});
    if(p){
      // Match the product page's own cover selection: explicit cover first, then the
      // first gallery/image asset, and only then the legacy products.image_url field.
      let mediaCover=null;
      try{
        const media=await marketGet('product_media',{product_id:'eq.'+p.id,select:'media_type,storage_bucket,storage_path,sort_order',order:'sort_order.asc'});
        const items=Array.isArray(media)?media:[];
        mediaCover=items.find(x=>x.media_type==='cover')||items.find(x=>['gallery','image'].includes(x.media_type))||null;
      }catch(e){console.warn('[SHARE_PREVIEW_MEDIA]',p.id,e?.message||e)}
      let mediaUrl='';
      if(mediaCover?.storage_bucket&&mediaCover?.storage_path){
        const bucket=String(mediaCover.storage_bucket).trim();
        const path=String(mediaCover.storage_path).split('/').filter(Boolean).map(part=>encodeURIComponent(part)).join('/');
        if(/^[a-zA-Z0-9._-]{1,100}$/.test(bucket)&&path&&!path.split('/').some(part=>part==='.'||part==='..')){
          mediaUrl=(process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co').replace(/\/+$/,'')+'/storage/v1/object/public/'+encodeURIComponent(bucket)+'/'+path;
        }
      }
      // Give social crawlers the public cover URL directly. This avoids a second
      // request through our API image proxy and lets WhatsApp fetch the original asset.
      const image=mediaUrl||shareImage(p.image_url)||SHARE_PREVIEW_FALLBACK;
      const title=shareClean(p.title,120)||'Offre WASSAFRICA';
      m={title:title+' — WASSAFRICA',description:shareProductTeaser(p.description,p.title,p.price,p.currency),image,url:SHARE_PREVIEW_SITE+'/product/'+encodeURIComponent(p.id),type:'product',price:p.price,currency:p.currency||'XOF'};
    }
  }else if(kind==='collection'){
    const c=await shareFirst('product_collections',{id:'eq.'+id,is_published:'eq.true',select:'id,name,subtitle,description,cover_url,price,currency,business_id'});
    if(c)m={title:shareClean(c.name,120)+' — Collection WASSAFRICA',description:shareProductTeaser(c.subtitle||c.description,c.name,c.price,c.currency),image:shareImage(c.cover_url),url:SHARE_PREVIEW_SITE+'/collection/'+encodeURIComponent(c.id),type:'product.group',price:c.price,currency:c.currency||'XOF'};
  }else{
    let l=await shareFirst('smart_links',{slug:'eq.'+slug,is_public:'eq.true',select:'id,business_id,title,description,slug,link_type,source_metadata'});
    // Legacy shared URLs sometimes use businesses.slug rather than smart_links.slug.
    // Resolve through that business, but preserve the public-only boundary.
    if(!l){
      const legacyBusiness=await shareFirst('businesses',{slug:'eq.'+slug,select:'id,slug'});
      if(legacyBusiness?.id){
        l=await shareFirst('smart_links',{business_id:'eq.'+legacyBusiness.id,is_public:'eq.true',select:'id,business_id,title,description,slug,link_type,source_metadata',order:'created_at.desc'});
      }
    }
    if(l){
      const b=await shareFirst('businesses',{id:'eq.'+l.business_id,select:'id,name,description,presentation,tagline,city,country,logo_url,cover_image_url,slug,phone'});
      if(b){
        m={...m,title:shareClean(b.name||l.title||'WASSAFRICA',120)+' — WASSAFRICA',description:shareClean(b.description||b.tagline||b.presentation||l.description||('Découvrez '+(b.name||'cette activité')+' sur WASSAFRICA.'),240),image:shareImage(b.cover_image_url||b.logo_url),url:SHARE_PREVIEW_SITE+'/'+encodeURIComponent(slug)};
        if(l.link_type==='product'&&l.source_metadata?.product_id){
          const p=await shareFirst('products',{id:'eq.'+l.source_metadata.product_id,business_id:'eq.'+b.id,is_published:'eq.true',select:'id,title,description,price,currency,image_url'});
          if(p)m={...m,title:shareClean(p.title,120)+' — '+shareClean(b.name||'WASSAFRICA',80),description:shareProductTeaser(p.description,p.title,p.price,p.currency),image:shareImage(p.image_url||b.cover_image_url||b.logo_url),type:'product',price:p.price,currency:p.currency||'XOF'};
        }
      }
    }
  }
  return m;
}
async function sharePreviewImage(req,res){
  if(req.method!=='GET')return res.status(405).send('Method Not Allowed');
  const id=String(req.query?.id||'').trim();
  if(!/^[a-zA-Z0-9-]{1,128}$/.test(id))return res.status(400).send('Invalid image request');
  try{
    const p=await shareFirst('products',{id:'eq.'+id,is_published:'eq.true',select:'id,image_url'});
    if(!p)return res.status(404).send('Image not found');
    let mediaCover=null;
    try{
      const media=await marketGet('product_media',{product_id:'eq.'+id,select:'media_type,storage_bucket,storage_path,sort_order',order:'sort_order.asc'});
      const items=Array.isArray(media)?media:[];
      mediaCover=items.find(x=>x.media_type==='cover')||items.find(x=>['gallery','image'].includes(x.media_type))||null;
    }catch(e){console.warn('[SHARE_IMAGE_MEDIA]',id,e?.message||e)}
    let imageUrl=String(p.image_url||'').trim();
    if(mediaCover?.storage_bucket&&mediaCover?.storage_path){
      const bucket=String(mediaCover.storage_bucket).trim();
      const path=String(mediaCover.storage_path).split('/').filter(Boolean).map(part=>encodeURIComponent(part)).join('/');
      if(/^[a-zA-Z0-9._-]{1,100}$/.test(bucket)&&path&&!path.split('/').some(part=>part==='.'||part==='..')){
        imageUrl=new URL(process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co').origin+'/storage/v1/object/public/'+encodeURIComponent(bucket)+'/'+path;
      }
    }
    const base=new URL(process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co');
    const image=new URL(imageUrl);
    if(image.origin!==base.origin||!image.pathname.startsWith('/storage/v1/object/public/'))return res.status(404).send('Image not found');
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),7000);let upstream;
    try{upstream=await fetch(image.href,{redirect:'manual',signal:ac.signal,headers:{'Accept':'image/jpeg,image/png,image/webp,image/gif,image/avif'}})}
    finally{clearTimeout(timer)}
    if(upstream.status>=300&&upstream.status<400)return res.status(404).send('Image not found');
    if(!upstream.ok)return res.status(502).send('Image unavailable');
    const type=(upstream.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type))return res.status(415).send('Unsupported image type');
    const declared=Number(upstream.headers.get('content-length')||0);
    if(declared>5*1024*1024)return res.status(413).send('Image too large');
    const bytes=Buffer.from(await upstream.arrayBuffer());
    if(!bytes.length||bytes.length>5*1024*1024)return res.status(413).send('Image too large');
    res.setHeader('Content-Type',type);res.setHeader('Content-Length',String(bytes.length));
    res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).send(bytes);
  }catch(e){console.warn('[SHARE_IMAGE]',id,e?.message||e);return res.status(502).send('Image unavailable')}
}
function sharePreviewHtml(m){
  const tags=['<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">','<meta name="description" content="'+shareEsc(m.description)+'">','<meta property="og:site_name" content="WASSAFRICA"><meta property="og:locale" content="fr_FR">','<meta property="og:type" content="'+shareEsc(m.type)+'"><meta property="og:title" content="'+shareEsc(m.title)+'">','<meta property="og:description" content="'+shareEsc(m.description)+'"><meta property="og:url" content="'+shareEsc(m.url)+'">','<meta property="og:image" content="'+shareEsc(m.image)+'"><meta property="og:image:secure_url" content="'+shareEsc(m.image)+'"><meta property="og:image:alt" content="'+shareEsc(m.title)+'">','<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+shareEsc(m.title)+'"><meta name="twitter:description" content="'+shareEsc(m.description)+'"><meta name="twitter:image" content="'+shareEsc(m.image)+'">',m.price!=null?'<meta property="product:price:amount" content="'+shareEsc(m.price)+'"><meta property="product:price:currency" content="'+shareEsc(m.currency||'XOF')+'">':'','<link rel="canonical" href="'+shareEsc(m.url)+'"><title>'+shareEsc(m.title)+'</title>'].join('');
  return '<!doctype html><html lang="fr"><head>'+tags+'</head><body><main><h1>'+shareEsc(m.title)+'</h1><p>'+shareEsc(m.description)+'</p><p><a href="'+shareEsc(m.url)+'">Voir sur WASSAFRICA</a></p><img src="'+shareEsc(m.image)+'" alt="'+shareEsc(m.title)+'" style="max-width:100%;height:auto"></main></body></html>';
}
async function sharePreview(req,res){
  if(req.method!=='GET')return res.status(405).send('Method Not Allowed');
  const kind=String(req.query?.kind||'business'),id=String(req.query?.id||'').trim(),slug=String(req.query?.slug||'').trim();
  const fallback={title:'WASSAFRICA — Connecter l’Afrique, ouvrir le monde',description:'Découvrez des produits, services et offres africaines sur WASSAFRICA.',image:SHARE_PREVIEW_FALLBACK,url:SHARE_PREVIEW_SITE+'/',type:'website'};
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=86400');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['business','product','collection'].includes(kind)||((kind==='product'||kind==='collection')&&!/^[a-zA-Z0-9-]{1,128}$/.test(id))||(kind==='business'&&!/^[a-zA-Z0-9-]{1,160}$/.test(slug)))return res.status(200).send(sharePreviewHtml(fallback));
  try{return res.status(200).send(sharePreviewHtml(await sharePreviewData(kind,id,slug)))}catch(e){console.warn('[SHARE_PREVIEW]',kind,e?.message||e);return res.status(200).send(sharePreviewHtml({...fallback,url:kind==='product'?SHARE_PREVIEW_SITE+'/product/'+encodeURIComponent(id):kind==='collection'?SHARE_PREVIEW_SITE+'/collection/'+encodeURIComponent(id):SHARE_PREVIEW_SITE+'/'+encodeURIComponent(slug)}))}
}


const WA_CURRENCY_BY_COUNTRY = {
  ML:'XOF',SN:'XOF',CI:'XOF',BF:'XOF',BJ:'XOF',TG:'XOF',NE:'XOF',GW:'XOF',
  CM:'XAF',GA:'XAF',CG:'XAF',TD:'XAF',CF:'XAF',GQ:'XAF',
  GH:'GHS',NG:'NGN',KE:'KES',UG:'UGX',TZ:'TZS',ZA:'ZAR',RW:'RWF',
  ET:'ETB',EG:'EGP',MA:'MAD',DZ:'DZD',TN:'TND',ZM:'ZMW',MW:'MWK',
  BW:'BWP',NA:'NAD',LS:'LSL',SZ:'SZL',MZ:'MZN',AO:'AOA',LR:'LRD',
  SL:'SLE',GM:'GMD',CV:'CVE',MR:'MRU',MU:'MUR',CD:'CDF',BI:'BIF',
  SO:'SOS',SD:'SDG',US:'USD',CA:'CAD',GB:'GBP',IE:'EUR',FR:'EUR',
  DE:'EUR',ES:'EUR',IT:'EUR',PT:'EUR',NL:'EUR',BE:'EUR',AT:'EUR',
  FI:'EUR',GR:'EUR',LU:'EUR',CY:'EUR',MT:'EUR',SK:'EUR',SI:'EUR',
  EE:'EUR',LV:'EUR',LT:'EUR',HR:'EUR',JP:'JPY',CN:'CNY',IN:'INR',
  AU:'AUD',NZ:'NZD',CH:'CHF',AE:'AED',SA:'SAR',QA:'QAR',KW:'KWD',
  TR:'TRY',BR:'BRL',MX:'MXN',SG:'SGD',HK:'HKD',KR:'KRW',PK:'PKR',
  ID:'IDR',MY:'MYR',TH:'THB',PH:'PHP',AR:'ARS',CL:'CLP',CO:'COP'
};
async function currencyData(req,res){
  const action=String(req.query?.action||'detect').toLowerCase();
  if(action==='detect'){
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    res.setHeader('Vary','Accept-Language, x-vercel-ip-country');
    const country=String(req.headers['x-vercel-ip-country']||'').toUpperCase();
    const lang=String(req.headers['accept-language']||'');
    const localeCountry=(lang.match(/(?:^|[,;\\s])[^,;\\s-]+-([A-Za-z]{2})(?:[,;\\s]|$)/)||[])[1];
    const resolvedCountry=/^[A-Z]{2}$/.test(country)?country:String(localeCountry||'ML').toUpperCase();
    return res.status(200).json({ok:true,country:resolvedCountry,currency:WA_CURRENCY_BY_COUNTRY[resolvedCountry]||'XOF',source:country?'edge-country':(localeCountry?'browser-locale':'default')});
  }
  if(action==='rates'){
    res.setHeader('Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
    try{
      const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),5000);let upstream;
      try{upstream=await fetch('https://open.er-api.com/v6/latest/USD',{headers:{Accept:'application/json'},signal:ac.signal})}finally{clearTimeout(timer)}
      if(!upstream.ok)throw new Error('fx_upstream_'+upstream.status);
      const data=await upstream.json();
      if(data.result!=='success'||!data.rates||!Number.isFinite(Number(data.rates.USD)))throw new Error('fx_rates_unavailable');
      res.setHeader('X-WASSAFRICA-FX-Updated',String(data.time_last_update_utc||'unknown'));
      return res.status(200).json({ok:true,base:'USD',rates:data.rates,updated_at:data.time_last_update_utc||null,provider:'ExchangeRate-API Open Access'});
    }catch(error){return res.status(503).json({ok:false,error:'currency_rates_unavailable'})}
  }
  return res.status(400).json({ok:false,error:'unsupported_currency_action'});
}

async function handler(req,res){
  const route=String(req.query?.__route||'');
  if(route==='share-preview')return sharePreview(req,res);
  if(route==='share-image')return sharePreviewImage(req,res);
  if(route==='currency')return currencyData(req,res);
  if(route==='market')return marketData(req,res);
  if(route==='discover')return discoverData(req,res);
  if(route==='payment')return paymentStart(req,res);
  if(route==='payment-webhook')return paymentWebhook(req,res);
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
    const openAiKey=process.env.OPENAI_API_KEY||'';
    const openRouterKey=process.env.OPENROUTER_API_KEY||'';
    if(!openAiKey&&!openRouterKey){console.error('[SMARTLINK_AI]',requestId,'CONFIG_MISSING');return res.status(503).json({error:'AI_NOT_CONFIGURED',message:'Aucun moteur IA Smart Link n’est configuré sur Vercel.'})}
    const sourcePages=[];
    const concurrency=Math.min(6,urls.length);
    let cursor=0;
    async function fetchWorker(){
      while(true){
        const index=cursor++;
        if(index>=urls.length)return;
        const url=urls[index];
        try{sourcePages[index]=await fetchSourcePage(url)}
        catch(e){sourcePages[index]={url,error:e?.message||'SOURCE_FETCH_FAILED'}}
      }
    }
    await Promise.all(Array.from({length:concurrency},()=>fetchWorker()));
    const sourceContext=sourcePages.map((p,i)=>`SOURCE ${i+1} URL: ${p.url}\nTITLE: ${p.title||''}\nMETA: ${(p.metas||[]).join(' | ')}\nIMAGE_URLS: ${(p.images||[]).join(' | ')}\nJSON_LD: ${(p.jsonld||[]).join(' | ')}\nPAGE_TEXT: ${p.text||''}\nFETCH_ERROR: ${p.error||''}`).join('\n\n').slice(0,180000);
    const prompt=`Tu es l'assistant commercial de WASSAFRICA. Les URLs ci-dessous ont été fournies directement par l'utilisateur. Analyse UNIQUEMENT les informations effectivement présentes dans le contenu extrait de chaque page. Ne devine, n’estime et n’invente jamais un prix, une caractéristique, un stock, une disponibilité, une devise, une catégorie ou une image. Si une donnée manque, mets null ou une chaîne vide. Si une source contient FETCH_ERROR, ne crée aucune offre à partir de cette source. source_url doit être exactement l'une des URLs originales fournies. image_urls doit contenir uniquement des URLs présentes dans IMAGE_URLS ou explicitement présentes dans JSON_LD de la même source. Retourne uniquement un objet JSON avec une clé "offers", tableau de 0 à 20 objets. Champs: title, description, price(number|null), currency(string), stock(number|null), category, product_type(physical|digital|service), source_url, image_urls(array de 0 à 5 URLs publiques). URLs originales:\n${urls.join('\n')}\n\nCONTENU DES PAGES:\n${sourceContext}`;
    let j;
    if(openAiKey){
      console.info('[SMARTLINK_AI]',requestId,'OPENAI_REQUEST');
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+openAiKey,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.WASSAFRICA_SMARTLINK_MODEL||'gpt-5.6-sol',tools:[{type:'web_search'}],input:prompt,text:{format:{type:'json_schema',name:'smartlink_offers',strict:true,schema:{type:'object',properties:{offers:{type:'array',maxItems:20,items:{type:'object',properties:{title:{type:'string'},description:{type:'string'},price:{type:['number','null']},currency:{type:'string'},stock:{type:['number','null']},category:{type:'string'},product_type:{type:'string',enum:['physical','digital','service']},source_url:{type:'string'},image_urls:{type:'array',items:{type:'string'},maxItems:5}},required:['title','description','price','currency','stock','category','product_type','source_url','image_urls'],additionalProperties:false}}},required:['offers'],additionalProperties:false}}}})});
      j=await r.json();
      console.info('[SMARTLINK_AI]',requestId,'OPENAI_RESPONSE','status='+r.status);
      if(!r.ok){console.error('[SMARTLINK_AI]',requestId,'OPENAI_ERROR',j?.error?.code||'unknown');return res.status(502).json({error:'AI_REQUEST_FAILED',detail:j?.error?.message||'Erreur IA lors de l’analyse des liens.'})}
    }else{
      const models=(process.env.OPENROUTER_MODELS||'qwen/qwen3.6-flash,qwen/qwen3.5-9b').split(',').map(x=>x.trim()).filter(Boolean).slice(0,4);
      console.info('[SMARTLINK_AI]',requestId,'OPENROUTER_REQUEST','model='+models[0]);
      const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),30000);let r;let raw='';try{r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+openRouterKey,'Content-Type':'application/json','HTTP-Referer':'https://wassafrica.vercel.app','X-Title':'WassAfrica Smart Link'},body:JSON.stringify({model:models[0],models,messages:[{role:'system',content:'Tu es un assistant commercial fiable. Réponds uniquement en JSON valide. Ne fabrique aucune donnée absente des sources.'},{role:'user',content:prompt}],temperature:0.1,max_tokens:4000,response_format:{type:'json_object'}}),signal:ac.signal});raw=await r.text()}catch(e){console.error('[SMARTLINK_AI]',requestId,'OPENROUTER_FETCH_FAILED',e?.name||'Error',e?.message||'');return res.status(502).json({error:'AI_REQUEST_FAILED',message:e?.name==='AbortError'?'Le moteur IA a dépassé le délai autorisé.':'Le moteur IA est momentanément inaccessible.'})}finally{clearTimeout(timer)}try{j=raw?JSON.parse(raw):null}catch(e){console.error('[SMARTLINK_AI]',requestId,'OPENROUTER_NON_JSON','status='+r?.status);return res.status(502).json({error:'AI_REQUEST_FAILED',message:'Le moteur IA a renvoyé une réponse invalide.'})}
      console.info('[SMARTLINK_AI]',requestId,'OPENROUTER_RESPONSE','status='+r.status);
      if(!r.ok){console.error('[SMARTLINK_AI]',requestId,'OPENROUTER_ERROR',j?.error?.code||'unknown');return res.status(502).json({error:'AI_REQUEST_FAILED',detail:j?.error?.message||'Erreur IA lors de l’analyse des liens.'})}
    }
    let out=extractResponseText(j);
    if(!out&&j?.choices?.[0]?.message?.content)out=j.choices[0].message.content;
    if(!out){console.error('[SMARTLINK_AI]',requestId,'EMPTY_OUTPUT');return res.status(502).json({error:'AI_EMPTY_OUTPUT',message:'L’IA a répondu sans produire de données exploitables.'})}
    let data;try{data=JSON.parse(out)}catch(e){console.error('[SMARTLINK_AI]',requestId,'PARSE_FAILED');return res.status(502).json({error:'AI_INVALID_JSON',message:'La réponse IA n’a pas pu être interprétée.'})}
    const rawOffers=Array.isArray(data?.offers)?data.offers.filter(o=>o&&typeof o==='object').slice(0,20):[];
    const normalizeUrl=x=>{try{return new URL(String(x)).toString().replace(/\/$/,'')}catch{return ''}};
    const allowedSourceUrls=new Set(urls.map(normalizeUrl));
    const offers=[];
    for(const o of rawOffers){
      const sourceUrl=normalizeUrl(o.source_url);
      if(!sourceUrl||!allowedSourceUrls.has(sourceUrl))continue;
      const source=sourcePages.find(p=>normalizeUrl(p?.url)===sourceUrl);
      if(!source||source.error)continue;
      const jsonldUrls=(source.jsonld||[]).flatMap(x=>String(x).match(/https?:\/\/[^\s\"'<>]+/gi)||[]);
      const allowedImages=new Set([...(source.images||[]),...jsonldUrls].map(normalizeUrl).filter(Boolean));
      const imgs=Array.isArray(o.image_urls)?o.image_urls.map(normalizeUrl).filter(x=>x&&allowedImages.has(x)).slice(0,5):[];
      const title=typeof o.title==='string'?o.title.trim().slice(0,180):'';
      if(!title)continue;
      const price=(typeof o.price==='number'&&Number.isFinite(o.price)&&o.price>=0)?o.price:null;
      const stock=(typeof o.stock==='number'&&Number.isInteger(o.stock)&&o.stock>=0)?o.stock:null;
      const productType=['digital','service','physical'].includes(o.product_type)?o.product_type:'physical';
      offers.push({...o,title,description:typeof o.description==='string'?o.description.slice(0,3000):'',price,stock,product_type:productType,source_url:source.url,image_urls:imgs});
    }
    if(!offers.length){console.warn('[SMARTLINK_AI]',requestId,'NO_OFFERS');return res.status(200).json({offers:[],message:'L’IA a analysé les liens mais aucune offre exploitable n’a été trouvée.'})}
    console.info('[SMARTLINK_AI]',requestId,'SUCCESS','offers='+offers.length);
    return res.status(200).json({offers})
  }catch(e){
    console.error('[SMARTLINK_AI]',requestId,'FAILED',e?.name||'Error',e?.message||'Erreur import IA');
    return res.status(500).json({error:'IMPORT_FAILED',message:'L’importation IA a rencontré une erreur serveur.',detail:e?.message||'Erreur import IA'})
  }
}

module.exports = handler;
