const SB_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
const JSON_HEADERS={'Content-Type':'application/json'};
async function sb(path,options={}){
  const r=await fetch(SB_URL+path,{...options,headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,...JSON_HEADERS,...(options.headers||{})}});
  const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
  return {r,data};
}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  if(!SB_URL||!SB_KEY) return res.status(503).json({error:'service_not_configured'});
  const auth=String(req.headers.authorization||''); const token=auth.replace(/^Bearer\\s+/i,'').trim();
  if(!token) return res.status(401).json({error:'unauthorized'});
  try{
    const au=await sb('/auth/v1/user',{headers:{Authorization:'Bearer '+token}});
    if(!au.r.ok||!au.data?.id) return res.status(401).json({error:'unauthorized'});
    const userId=au.data.id;
    const body=req.body||{};
    const orderId=String(body.order_id||'').trim();
    const method=String(body.method||'online').toLowerCase();
    const idempotencyKey=String(body.idempotency_key||'').trim().slice(0,200);
    if(!orderId||!idempotencyKey||idempotencyKey.length<16) return res.status(400).json({error:'invalid_request'});
    if(!['online','mobile_money'].includes(method)) return res.status(400).json({error:'payment_method_not_supported'});

    const oq=await sb('/rest/v1/orders?id=eq.'+encodeURIComponent(orderId)+'&buyer_user_id=eq.'+encodeURIComponent(userId)+'&select=id,business_id,buyer_user_id,buyer_name,buyer_phone,total,currency,payment_status,payment_provider,payment_transaction_id,tracking_token,status&limit=1');
    if(!oq.r.ok||!oq.data?.[0]) return res.status(404).json({error:'order_not_found'});
    const order=oq.data[0];
    if(order.payment_status==='paid') return res.status(409).json({error:'order_already_paid'});
    if(order.status==='cancelled') return res.status(409).json({error:'order_cancelled'});
    if(String(order.currency).toUpperCase()!=='XOF') return res.status(400).json({error:'currency_not_supported'});

    const items=await sb('/rest/v1/order_items?order_id=eq.'+encodeURIComponent(order.id)+'&select=title_snapshot,unit_price,quantity&order=created_at.asc');
    if(!items.r.ok) return res.status(500).json({error:'order_items_lookup_failed'});

    const conn=await sb('/rest/v1/rpc/get_payment_connection_secret_for_service',{method:'POST',body:JSON.stringify({p_user_id:(await sb('/rest/v1/businesses?id=eq.'+encodeURIComponent(order.business_id)+'&select=owner_id&limit=1')).data?.[0]?.owner_id||null})});
    if(!conn.r.ok||!conn.data?.[0]?.secret) return res.status(409).json({error:'payment_provider_not_connected',message:'Le vendeur doit connecter Money Fusion dans Encaissement.'});
    const secretUrl=String(conn.data[0].secret).trim();
    if(!/^https?:\\/\\//i.test(secretUrl)) return res.status(500).json({error:'payment_provider_config_invalid'});

    const idem=encodeURIComponent(idempotencyKey);
    const pi=await sb('/rest/v1/payment_intents?order_id=eq.'+encodeURIComponent(order.id)+'&idempotency_key=eq.'+idem+'&select=id,provider_reference,status,metadata&limit=1');
    let intent=pi.data?.[0]||null;
    if(!intent){
      const ins=await sb('/rest/v1/payment_intents',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({buyer_id:userId,business_id:order.business_id,order_id:order.id,provider:'moneyfusion',method,currency:order.currency,amount:Number(order.total),status:'created',idempotency_key:idempotencyKey,metadata:{source:'digital-checkout'}})});
      if(!ins.r.ok) return res.status(500).json({error:'payment_intent_creation_failed'});
      intent=ins.data?.[0];
    }
    if(intent?.provider_reference){
      return res.status(200).json({ok:true,payment_url:intent.metadata?.payment_url||null,payment_intent_id:intent.id,status:intent.status,provider_reference:intent.provider_reference,already_initiated:true});
    }

    const webhookUrl='https://dzifpwqrqnvssfhwjccj.supabase.co/functions/v1/moneyfusion-webhook';
    const returnUrl='https://wassafrica.vercel.app/commande/'+encodeURIComponent(order.tracking_token)+'?order_id='+encodeURIComponent(order.id);
    const articles=(items.data||[]).map(x=>({name:String(x.title_snapshot||'Produit').slice(0,120),price:Number(x.unit_price||0),quantity:Number(x.quantity||1)}));
    const payload={
      totalPrice:Number(order.total),
      article:articles,
      personal_Info:[{userId,orderId:order.id,paymentIntentId:intent.id}],
      numeroSend:String(body.buyer_phone||order.buyer_phone||'').trim(),
      nomclient:String(body.buyer_name||order.buyer_name||'Client WASSAFRICA').trim(),
      return_url:returnUrl,
      webhook_url:webhookUrl
    };
    if(payload.numeroSend.replace(/\\D/g,'').length<8) return res.status(400).json({error:'buyer_phone_required'});

    const pr=await fetch(secretUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const pt=await pr.text(); let pd=null; try{pd=pt?JSON.parse(pt):null}catch{}
    if(!pr.ok||!pd?.statut||!pd?.url||!pd?.token) return res.status(502).json({error:'moneyfusion_payment_failed',message:pd?.message||'Money Fusion n’a pas créé la session de paiement.'});

    const up=await sb('/rest/v1/payment_intents?id=eq.'+encodeURIComponent(intent.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({provider_reference:String(pd.token),status:'processing',metadata:{source:'digital-checkout',moneyfusion_token:String(pd.token),payment_url:String(pd.url)}})});
    if(!up.r.ok) return res.status(500).json({error:'payment_intent_finalize_failed'});
    return res.status(200).json({ok:true,payment_url:pd.url,payment_intent_id:intent.id,provider_reference:pd.token,order_id:order.id});
  }catch(e){console.error('payment-moneyfusion',e);return res.status(500).json({error:'payment_init_failed'});}
};