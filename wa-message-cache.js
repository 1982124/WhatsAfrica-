(function(){'use strict';
const DB='wassafrica-message-cache-v2',STORE='rows';
function open(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'conversation_id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function put(conversationId,rows){const d=await open();return new Promise((ok,no)=>{const tx=d.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),req=s.get(conversationId);req.onsuccess=()=>{const old=req.result?.rows||[],map=new Map(old.map(x=>[x.id,x]));for(const row of rows||[])map.set(row.id,row);const merged=[...map.values()].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).slice(-500);s.put({conversation_id:conversationId,rows:merged,saved_at:Date.now()});};req.onerror=()=>no(req.error);tx.oncomplete=()=>{d.close();ok()};tx.onerror=()=>{d.close();no(tx.error)}})}
async function get(conversationId){const d=await open();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).get(conversationId);r.onsuccess=()=>{const v=r.result;d.close();ok(v?.rows||[])};r.onerror=()=>{d.close();no(r.error)}})}
async function meta(conversationId){const d=await open();return new Promise((ok,no)=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).get(conversationId);r.onsuccess=()=>{const v=r.result;d.close();ok(v?{saved_at:v.saved_at,count:(v.rows||[]).length}:null)};r.onerror=()=>{d.close();no(r.error)}})}
window.WA_MESSAGE_CACHE={put,get,meta};

const SB='https://dzifpwqrqnvssfhwjccj.supabase.co',KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV',AUTH='whatsafrica-auth';
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',\"'\":'&#39;',\"\\\":'&quot;'}[m]))}
async function directorySession(){
  try{
    const client=window.supabase?.createClient?.(SB,KEY,{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage,storageKey:AUTH}});
    if(client){const r=await client.auth.getSession();if(r?.data?.session)return r.data.session}
  }catch(e){}
  try{return JSON.parse(localStorage.getItem(AUTH)||'null')}catch{return null}
}
async function loadRegisteredDirectory(){
  const list=document.getElementById('list'),btn=document.getElementById('showInterlocutors');
  if(!list||!btn)return;
  const active=btn.style.background==='rgb(23, 61, 45)'||btn.style.background==='#173d2d';
  if(!active)return;
  const s=await directorySession(),uid=s?.user?.id;
  if(!uid)return;
  const scope=document.querySelector('#directoryScope [data-scope][style*="rgb(23, 61, 45)"]')?.dataset.scope||'global';
  list.innerHTML='<div class="empty">Chargement des inscrits WassAfrica…</div>';
  let rows=[];
  try{
    const h={apikey:KEY,Authorization:'Bearer '+s.access_token};
    const r=await fetch(SB+'/rest/v1/rpc/search_wassafrica_directory',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({p_query:'',p_scope:scope})});
    if(r.ok){const data=await r.json();if(Array.isArray(data))rows=data.filter(x=>x.user_id!==uid)}
  }catch(e){}
  if(!rows.length && scope==='global'){
    try{
      const h={apikey:KEY,Authorization:'Bearer '+s.access_token};
      const r=await fetch(SB+'/rest/v1/profiles?select=user_id,display_name,public_display_name,first_name,last_name,country,city,smartlink_slug,profile_image_url,profile_photo_url,avatar_url&user_id=neq.'+encodeURIComponent(uid)+'&order=created_at.asc&limit=100',{headers:h});
      if(r.ok){const data=await r.json();rows=(data||[]).map(p=>({user_id:p.user_id,display_name:[p.first_name,p.last_name].filter(Boolean).join(' ').trim()||p.public_display_name||p.display_name||'Membre WASSAFRICA',country:p.country,city:p.city,smartlink_slug:p.smartlink_slug,avatar_url:p.profile_image_url||p.profile_photo_url||p.avatar_url,result_type:'person'}))}
    }catch(e){}
  }
  const q=(document.getElementById('target')?.value||'').trim().toLowerCase();
  rows=rows.filter(p=>!q||[p.display_name,p.first_name,p.last_name,p.smartlink_slug,p.city,p.country].filter(Boolean).join(' ').toLowerCase().includes(q));
  list.innerHTML='';
  const head=document.createElement('div');head.style.cssText='padding:8px 10px;font-size:12px;font-weight:800;color:#536158';head.textContent='Tout WassAfrica · '+rows.length+' inscrit'+(rows.length>1?'s':'');list.appendChild(head);
  if(!rows.length){const e=document.createElement('div');e.className='empty';e.textContent='Aucun inscrit visible. Réessayez.';list.appendChild(e);return}
  for(const p of rows.slice(0,100)){
    const d=document.createElement('div');d.className='conv';d.tabIndex=0;d.style.touchAction='pan-y';
    const av=document.createElement('div');av.className='avatar';const photo=p.avatar_url||'';if(photo){const im=document.createElement('img');im.src=photo;im.alt='';im.style.cssText='width:100%;height:100%;border-radius:50%;object-fit:cover';av.append(im)}else av.textContent=(p.display_name||'W').trim().charAt(0).toUpperCase();
    const main=document.createElement('div');main.className='conv-main';const name=document.createElement('div');name.className='conv-name';name.textContent=p.display_name||'Profil WASSAFRICA';const sub=document.createElement('div');sub.className='conv-sub';sub.textContent=[p.result_type==='business'?'🏢 Entreprise':'👤 Membre',p.city,p.country].filter(Boolean).join(' · ');main.append(name,sub);d.append(av,main);
    const open=()=>{if(p.user_id)location.href='/inbox?recipient='+encodeURIComponent(p.user_id)};d.onclick=open;d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};list.appendChild(d);
  }
  list.style.overflowY='auto';list.style.overflowX='hidden';list.style.webkitOverflowScrolling='touch';list.style.touchAction='pan-y';list.style.minHeight='0';list.style.flex='1 1 auto';
}
function install(){
  const run=()=>setTimeout(()=>loadRegisteredDirectory().catch(()=>{}),80);
  document.getElementById('showInterlocutors')?.addEventListener('click',run,{passive:true});
  document.querySelectorAll('#directoryScope [data-scope]')?.forEach(b=>b.addEventListener('click',run,{passive:true}));
  window.addEventListener('wa:inbox-ready',run);
  run();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();