async function fetchImportedImage(imageUrl,res){
  const u=new URL(imageUrl);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return res.status(400).json({error:'INVALID_IMAGE_URL'});
  if(u.port&&u.port!=='80'&&u.port!=='443')return res.status(400).json({error:'INVALID_IMAGE_PORT'});
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1'||host.startsWith('127.')||host.startsWith('10.')||host.startsWith('192.168.')||host.startsWith('169.254.')||host.startsWith('172.16.')||host.startsWith('172.17.')||host.startsWith('172.18.')||host.startsWith('172.19.')||host.startsWith('172.2')||host.startsWith('172.30.')||host.startsWith('172.31.')||host.endsWith('.internal'))return res.status(400).json({error:'BLOCKED_HOST'});
  const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),5000);let r;
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
    const declaredLength=Number(r.headers.get('content-length')||0);
    if(declaredLength>4*1024*1024)throw new Error('SOURCE_TOO_LARGE');
    const htmlBuffer=Buffer.from(await r.arrayBuffer());
    if(htmlBuffer.length>4*1024*1024)throw new Error('SOURCE_TOO_LARGE');
    const html=htmlBuffer.toString('utf8');const clean=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ');
    const title=(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').trim();
    const metas=[...clean.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|og:image|product:price:amount|product:price:currency)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)].map(m=>m[1]).filter(Boolean);
    const images=[...html.matchAll(/<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi)].map(m=>m[1].split(',')[0].trim()).filter(Boolean).map(x=>{try{return new URL(x,url).toString()}catch{return null}}).filter(Boolean).slice(0,10);
    const jsonld=[...html.matchAll(/<script[^>]+type=["']application\/ld\\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].trim()).filter(Boolean).slice(0,5);
    const text=clean.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,14000);
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
async function paymentAuthUser(auth){
  if(!auth?.startsWith('Bearer '))return null;const token=auth.slice(7).trim();if(!token)return null;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
  const r=await fetch((process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co')+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});
  return r.ok?await r.json().catch(()=>null):null;
}
async function paymentRpc(name,body,key,bearer){
  const base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co';
  const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+(bearer||key),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.hint||d?.details||'rpc_failed');return d;
}
async function paymentServicePatch(table,query,patch){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY,base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co',u=new URL(base+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(query))u.searchParams.set(k,v);
  const r=await fetch(u,{method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)});
  if(!r.ok)throw new Error('service_patch_'+r.status);return r.json().catch(()=>[]);
}
async function paymentServiceGet(path,params){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY,base=process.env.SUPABASE_URL||'https://dzifpwqrqnvssfhwjccj.supabase.co',u=new URL(base+'/rest/v1/'+path);
  Object.entries(params||{}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:{apikey:key,Authorization:'Bearer '+key}});if(!r.ok)throw new Error('service_get_'+r.status);return r.json();
}
async function paymentStart(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const sk=process.env.SUPABASE_SERVICE_ROLE_KEY,pk=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!sk||!pk)return res.status(503).json({ok:false,error:'supabase_payment_env_missing'});
  const user=await paymentAuthUser(req.headers.authorization);if(!user?.id)return res.status(401).json({ok:false,error:'authentication_required'});
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{},orderId=String(b.order_id||'').trim(),method=String(b.method||'mobile_money').trim(),idem=String(b.idempotency_key||'').trim();
  if(!orderId||idem.length<16)return res.status(400).json({ok:false,error:'invalid_payment_request'});
  const bearer=req.headers.authorization.slice(7).trim();
  const intent=await paymentRpc('create_order_payment_intent',{p_order_id:orderId,p_provider:'moneyfusion',p_method:method,p_idempotency_key:idem},pk,bearer);
  const creds=await paymentRpc('get_payment_connection_secret_for_service',{p_user_id:user.id},sk,sk);const connection=Array.isArray(creds)?creds[0]:creds;
  const apiUrl=String(connection?.secret||process.env.MONEYFUSION_API_URL||'').trim(),apiKey=String(process.env.MONEYFUSION_API_KEY||'').trim();
  if(!apiUrl||!/^https?:\\/\\//i.test(apiUrl))return res.status(503).json({ok:false,error:'moneyfusion_not_configured',message:'Connectez Money Fusion ou configurez MONEYFUSION_API_URL.'});
  const orders=await paymentServiceGet('orders',{id:'eq.'+orderId,select:'id,buyer_name,buyer_phone,total,currency'});if(!orders[0])return res.status(404).json({ok:false,error:'order_not_found'});const order=orders[0];
  const items=await paymentServiceGet('order_items',{order_id:'eq.'+orderId,select:'title_snapshot,unit_price,quantity'});
  const base=process.env.PUBLIC_APP_URL||'https://wassafrica.vercel.app';
  const payload={totalPrice:Number(order.total),article:items.map(i=>({name:String(i.title_snapshot||'Article').slice(0,120),price:Number(i.unit_price||0),quantity:Number(i.quantity||1)})),numeroSend:String(order.buyer_phone||''),nomclient:String(order.buyer_name||'Client'),personal_Info:[{userId:user.id,orderId:order.id}],return_url:base+'/commande/'+encodeURIComponent(b.tracking_token||'')+'?order_id='+encodeURIComponent(order.id),webhook_url:base+'/api/payment-moneyfusion-webhook'};
  const headers={'Content-Type':'application/json'};if(apiKey)headers['moneyfusion-private-key']=apiKey;
  const pr=await fetch(apiUrl,{method:'POST',headers,body:JSON.stringify(payload)}),pd=await pr.json().catch(()=>null);
  if(!pr.ok||pd?.statut===false)return res.status(502).json({ok:false,error:'moneyfusion_payment_request_failed',provider_status:pr.status,provider_message:pd?.message||null});
  const token=String(pd?.tokenPay||pd?.token||pd?.data?.tokenPay||'').trim(),paymentUrl=String(pd?.url||pd?.data?.url||'').trim();if(!token)return res.status(502).json({ok:false,error:'moneyfusion_token_missing'});
  await paymentServicePatch('payment_intents',{id:'eq.'+intent.payment_intent_id},{status:'requires_action',provider_reference:token,metadata:{order_id:order.id,provider_response:pd},updated_at:new Date().toISOString()});
  await paymentServicePatch('orders',{id:'eq.'+order.id},{payment_provider:'moneyfusion',payment_transaction_id:token,payment_updated_at:new Date().toISOString()});
  return res.status(200).json({ok:true,payment_intent_id:intent.payment_intent_id,order_id:order.id,status:'requires_action',provider:'moneyfusion',provider_reference:token,payment_url:paymentUrl||null});
}
async function paymentWebhook(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});const sk=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!sk)return res.status(503).json({ok:false,error:'supabase_env_missing'});
  const p=typeof req.body==='string'?JSON.parse(req.body):req.body||{},event=String(p.event||''),token=String(p.tokenPay||p.token||'').trim(),transaction=String(p.numeroTransaction||p._id||token).trim();
  const status=event==='payin.session.completed'?'paid':event==='payin.session.cancelled'?'cancelled':'pending';if(!token)return res.status(400).json({ok:false,error:'provider_token_missing'});
  const intents=await paymentServiceGet('payment_intents',{provider:'eq.moneyfusion',provider_reference:'eq.'+token,select:'id,order_id,amount,status,provider_reference'});const intent=intents[0];if(!intent?.order_id)return res.status(404).json({ok:false,error:'payment_intent_not_found'});
  if(p.Montant!=null&&Math.abs(Number(p.Montant)-Number(intent.amount))>0.01)return res.status(409).json({ok:false,error:'amount_mismatch'});
  const result=await paymentRpc('apply_payment_webhook_event_for_service',{p_order_id:intent.order_id,p_provider:'moneyfusion',p_provider_event_id:token+':'+event,p_event_type:event||'payment',p_transaction_id:transaction,p_status:status,p_payload_hash:null},sk,sk);
  return res.status(200).json({ok:true,event,status,result});
}
async function handler(req,res){
  const route=String(req.query?.__route||'');
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
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+openAiKey,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,text:{format:{type:'json_schema',name:'smartlink_offers',strict:true,schema:{type:'object',properties:{offers:{type:'array',maxItems:20,items:{type:'object',properties:{title:{type:'string'},description:{type:'string'},price:{type:['number','null']},currency:{type:'string'},stock:{type:['number','null']},category:{type:'string'},product_type:{type:'string',enum:['physical','digital','service']},source_url:{type:'string'},image_urls:{type:'array',items:{type:'string'},maxItems:5}},required:['title','description','price','currency','stock','category','product_type','source_url','image_urls'],additionalProperties:false}}},required:['offers'],additionalProperties:false}}}})});
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
