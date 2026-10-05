import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const db=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function moneyFusionStatus(token:string){
  const r=await fetch("https://pay.moneyfusion.net/paiementNotif/"+encodeURIComponent(token),{headers:{"Accept":"application/json"}});
  const t=await r.text();let d:any=null;try{d=t?JSON.parse(t):null}catch{}
  if(!r.ok||!d?.statut||!d?.data) throw new Error("moneyfusion_status_unavailable");
  return d.data;
}

function normalizeStatus(value:unknown){
  const s=String(value??"").toLowerCase();
  if(["paid","success","successful","succeeded","completed","complete"].includes(s))return "paid";
  if(["failed","failure","rejected","declined","error","cancelled","canceled","expired","no paid"].includes(s))return "failed";
  return "pending";
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const raw=await req.text(); let body:any;try{body=JSON.parse(raw)}catch{return json({error:"invalid_json"},400)};
  const database=db();

  // Native Money Fusion webhook: verify the transaction again against Money Fusion
  // before changing our order state. This endpoint is intentionally public.
  if(body?.tokenPay || body?.event?.startsWith?.("payin.session.")){
    const token=String(body.tokenPay??"").trim();
    if(!token)return json({error:"missing_token"},400);
    try{
      const canonical=await moneyFusionStatus(token);
      const orderId=String(canonical?.personal_Info?.[0]?.orderId??body?.personal_Info?.[0]?.orderId??"").trim();
      const userId=String(canonical?.personal_Info?.[0]?.userId??body?.personal_Info?.[0]?.userId??"").trim();
      if(!orderId)return json({error:"missing_order_reference"},400);
      const {data:order,error:oe}=await database.from("orders").select("id,buyer_user_id,total,currency,payment_status").eq("id",orderId).maybeSingle();
      if(oe)return json({error:"order_lookup_failed"},500);
      if(!order)return json({error:"order_not_found"},404);
      if(userId && String(order.buyer_user_id)!==userId)return json({error:"buyer_mismatch"},409);
      if(String(order.currency).toUpperCase()!=="XOF")return json({error:"currency_mismatch"},409);
      const paidAmount=Number(canonical.Montant);
      if(!Number.isFinite(paidAmount)||paidAmount!==Number(order.total))return json({error:"amount_mismatch"},409);
      const status=normalizeStatus(canonical.statut??body.event);
      const eventId=token+":"+String(body.event??canonical.statut??"status");
      const {data:applied,error:ae}=await database.rpc("apply_payment_webhook_event_for_service",{
        p_order_id:order.id,p_provider:"moneyfusion",p_provider_event_id:eventId,
        p_event_type:String(body.event??canonical.statut??"payment"),p_transaction_id:String(canonical.numeroTransaction||token),
        p_status:status,p_payload_hash:null
      });
      if(ae)return json({error:"payment_apply_failed"},500);
      return json({ok:true,provider:"moneyfusion",status,order_id:order.id,transaction_id:canonical.numeroTransaction||token,applied});
    }catch(e){console.error("moneyfusion webhook",e);return json({error:"webhook_verification_failed"},400)}
  }

  // Backward-compatible signed webhook contract.
  const secret=Deno.env.get("WA_PAYMENT_WEBHOOK_SECRET")??"";
  if(!secret)return json({error:"webhook_not_configured"},503);
  const signature=req.headers.get("x-wa-signature")??req.headers.get("x-webhook-signature")??"";
  if(!signature)return json({error:"missing_signature"},401);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw));
  const expected=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  const supplied=signature.replace(/^sha256=/i,"").trim().toLowerCase();
  if(supplied.length!==expected.length||supplied!==expected)return json({error:"invalid_signature"},401);

  const provider=String(body.provider??"unknown").toLowerCase();
  const providerEventId=String(body.provider_event_id??body.event_id??"").trim();
  if(!providerEventId)return json({error:"missing_provider_event_id"},400);
  const intentId=body.intent_id?String(body.intent_id):null;
  const providerReference=body.provider_reference?String(body.provider_reference):(body.transaction_id?String(body.transaction_id):null);
  const status=normalizeStatus(body.status??body.event_type);
  const eventType=String(body.event_type??status);
  const transactionId=body.transaction_id?String(body.transaction_id):providerReference;
  const amount=body.amount==null?null:Number(body.amount);
  const currency=body.currency?String(body.currency).toUpperCase():null;
  let intent:any=null;
  if(intentId){const q=await database.from("payment_intents").select("id,buyer_id,business_id,order_id,provider,method,currency,amount,status,provider_reference").eq("id",intentId).maybeSingle();if(q.error)return json({error:"intent_lookup_failed"},500);intent=q.data}
  if(!intent&&providerReference){const q=await database.from("payment_intents").select("id,buyer_id,business_id,order_id,provider,method,currency,amount,status,provider_reference").eq("provider_reference",providerReference).maybeSingle();if(q.error)return json({error:"intent_lookup_failed"},500);intent=q.data}
  if(intent){
    if(provider!==String(intent.provider).toLowerCase())return json({error:"provider_mismatch"},409);
    if(amount!==null&&Number(intent.amount)!==amount)return json({error:"amount_mismatch"},409);
    if(currency!==null&&String(intent.currency).toUpperCase()!==currency)return json({error:"currency_mismatch"},409);
  }
  const ins=await database.from("payment_events").insert({order_id:intent?.order_id??null,provider,provider_event_id:providerEventId,event_type:eventType,transaction_id:transactionId,status,payload_hash:null,received_at:new Date().toISOString()}).select("id").single();
  if(ins.error){if(ins.error.code==="23505")return json({ok:true,duplicate:true});return json({error:"event_record_failed"},500)}
  if(intent){
    const iu=await database.from("payment_intents").update({status,updated_at:new Date().toISOString(),provider_reference:providerReference||intent.provider_reference}).eq("id",intent.id);
    if(iu.error)return json({error:"intent_update_failed"},500);
    if(intent.order_id){
      const ou=await database.from("orders").update({payment_status:status,payment_provider:intent.provider,payment_transaction_id:transactionId,payment_paid_at:status==="paid"?new Date().toISOString():null,payment_updated_at:new Date().toISOString()}).eq("id",intent.order_id);
      if(ou.error)return json({error:"order_update_failed"},500);
    }
  }
  await database.from("payment_events").update({processed_at:new Date().toISOString()}).eq("id",ins.data.id);
  return json({ok:true,recorded:true,matched:!!intent,intent_id:intent?.id??null,order_id:intent?.order_id??null});
});
