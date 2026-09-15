/* WASSAFRICA — Media Consistency v1
 * Repairs legacy P2P media rows that were incorrectly marked as E2EE
 * even though they intentionally have no ciphertext. The message schema
 * explicitly reserves encryption_version=1 for actually encrypted payloads.
 */
(()=>{
'use strict';
if(window.__WA_MEDIA_CONSISTENCY_V1__)return;
window.__WA_MEDIA_CONSISTENCY_V1__=true;
const SB='https://dzifpwqrqnvssfhwjccj.supabase.co',KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
let running=false;
function sess(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),x=JSON.parse(localStorage.getItem(k)||'null'),s=x?.access_token?x:x?.session||x?.currentSession||x?.data?.session;if(s?.access_token&&s.user?.id)return s}}catch{}return null}
async function api(path,opt={}){const s=sess();if(!s)throw Error('AUTH_REQUIRED');const h=new Headers(opt.headers||{});h.set('apikey',KEY);h.set('Authorization','Bearer '+s.access_token);if(opt.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const r=await fetch(SB+path,{...opt,headers:h});let d=null;try{d=await r.json()}catch{}if(!r.ok)throw Error(d?.message||d?.details||d?.hint||d?.code||('HTTP_'+r.status));return d}
const rest=(t,q='',o={})=>api('/rest/v1/'+t+(q?'?'+q:''),o);
async function repair(){if(running)return;const s=sess();if(!s)return;running=true;try{const mem=await rest('conversation_members','select=conversation_id&user_id=eq.'+encodeURIComponent(s.user.id));const ids=[...new Set((mem||[]).map(x=>x.conversation_id))];for(const cid of ids){const rows=await rest('messages_v2','select=id,encryption_version,ciphertext,encryption_metadata,message_type,media_path,media_mime&conversation_id=eq.'+encodeURIComponent(cid)+'&sender_id=eq.'+encodeURIComponent(s.user.id)+'&message_type=in.(image,video,audio,file,voice)&encryption_version=eq.1&ciphertext=is.null&limit=100');for(const r of rows||[]){const meta={...(r.encryption_metadata||{}),transport:r.encryption_metadata?.transport||'webrtc-dtls',consistency_repaired_at:new Date().toISOString(),e2ee_payload:false};await rest('messages_v2','id=eq.'+encodeURIComponent(r.id)+'&sender_id=eq.'+encodeURIComponent(s.user.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({encryption_version:0,encryption_metadata:meta})})}}}catch{}finally{running=false}}
window.WA_MEDIA_CONSISTENCY={version:1,repair};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repair,{once:true});else repair();
setInterval(repair,5000);
})();