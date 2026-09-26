const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.PUBLIC_APP_URL || 'https://wassafrica.vercel.app';

async function authUser(auth) {
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}
async function rpc(name, body, key, bearer) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+(bearer||key),'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok) throw new Error(data?.message||data?.hint||data?.details||'rpc_failed');
  return data;
}
async function servicePatch(table, query, patch) {
  const u=new URL(SUPABASE_URL+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(query)) u.searchParams.set(k, v);
  const r=await fetch(u,{method:'PATCH',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)});
  if(!r.ok) throw new Error('service_patch_'+r.status);
  return r.json().catch(()=>[]);
}
module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'method_not_allowed'});
  if(!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) return res.status(503).json({ok:false,error:'supabase_payment_env_missing'});
  const user=await authUser(req.headers.authorization);
  if(!user?.id) return res.status(401).json({ok:false,error:'authentication_required'});
  let body={}; try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{}}catch{return res.status(400).json({ok:false,error:'invalid_json'})}
  const orderId=String(body.order_id||'').trim(), method=String(body.method||'mobile_money').trim(), idem=String(body.idempotency_key||'').trim();
  if(!orderId || idem.length<16) return res.status(400).json({ok:false,error:'invalid_payment_request'});
  try{
    const intent=await rpc('create_order_payment_intent',{p_order_id:orderId,p_provider:'moneyfusion',p_method:method,p_idempotency_key:idem},SUPABASE_PUBLISHABLE_KEY,req.headers.authorization.slice(7).trim());
    if(intent?.provider_reference && intent?.status==='succeeded') return res.status(200).json({ok:true,paid:true,...intent});
    const creds=await rpc('get_payment_connection_secret_for_service',{p_user_id:user.id},SUPABASE_SERVICE_ROLE_KEY,SUPABASE_SERVICE_ROLE_KEY);
    const connection=Array.isArray(creds)?creds[0]:creds;
    const apiUrl=String(connection?.secret||process.env.MONEYFUSION_API_URL||'').trim();
    const apiKey=String(process.env.MONEYFUSION_API_KEY||'').trim();
    if(!apiUrl || !/^https?:\\/\\//i.test(apiUrl)) return res.status(503).json({ok:false,error:'moneyfusion_not_configured',message:'Connectez Money Fusion ou configurez MONEYFUSION_API_URL.'});
    const order=await (async()=>{const u=new URL(SUPABASE_URL+'/rest/v1/orders');u.searchParams.set('id','eq.'+orderId);u.searchParams.set('select','id,buyer_name,buyer_phone,total,currency,business_id');const r=await fetch(u,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY});if(!r.ok)throw new Error('order_lookup_failed');const d=await r.json();if(!d[0])throw new Error('order_not_found');return d[0]})();
    const items=await (async()=>{const u=new URL(SUPABASE_URL+'/rest/v1/order_items');u.searchParams.set('order_id','eq.'+orderId);u.searchParams.set('select','title_snapshot,unit_price,quantity');const r=await fetch(u,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY});if(!r.ok)throw new Error('order_items_lookup_failed');return r.json()})();
    const payload={
      totalPrice:Number(order.total),
      article:items.map(i=>({name:String(i.title_snapshot||'Article').slice(0,120),price:Number(i.unit_price||0),quantity:Number(i.quantity||1)})),
      numeroSend:String(order.buyer_phone||''),
      nomclient:String(order.buyer_name||'Client'),
      personal_Info:[{userId:user.id,orderId:order.id}],
      return_url:BASE_URL+'/commande/'+encodeURIComponent(body.tracking_token||'')+'?order_id='+encodeURIComponent(order.id),
      webhook_url:BASE_URL+'/api/payment-moneyfusion-webhook'
    };
    const headers={'Content-Type':'application/json'}; if(apiKey) headers['moneyfusion-private-key']=apiKey;
    const pr=await fetch(apiUrl,{method:'POST',headers,body:JSON.stringify(payload)});
    const pd=await pr.json().catch(()=>null);
    if(!pr.ok || pd?.statut===false) return res.status(502).json({ok:false,error:'moneyfusion_payment_request_failed',provider_status:pr.status,provider_message:pd?.message||null});
    const token=String(pd?.tokenPay||pd?.token||pd?.data?.tokenPay||'').trim();
    const payUrl=String(pd?.url||pd?.data?.url||'').trim();
    if(!token) return res.status(502).json({ok:false,error:'moneyfusion_token_missing'});
    await servicePatch('payment_intents',{id:'eq.'+intent.payment_intent_id},{status:'requires_action',provider_reference:token,metadata:{order_id:order.id,provider_response:pd},updated_at:new Date().toISOString()});
    await servicePatch('orders',{id:'eq.'+order.id},{payment_provider:'moneyfusion',payment_transaction_id:token,payment_updated_at:new Date().toISOString()});
    return res.status(200).json({ok:true,payment_intent_id:intent.payment_intent_id,order_id:order.id,status:'requires_action',provider:'moneyfusion',provider_reference:token,payment_url:payUrl||null});
  }catch(e){console.error('payment-moneyfusion',e);return res.status(500).json({ok:false,error:'payment_start_failed',message:String(e?.message||e).slice(0,300)})}
};
