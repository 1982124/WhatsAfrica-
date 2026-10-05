const SB_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
async function sb(path,options={}){const r=await fetch(SB_URL+path,{...options,headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let data=null;try{data=t?JSON.parse(t):null}catch{}return{r,data};}
async function moneyFusionStatus(token){const r=await fetch('https://pay.moneyfusion.net/paiementNotif/'+encodeURIComponent(token));const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{}if(!r.ok||!d?.statut||!d?.data)throw Error('moneyfusion_status_unavailable');return d.data;}
function status(v){const s=String(v||'').toLowerCase();if(['paid','success','successful','succeeded','completed','complete'].includes(s))return'paid';if(['failed','failure','rejected','declined','error','cancelled','canceled','expired','no paid'].includes(s))return'failed';return'pending';}
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(!SB_URL||!SB_KEY)return res.status(503).json({error:'service_not_configured'});
 try{
  const body=req.body||{};
  const token=String(body.tokenPay||'').trim();
  if(!token)return res.status(400).json({error:'missing_token'});
  const canonical=await moneyFusionStatus(token);
  const ref=canonical?.personal_Info?.[0]||body?.personal_Info?.[0]||{};
  const orderId=String(ref.orderId||'').trim();
  const userId=String(ref.userId||'').trim();
  if(!orderId)return res.status(400).json({error:'missing_order_reference'});
  const oq=await sb('/rest/v1/orders?id=eq.'+encodeURIComponent(orderId)+'&select=id,buyer_user_id,total,currency,payment_status&limit=1');
  if(!oq.r.ok||!oq.data?.[0])return res.status(404).json({error:'order_not_found'});
  const order=oq.data[0];
  if(userId&&String(order.buyer_user_id)!==userId)return res.status(409).json({error:'buyer_mismatch'});
  if(String(order.currency).toUpperCase()!=='XOF'||Number(canonical.Montant)!==Number(order.total))return res.status(409).json({error:'payment_integrity_mismatch'});
  const st=status(canonical.statut||body.event);
  const eventId=token+':'+String(body.event||canonical.statut||'status');
  const applied=await sb('/rest/v1/rpc/apply_payment_webhook_event_for_service',{method:'POST',body:JSON.stringify({p_order_id:order.id,p_provider:'moneyfusion',p_provider_event_id:eventId,p_event_type:String(body.event||canonical.statut||'payment'),p_transaction_id:String(canonical.numeroTransaction||token),p_status:st,p_payload_hash:null})});
  if(!applied.r.ok)return res.status(500).json({error:'payment_apply_failed'});
  return res.status(200).json({ok:true,provider:'moneyfusion',status:st,order_id:order.id,transaction_id:canonical.numeroTransaction||token});
 }catch(e){console.error('payment-webhook',e);return res.status(400).json({error:'webhook_verification_failed'});}
};