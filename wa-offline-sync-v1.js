/* WASSAFRICA — offline outbox sync v1 */
(()=>{
'use strict';
if(window.__WA_OFFLINE_SYNC_V1__)return;
window.__WA_OFFLINE_SYNC_V1__=true;
const SB='https://dzifpwqrqnvssfhwjccj.supabase.co',AUTH='whatsafrica-auth',BOX='wassafrica-outbox-v30:';
const getSession=()=>{try{const ks=[AUTH,...Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k&&k!==AUTH)];for(const k of ks){try{const x=JSON.parse(localStorage.getItem(k)||'null'),s=x?.access_token?x:x?.session||x?.currentSession||x?.data?.session;if(s?.access_token&&s.user?.id)return s}catch{}}}catch{}return null};
const getKey=()=>{try{return document.documentElement.outerHTML.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]||null}catch{return null}};
const key=()=>{const s=getSession();return s?.user?.id?BOX+s.user.id:null};
const read=()=>{try{return JSON.parse(localStorage.getItem(key()||'')||'[]')||[]}catch{return[]}};
const write=a=>{try{localStorage.setItem(key(),JSON.stringify(a.slice(-50)))}catch{}};
let running=false;
async function post(item,s){const k=getKey();if(!k||!s?.access_token)throw Error('AUTH_UNAVAILABLE');const r=await fetch(SB+'/rest/v1/messages_v2',{method:'POST',headers:{apikey:k,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({id:item.id,conversation_id:item.conversationId,sender_id:s.user.id,body:null,message_type:'text',encryption_version:1,ciphertext:item.ciphertext,encryption_metadata:item.metadata})});if(r.ok||r.status===409)return;throw Error('HTTP_'+r.status)}
async function flush(){if(running||navigator.onLine===false)return;const s=getSession(),items=read();if(!s||!items.length)return;running=true;try{for(const item of items){try{await post(item,s);write(read().filter(x=>x.id!==item.id))}catch{break}}}finally{running=false}}
addEventListener('online',()=>flush(),{passive:true});addEventListener('pageshow',()=>flush(),{passive:true});setInterval(flush,30000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>flush(),{once:true});else flush();
})();
