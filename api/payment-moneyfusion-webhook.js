const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function rpc(name,body){
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>null); if(!r.ok) throw new Error(d?.message||'rpc_failed'); return d;
}
module.exports=async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
 if(!SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({ok:false,error:'supabase_env_missing'});
 let p={};try{p=typeof req.body==='string'?JSON.parse(req.body):req.body||{}}catch{return res.status(400).json({ok:false,error:'invalid_json'})}
 const event=String(p.event||''), token=String(p.tokenPay||p.token||'').trim(), transaction=String(p.numeroTransaction||p._id||token).trim();
 const status=event==='payin.session.completed'?'paid':event==='payin.session.cancelled'?'cancelled':'pending';
 if(!token)return res.status(400).json({ok:false,error:'provider_token_missing'});
 try{
   const u=new URL(SUPABASE_URL+'/rest/v1/payment_intents');u.searchParams.set('provider','eq.moneyfusion');u.searchParams.set('provider_reference','eq.'+token);u.searchParams.set('select','id,order_id,amount,status,provider_reference');const rr=await fetch(u,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY}});if(!rr.ok)return res.status(502).json({ok:false,error:'intent_lookup_failed'});const intents=await rr.json();const intent=intents[0];if(!intent?.order_id)return res.status(404).json({ok:false,error:'payment_intent_not_found'});
   if(p.Montant!=null && Math.abs(Number(p.Montant)-Number(intent.amount))>0.01)return res.status(409).json({ok:false,error:'amount_mismatch'});
   const result=await rpc('apply_payment_webhook_event_for_service',{p_order_id:intent.order_id,p_provider:'moneyfusion',p_provider_event_id:token+':'+event,p_event_type:event||'payment',p_transaction_id:transaction,p_status:status,p_payload_hash:null});
   return res.status(200).json({ok:true,duplicate:false,event,status,result});
 }catch(e){console.error('payment-moneyfusion-webhook',e);return res.status(500).json({ok:false,error:'webhook_processing_failed'})}
};
