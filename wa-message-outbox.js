/* WASSAFRICA — durable text-message outbox.
   Free messaging invariant: no plan/credit gate; only transport retry and abuse controls remain external. */
(function(){
'use strict';
const DB='wassafrica-message-outbox-v1', STORE='queue', SB='https://dzifpwqrqnvssfhwjccj.supabase.co', KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV', AUTH='whatsafrica-auth';
let flushing=false, timer=null;
function session(){try{const x=JSON.parse(localStorage.getItem(AUTH)||'null');return x?.access_token&&x?.user?.id?x:x?.session?.access_token?x.session:null}catch{return null}}
function open(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function all(){const d=await open();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>{d.close();ok(r.result||[])};r.onerror=()=>{d.close();no(r.error)}})}
async function put(v){const d=await open();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readwrite').objectStore(STORE).put(v);r.onsuccess=()=>{d.close();ok()};r.onerror=()=>{d.close();no(r.error)}})}
async function del(id){const d=await open();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>{d.close();ok()};r.onerror=()=>{d.close();no(r.error)}})}
function networkError(e){const s=String(e?.message||e||'').toLowerCase();return !navigator.onLine||/failed to fetch|network|timeout|aborted|offline|load failed|err_internet|http_5|http_408|http_429/.test(s)}
async function post(payload){const s=session();if(!s)throw Error('AUTH_REQUIRED');const h=new Headers({'apikey':KEY,'Authorization':'Bearer '+s.access_token,'Content-Type':'application/json','Prefer':'return=minimal'});const r=await fetch(SB+'/rest/v1/messages_v2',{method:'POST',headers:h,body:JSON.stringify(payload)});if(r.ok)return true;let d=null;try{d=await r.json()}catch{}const msg=String(d?.message||d?.code||'HTTP_'+r.status);if(r.status===409||/duplicate|23505/i.test(msg))return true;const e=Error('HTTP_'+r.status);e.status=r.status;throw e}
function note(text){document.dispatchEvent(new CustomEvent('wa:message-delivery',{detail:{text}}))}
async function enqueue(payload){const item={...payload,queued_at:new Date().toISOString(),attempts:0};try{if(navigator.onLine){try{await post(payload);note('Message envoyé');return {sent:true,queued:false}}catch(e){if(!networkError(e))throw e}}await put(item);note('En attente de connexion');flush();return {sent:false,queued:true}}catch(e){console.error('[WassAfrica] outbox enqueue',e);throw e}}
async function flush(){if(flushing||!navigator.onLine)return;flushing=true;try{const rows=(await all()).sort((a,b)=>new Date(a.queued_at)-new Date(b.queued_at));for(const row of rows){try{await post(row);await del(row.id);note('Message transmis');}catch(e){row.attempts=(row.attempts||0)+1;row.last_error=String(e?.message||e);await put(row);if(networkError(e)||e.status>=500||e.status===429)break;await del(row.id)}}}finally{flushing=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),navigator.onLine?250:2000)}
window.WA_MESSAGE_OUTBOX={enqueue,flush,pending:async()=>all()};
window.addEventListener('online',()=>{note('Connexion rétablie — synchronisation…');schedule()},{passive:true});
window.addEventListener('offline',()=>note('Hors connexion — les messages restent en attente'),{passive:true});
window.addEventListener('wa:message-delivery',e=>{const s=document.getElementById('subtitle');if(s&&e.detail?.text){const prev=s.textContent;s.textContent=e.detail.text;setTimeout(()=>{if(s.textContent===e.detail.text)s.textContent=prev},2200)}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
schedule();
})();
