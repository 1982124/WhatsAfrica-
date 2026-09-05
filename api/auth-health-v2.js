const SUPABASE_URL='https://dzifpwqrqnvssfhwjccj2.supabase.co';
const SUPABASE_PUBLISHABLE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const PROD_ORIGIN='https://whatsafrica.vercel.app';
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  const started=Date.now();
  let supabase='down';
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4500);
    const r=await fetch(`${SUPABASE_URL}/auth/v1/health`,{headers:{Accept:'application/json',apikey:SUPABASE_PUBLISHABLE_KEY},signal:controller.signal});
    clearTimeout(timer);
    supabase=r.ok?'healthy':'degraded';
  }catch(_){supabase='down';}
  return res.status(200).json({ok:supabase==='healthy',status:supabase==='healthy'?'healthy':'degraded',environment:'production',origin:PROD_ORIGIN,checks:{supabase,phone:'not_certified',email:'not_certified',google:'not_certified',profile:'not_certified',session:'not_certified'},provider_isolation:true,secondary_failure_does_not_block_auth:true,secrets_exposed:false,certification_rule:'infrastructure_healthy_does_not_equal_provider_certified',elapsed_ms:Date.now()-started,generated_at:new Date().toISOString()});
};
