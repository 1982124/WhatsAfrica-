import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization")??"";const token=auth.replace(/^Bearer\s+/i,"");if(!token)return json({error:"unauthorized"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)return json({error:"service_not_configured"},503);
 const db=createClient(url,key,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:userError}=await db.auth.getUser(token);if(userError||!user)return json({error:"unauthorized"},401);
 let body:any;try{body=await req.json()}catch{return json({error:"invalid_json"},400)}
 const entitlementId=String(body.entitlement_id??"").trim();const productId=String(body.product_id??"").trim();if(!entitlementId&&!productId)return json({error:"entitlement_or_product_required"},400);
 let query=db.from("digital_entitlements").select("id,product_id,downloads_count,max_downloads,expires_at,status,buyer_user_id").eq("buyer_user_id",user.id).eq("status","active");
 query=entitlementId?query.eq("id",entitlementId):query.eq("product_id",productId);
 const {data:ent,error:entError}=await query.order("created_at",{ascending:false}).limit(1).maybeSingle();if(entError)return json({error:"entitlement_lookup_failed"},500);if(!ent)return json({error:"not_entitled"},403);
 if(ent.expires_at&&new Date(ent.expires_at).getTime()<=Date.now())return json({error:"entitlement_expired"},403);
 if(ent.max_downloads!==null&&ent.downloads_count>=ent.max_downloads)return json({error:"download_limit_reached"},403);
 const {data:product,error:productError}=await db.from("products").select("id,title,digital_storage_path,digital_file_name,digital_mime_type").eq("id",ent.product_id).eq("product_type","digital").maybeSingle();if(productError)return json({error:"product_lookup_failed"},500);if(!product?.digital_storage_path)return json({error:"digital_asset_missing"},409);
 const {data:claimed,error:claimError}=await db.from("digital_entitlements").update({downloads_count:ent.downloads_count+1,first_downloaded_at:ent.downloads_count===0?new Date().toISOString():null,last_downloaded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",ent.id).eq("buyer_user_id",user.id).eq("status","active").lt("downloads_count",ent.max_downloads??2147483647).select("id,downloads_count,max_downloads").maybeSingle();
 if(claimError)return json({error:"download_claim_failed"},500);if(!claimed)return json({error:"download_limit_reached"},403);
 const {data:signed,error:signedError}=await db.storage.from("digital-products").createSignedUrl(product.digital_storage_path,300);if(signedError||!signed?.signedUrl)return json({error:"signed_url_failed"},500);
 return json({ok:true,product_id:product.id,title:product.title,file_name:product.digital_file_name,mime_type:product.digital_mime_type,downloads_count:claimed.downloads_count,max_downloads:claimed.max_downloads,url:signed.signedUrl,expires_in:300});
});