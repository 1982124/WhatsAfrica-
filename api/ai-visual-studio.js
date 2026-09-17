const SUPABASE_URL='https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
function json(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private,no-store');return res.end(JSON.stringify(body));}
async function userFromToken(token){const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token}});if(!r.ok)return null;return r.json();}
async function rpc(token,name,args={}){const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.error||'Supabase RPC error');return d;}
function safe(v,n=2000){return String(v||'').replace(/[\\u0000]/g,'').slice(0,n);}
async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{ok:false,error:'Méthode non autorisée.'});
 const token=String(req.headers.authorization||'').replace(/^Bearer\\s+/i,'').trim(); if(!token)return json(res,401,{ok:false,error:'Connexion requise.'});
 const user=await userFromToken(token); if(!user?.id)return json(res,401,{ok:false,error:'Session expirée.'});
 if(!process.env.OPENAI_API_KEY)return json(res,503,{ok:false,error:'OPENAI_API_KEY n’est pas configurée sur Vercel.'});
 const body=req.body||{}; const prompt=safe(body.prompt,32000); const imageUrl=safe(body.image_url,20971520); const n=Math.min(3,Math.max(1,Number(body.n||1)));
 if(!prompt)return json(res,400,{ok:false,error:'Décrivez le visuel à créer.'});
 const genId=String(body.generation_id||'').trim(); if(!/^[0-9a-f-]{36}$/i.test(genId))return json(res,400,{ok:false,error:'generation_id requis.'});
 let consumed=0;
 try{
   const status=await rpc(token,'ai_studio_status',{});
   if(!status?.enabled)return json(res,402,{ok:false,error:'studio_premium_required',plan:status?.plan||'free'});
   if(Number(status.credits||0)<n)return json(res,402,{ok:false,error:'credits_exhausted',credits:Number(status.credits||0)});
   for(let i=0;i<n;i++){const c=await rpc(token,'ai_consume_credit',{p_generation_id:genId});if(!c?.ok)throw new Error('credits_exhausted');consumed++;}
   const model=process.env.WASSAFRICA_IMAGE_MODEL||'gpt-image-2';
   const payload=imageUrl?{model,prompt,images:[{image_url:imageUrl}],input_fidelity:'high',n,quality:body.quality==='high'?'high':'medium',size:body.size||'1536x1024',output_format:'webp',background:'auto',moderation:'auto',user:user.id}:{model,prompt,n,quality:body.quality==='high'?'high':'medium',size:body.size||'1536x1024',output_format:'webp',background:'auto',moderation:'auto',user:user.id};
   const endpoint=imageUrl?'https://api.openai.com/v1/images/edits':'https://api.openai.com/v1/images/generations';
   const ai=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await ai.json().catch(()=>({}));
   if(!ai.ok)throw new Error(data?.error?.message||'Le moteur image IA a refusé la génération.');
   const images=(data.data||[]).map(x=>x.b64_json).filter(Boolean);
   if(!images.length)throw new Error('Le moteur image IA n’a retourné aucun visuel.');
   const projectId=body.project_id||null;
   if(projectId){await rpc(token,'noop',{ }).catch(()=>{});}
   return json(res,200,{ok:true,generation_id:genId,credits:Number(status.credits)-n,images,model});
 }catch(e){
   for(let i=0;i<consumed;i++)await rpc(token,'ai_refund_credit',{p_generation_id:genId}).catch(()=>{});
   return json(res,422,{ok:false,error:safe(e?.message||'Génération impossible.',500)});
 }
}
module.exports=handler;