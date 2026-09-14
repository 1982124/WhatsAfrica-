import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const buckets=new Map<string,{start:number,count:number}>();
function limited(req:Request){const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();const now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000)b={start:now,count:0};b.count++;buckets.set(ip,b);return b.count<=20;}
function text(v:unknown,max:number){return typeof v==="string"?v.replace(/[\u0000-\u001F\u007F]/g,"").slice(0,max).trim():"";}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Méthode non autorisée."}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
 if(!limited(req))return new Response(JSON.stringify({error:"Trop de demandes. Réessayez dans une minute."}),{status:429,headers:{...cors,"Content-Type":"application/json"}});
 try{
  const body=await req.json();
  const items=Array.isArray(body.items)?body.items.slice(0,30).map((x:any)=>({product_id:text(x?.product_id,80),quantity:Math.max(1,Math.min(99,Number(x?.quantity)||1))})).filter(x=>x.product_id):[];
  if(!body.business_id||!body.smart_link_id||!text(body.buyer_name,120)||text(body.buyer_phone,40).replace(/\D/g,"").length<8||!items.length||!text(body.idempotency_key,120))throw new Error("Données de commande incomplètes.");
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  let buyerUserId=null;
  const auth=req.headers.get("Authorization")??"";const token=auth.replace(/^Bearer\s+/i,"");
  if(token){const {data:{user}}=await supabase.auth.getUser(token);if(user)buyerUserId=user.id;}
  const {data,error}=await supabase.rpc("create_guest_order",{p_business_id:body.business_id,p_smart_link_id:body.smart_link_id,p_buyer_name:text(body.buyer_name,120),p_buyer_phone:text(body.buyer_phone,40),p_delivery_city:text(body.delivery_city,120)||null,p_delivery_address:text(body.delivery_address,500)||null,p_delivery_method:body.delivery_method,p_payment_method:body.payment_method,p_items:items,p_idempotency_key:text(body.idempotency_key,120),p_buyer_user_id:buyerUserId});
  if(error)throw error;
  return new Response(JSON.stringify(data),{status:200,headers:{...cors,"Content-Type":"application/json"}});
 }catch(error){console.error("create-order",error);return new Response(JSON.stringify({error:error instanceof Error?error.message:"Impossible de créer la commande."}),{status:400,headers:{...cors,"Content-Type":"application/json"}});}
});