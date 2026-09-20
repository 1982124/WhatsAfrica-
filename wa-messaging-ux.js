/* WASSAFRICA — canonical inbox UX bridge.
   Purpose: expose already-existing backend receipt primitives as persistent UI state.
   Canonical shell invariant: inbox-v25 only. */
(function(){
'use strict';
const SB='https://dzifpwqrqnvssfhwjccj.supabase.co';
const KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const AUTH='whatsafrica-auth';
let timer=null,busy=false,lastConv=null,lastReadSignature='',realtime=null,audioCtx=null;
function unlockSound(){
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
  }catch{}
}
function playIncomingSound(){
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const now=audioCtx.currentTime;
    if(audioCtx.state==='suspended'){audioCtx.resume().catch(()=>{});return}
    const gain=audioCtx.createGain(),osc=audioCtx.createOscillator();
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.16,now+0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.24);
    osc.type='sine';osc.frequency.setValueAtTime(880,now);osc.frequency.setValueAtTime(1175,now+0.09);
    osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+0.25);
  }catch{}
}
function startIncomingSound(){
  document.addEventListener('pointerdown',unlockSound,{once:false,passive:true});
  document.addEventListener('keydown',unlockSound,{once:false,passive:true});
  document.addEventListener('wa:incoming-message',e=>{
    const m=e.detail;
    if(!m?.id||m.sender_id===session()?.user?.id)return;
    const sameConversation=String(m.conversation_id||'')===String(currentId()||'');
    if(!sameConversation||document.visibilityState!=='visible')playIncomingSound();
  });
}

function session(){
  try{
    const raw=localStorage.getItem(AUTH), x=raw?JSON.parse(raw):null;
    return x?.access_token&&x?.user?.id?x:x?.session?.access_token?x.session:null;
  }catch{return null}
}
function db(path,opt){
  const s=session(); if(!s) return Promise.reject(Error('AUTH_REQUIRED'));
  const h=new Headers(opt?.headers||{});
  h.set('apikey',KEY); h.set('Authorization','Bearer '+s.access_token);
  if(opt?.body) h.set('Content-Type','application/json');
  return fetch(SB+path,{...opt,headers:h}).then(async r=>{
    let d=null; try{d=await r.json()}catch{}
    if(!r.ok) throw Error(d?.message||d?.hint||d?.details||d?.code||('HTTP_'+r.status));
    return d;
  });
}
const rpc=(name,args)=>db('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)});
const rest=(table,q)=>db('/rest/v1/'+table+'?'+q);

function addStyle(){
  if(document.getElementById('waReceiptUXStyle')) return;
  const s=document.createElement('style'); s.id='waReceiptUXStyle';
  s.textContent='.wa-receipt{font-size:10px;margin-left:5px;letter-spacing:-1px;font-weight:800}.wa-receipt.sent{color:#7b877f}.wa-receipt.delivered{color:#5c786a}.wa-receipt.read{color:#1976d2}.wa-sync-note{font-size:11px;color:#68766e;margin:0 2px 7px}.wa-unread-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;display:inline-grid;place-items:center;background:#173d2d;color:#fff;font:800 10px system-ui;margin-left:5px}.wa-media-force{display:flex!important}.wa-status-key{font-size:11px;color:#6b776f;margin:0 2px 5px;text-align:right}';
  document.head.appendChild(s);
}
function currentId(){
  return window.__WA_CURRENT_CONVERSATION_ID||lastConv||null;
}
function decorateReceipts(){
  const boxes=[...document.querySelectorAll('#msgs .bubble.mine')];
  if(!boxes.length)return;
  const ids=boxes.map(b=>b.dataset.id).filter(Boolean);
  if(!ids.length)return;
  rest('message_receipts','select=message_id,user_id,delivered_at,read_at&message_id=in.('+ids.join(',')+')')
    .then(rows=>{
      const by=new Map();
      for(const r of rows||[]){
        const cur=by.get(r.message_id);
        if(!cur || r.read_at || r.delivered_at) by.set(r.message_id,r);
      }
      for(const b of boxes){
        let n=b.querySelector('.wa-receipt');
        if(!n){n=document.createElement('span');n.className='wa-receipt sent';const meta=b.querySelector('.meta');(meta||b).appendChild(n)}
        const r=by.get(b.dataset.id);
        n.textContent=r?.read_at?'✓✓':r?.delivered_at?'✓✓':'✓';
        n.className='wa-receipt '+(r?.read_at?'read':r?.delivered_at?'delivered':'sent');
        n.title=r?.read_at?'Lu':r?.delivered_at?'Remis':'Envoyé';
      }
    }).catch(()=>{});
}
async function markVisibleRead(){
  const id=currentId(); if(!id)return;
  const s=session(); if(!s?.user?.id)return;
  const incoming=[...document.querySelectorAll('#msgs .bubble:not(.mine)')].map(b=>b.dataset.id).filter(Boolean);
  if(!incoming.length)return;
  const sig=id+'|'+incoming.join(',');
  if(sig===lastReadSignature)return;
  try{
    await rpc('mark_messages_read',{p_message_ids:incoming});
    await rpc('mark_conversation_read_until',{p_conversation_id:id,p_message_id:incoming[incoming.length-1]});
    lastReadSignature=sig;
  }catch(e){console.warn('[WassAfrica] receipt sync',e)}
}
function ensureMedia(){
  const form=document.getElementById('composer');
  if(!form)return;
  const bridge=document.getElementById('waCanonicalMediaDock');
  if(!bridge && window.WA_MEDIA_P2P) {
    document.dispatchEvent(new CustomEvent('wa:media-ui-needed'));
  }
}
async function sync(){
  const id=currentId();
  if(!id||busy)return;
  busy=true;
  try{
    await markVisibleRead();
    decorateReceipts();
    ensureMedia();
  }finally{busy=false}
}
function start(){
  addStyle();
  startIncomingSound();
  if(timer)clearInterval(timer);
  timer=setInterval(()=>sync(),8000);
  // No global MutationObserver: receipt updates and message renders must not trigger sync loops.
  document.addEventListener('wa:conversation-selected',e=>{lastConv=e.detail?.conversationId||lastConv;lastReadSignature='';setTimeout(sync,250)});
  document.addEventListener('wa:conversation-ready',e=>{lastConv=e.detail?.conversationId||lastConv;lastReadSignature='';setTimeout(sync,250)});
  document.addEventListener('wa:inbox-ready',()=>setTimeout(sync,500));
  setTimeout(sync,700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();