/* WASSAFRICA — Commerce Event Bridge
   One lightweight event spine connecting Smart Link, product, conversation and conversion.
   No PII collection; anonymous session id only. */
(function(){
'use strict';
const SB='https://dzifpwqrqnvssfhwjccj.supabase.co';
const KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const AUTH='whatsafrica-auth';
const SESSION_KEY='wa-commerce-session-v1';
const MAX_QUEUE=40;
const ALLOWED=/^[a-z][a-z0-9_.:-]{1,79}$/;
let queue=[],flushing=false;

function session(){
  try{
    const raw=localStorage.getItem(AUTH),x=raw?JSON.parse(raw):null;
    return x?.access_token&&x?.user?.id?x:x?.session?.access_token?x.session:null;
  }catch{return null}
}
function sid(){
  try{
    let x=localStorage.getItem(SESSION_KEY);
    if(!x){x=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random());localStorage.setItem(SESSION_KEY,x)}
    return x;
  }catch{return null}
}
function clean(v,n=160){return typeof v==='string'?v.slice(0,n):null}
function meta(extra){
  const u=new URL(location.href);
  return {
    source:'wassafrica',
    session_id:sid(),
    path:clean(location.pathname,240),
    referrer:clean(document.referrer,240),
    smart_link_id:clean(extra?.smart_link_id||u.searchParams.get('smart_link_id')||u.searchParams.get('sl'),80),
    product_id:clean(extra?.product_id||u.searchParams.get('product_id'),80),
    conversation_id:clean(extra?.conversation_id,80),
    campaign_id:clean(extra?.campaign_id||u.searchParams.get('campaign_id')||u.searchParams.get('utm_campaign'),120),
    ...(extra||{})
  };
}
async function send(e){
  const s=session();
  const headers={'apikey':KEY,'Content-Type':'application/json'};
  if(s?.access_token)headers.Authorization='Bearer '+s.access_token;
  const r=await fetch(SB+'/rest/v1/rpc/track_commerce_event',{
    method:'POST',headers,body:JSON.stringify({
      p_event_type:e.event_type,
      p_entity_type:e.entity_type||null,
      p_entity_id:e.entity_id||null,
      p_business_id:e.business_id||null,
      p_metadata:e.metadata||{}
    }),
    keepalive:true
  });
  if(!r.ok)throw Error('TRACK_'+r.status);
}
async function flush(){
  if(flushing||!queue.length)return;
  flushing=true;
  try{
    while(queue.length){const e=queue.shift();try{await send(e)}catch{break}}
  }finally{flushing=false}
}
function track(event_type,opts={}){
  if(!ALLOWED.test(event_type))return;
  const e={
    event_type,
    entity_type:clean(opts.entity_type,60),
    entity_id:opts.entity_id||null,
    business_id:opts.business_id||null,
    metadata:meta(opts.metadata||{})
  };
  queue.push(e);if(queue.length>MAX_QUEUE)queue.shift();flush();
}
function attr(el,name){return el?.dataset?.[name]||null}
function boot(){
  window.WA_COMMERCE={track,flush};
  const u=new URL(location.href);
  const sl=u.searchParams.get('smart_link_id')||u.searchParams.get('sl');
  if(sl)track('smart_link_opened',{entity_type:'smart_link',entity_id:sl,metadata:{smart_link_id:sl}});
  document.addEventListener('click',function(ev){
    const el=ev.target?.closest?.('[data-wa-event]');
    if(!el)return;
    const event=el.dataset.waEvent;
    track(event,{
      entity_type:attr(el,'entityType'),
      entity_id:attr(el,'entityId'),
      business_id:attr(el,'businessId'),
      metadata:{
        smart_link_id:attr(el,'smartLinkId'),
        product_id:attr(el,'productId'),
        conversation_id:attr(el,'conversationId'),
        label:clean(el.textContent?.trim(),100)
      }
    });
  },{passive:true});
  document.addEventListener('wa:conversation-selected',e=>{
    const id=e.detail?.conversationId;if(id)track('conversation_opened',{entity_type:'conversation',entity_id:id,metadata:{conversation_id:id}});
  });
  document.addEventListener('wa:message-sent',e=>{
    const id=e.detail?.conversationId;if(id)track('message_sent',{entity_type:'conversation',entity_id:id,metadata:{conversation_id:id}});
  });
  window.addEventListener('pagehide',()=>flush(),{once:false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
