/* WASSAFRICA — messaging UX bridge: stable conversation entry + persistent WhatsApp-like search/media controls. */
(()=>{
'use strict';
if(window.__WA_MESSAGING_UX_V27__)return;
window.__WA_MESSAGING_UX_V27__=true;
const $=id=>document.getElementById(id);
const text=x=>String(x||'').replace(/\s+/g,' ').trim();
const qsafe=s=>{try{return CSS.escape(String(s))}catch{return String(s).replace(/[^a-zA-Z0-9_-]/g,'\\$&')}};
function css(){if($('wa-v27-css'))return;const s=document.createElement('style');s.id='wa-v27-css';s.textContent=`
.wa-v27-search-shell{position:sticky;top:0;z-index:8;background:#fff;padding:2px 0 9px;border-bottom:1px solid #e7ece9}
.wa-v27-search-row{display:flex;gap:7px;align-items:center}
.wa-v27-search-input{width:100%;border:1px solid #dce6e0;border-radius:15px;padding:12px 13px;font:inherit;outline:none;background:#fbfcfb;box-sizing:border-box}
.wa-v27-search-input:focus{border-color:#9aa9a1;box-shadow:0 0 0 3px rgba(70,81,75,.08)}
.wa-v27-filters{display:flex;gap:6px;overflow:auto;padding-top:7px;scrollbar-width:none}.wa-v27-filters::-webkit-scrollbar{display:none}
.wa-v27-filter{flex:0 0 auto;border:1px solid #dce5e1;background:#fff;color:#526058;border-radius:999px;padding:6px 10px;font:700 11px system-ui;cursor:pointer}.wa-v27-filter.active{background:#eef1ef;border-color:#aab6af;color:#17231e}
.wa-v27-count{font-size:11px;color:#7a857e;margin:6px 2px 0;min-height:15px}
.wa-v27-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0 0;padding:7px 0}.wa-v27-btn{border:1px solid #d7e1dc;background:#fff;border-radius:12px;min-width:42px;height:42px;padding:0 10px;font:800 14px system-ui,sans-serif;cursor:pointer}.wa-v27-btn:hover{background:#f2f4f3}.wa-v27-btn:disabled{opacity:.45;cursor:not-allowed}.wa-v27-label{font-size:11px;color:#68766f;margin-left:2px}.wa-v27-status{font-size:11px;color:#68766f;margin-left:4px}@media(max-width:640px){.wa-v27-toolbar{gap:5px}.wa-v27-btn{min-width:44px;height:44px;padding:0 8px}.wa-v27-label{display:none}}
`;
document.head.appendChild(s)}
function conversationReady(){try{return !!(window.WA_MEDIA_P2P?.getConversationContext?.()?.conversationId)}catch{return false}}
function setStatus(v){const e=$('wa-v27-status');if(e)e.textContent=v||''}
function findEntryButton(){return [...document.querySelectorAll('button,a,[role="button"]')].find(e=>text(e.textContent).toLowerCase()==='entrer')||null}
function forceConversationEntry(el){
 const explicit=el?.dataset?.conversationId||el?.dataset?.id;
 if(explicit){const row=document.querySelector('.conv[data-conversation-id="'+qsafe(explicit)+'"],.conv[data-id="'+qsafe(explicit)+'"]');if(row){row.click();return true}}
 let root=el?.closest?.('.conv,[data-conversation-id],[data-id]');
 if(root?.classList?.contains('conv')){root.click();return true}
 const id=root?.dataset?.conversationId||root?.dataset?.id;
 if(id){const row=document.querySelector('.conv[data-conversation-id="'+qsafe(id)+'"],.conv[data-id="'+qsafe(id)+'"]');if(row){row.click();return true}}
 const start=$('start'),target=$('target');
 if(start&&target&&text(target.value)){start.disabled=false;start.click();return true}
 return false;
}
function installEntryBridge(){
 if(window.__WA_V27_ENTRY__)return;window.__WA_V27_ENTRY__=true;
 document.addEventListener('click',e=>{const b=e.target?.closest?.('button,a,[role="button"]');if(!b||text(b.textContent).toLowerCase()!=='entrer')return;e.preventDefault();e.stopImmediatePropagation();if(!forceConversationEntry(b))setStatus('Impossible d’ouvrir cette conversation.');},true);
 document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing)return;const a=document.activeElement;if(a&&text(a.textContent).toLowerCase()==='entrer'){e.preventDefault();a.click()}},true);
}
function mediaButton(label,icon,title){const b=document.createElement('button');b.type='button';b.className='wa-v27-btn';b.innerHTML=icon+' <span>'+label+'</span>';b.title=title;return b}
async function sendFile(file){const api=window.WA_MEDIA_P2P;if(!api?.sendFile)throw Error('MEDIA_UNAVAILABLE');if(!conversationReady())throw Error('NO_CONVERSATION');await api.sendFile(file)}
function installMedia(){
 const composer=$('composer');if(!composer||$('wa-v27-toolbar'))return;css();
 const bar=document.createElement('div');bar.id='wa-v27-toolbar';bar.className='wa-v27-toolbar';
 const photo=mediaButton('Photo','📷','Envoyer une photo');const video=mediaButton('Vidéo','🎥','Enregistrer une courte vidéo');const audio=mediaButton('Audio','🎙️','Enregistrer un audio');const callAudio=mediaButton('Appel audio','📞','Appel audio');const callVideo=mediaButton('Appel vidéo','📹','Appel vidéo');
 const label=document.createElement('span');label.className='wa-v27-label';label.textContent='Photo · Vidéo · Audio · Appel';const status=document.createElement('span');status.id='wa-v27-status';status.className='wa-v27-status';bar.append(photo,video,audio,callAudio,callVideo,label,status);composer.parentElement.insertBefore(bar,composer);
 const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.id='wa-v27-photo-input';composer.parentElement.appendChild(input);photo.onclick=()=>input.click();input.onchange=async()=>{const f=input.files?.[0];input.value='';if(!f)return;try{await sendFile(f);setStatus('Photo envoyée')}catch{setStatus('Photo non envoyée')}};
 video.onclick=async()=>{if(!conversationReady()){setStatus('Choisis une conversation');return}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus('Vidéo indisponible sur cet appareil');return}video.disabled=true;let stream=null,rec=null;const chunks=[];try{stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':'video/webm';rec=new MediaRecorder(stream,{mimeType:mime});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=async()=>{try{const f=new File([new Blob(chunks,{type:mime})],'video-'+Date.now()+'.webm',{type:mime});await sendFile(f);setStatus('Vidéo envoyée')}catch{setStatus('Vidéo non envoyée')}finally{stream?.getTracks().forEach(t=>t.stop());video.disabled=false}};rec.start();setStatus('Enregistrement vidéo…');setTimeout(()=>{if(rec?.state==='recording')rec.stop()},5000)}catch{stream?.getTracks().forEach(t=>t.stop());video.disabled=false;setStatus('Autorisation caméra/micro requise')}};
 let recording=null,audioStream=null,audioChunks=[];audio.onclick=async()=>{if(recording){recording.stop();return}if(!conversationReady()){setStatus('Choisis une conversation');return}try{audioStream=await navigator.mediaDevices.getUserMedia({audio:true});audioChunks=[];const type=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';recording=new MediaRecorder(audioStream,{mimeType:type});recording.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};recording.onstop=async()=>{try{const f=new File([new Blob(audioChunks,{type})],'audio-'+Date.now()+'.webm',{type});await sendFile(f);setStatus('Audio envoyé')}catch{setStatus('Audio non envoyé')}finally{audioStream?.getTracks().forEach(t=>t.stop());audioStream=null;recording=null;audio.textContent='🎙️ Audio'}};recording.start();audio.textContent='⏹️ Stop';setStatus('Enregistrement audio…')}catch{audioStream?.getTracks().forEach(t=>t.stop());audioStream=null;recording=null;setStatus('Autorisation micro requise')}};
 const invokeCall=id=>{const b=$(id);if(b){b.click();return}setStatus('Appel indisponible ici')};callAudio.onclick=()=>invokeCall('waAudioBtn');callVideo.onclick=()=>invokeCall('waVideoBtn');
 const sync=()=>{const ok=conversationReady();[photo,video,audio,callAudio,callVideo].forEach(b=>b.disabled=!ok)};sync();setInterval(sync,700);
}
function mediaMatch(row,filter){if(filter==='all')return true;const s=row.innerText?.toLowerCase()||'';if(filter==='photos')return !!row.querySelector('img')||/photo|image/.test(s);if(filter==='videos')return !!row.querySelector('video')||/vidéo|video/.test(s);if(filter==='audio')return !!row.querySelector('audio')||/audio|vocal|voice/.test(s);if(filter==='links')return !!row.querySelector('a[href]')||/https?:\/\//.test(s);return true}
function applySearch(root,input,filter){const q=text(input.value).toLowerCase();let visible=0;document.querySelectorAll('.conv').forEach(row=>{const ok=(!q||(row.innerText||'').toLowerCase().includes(q))&&mediaMatch(row,filter);row.style.display=ok?'':'none';if(ok)visible++});const bubbles=document.querySelectorAll('.bubble');if(bubbles.length){bubbles.forEach(b=>{const ok=(!q||(b.innerText||'').toLowerCase().includes(q))&&mediaMatch(b,filter);b.style.outline=ok&&q?'2px solid rgba(70,81,75,.22)':'';b.style.display=ok?'':'none'});if(q)document.querySelector('.msgs')?.scrollTo({top:0,behavior:'smooth'})}const c=$('wa-v27-count');if(c)c.textContent=q||filter!=='all'?`${visible} résultat${visible>1?'s':''}`:''}
function installSearch(){
 const existing=$('chatSearch');const host=existing?.closest('.search');if(!host||$('wa-v27-search-shell'))return;css();
 const shell=document.createElement('div');shell.id='wa-v27-search-shell';shell.className='wa-v27-search-shell';const row=document.createElement('div');row.className='wa-v27-search-row';const input=document.createElement('input');input.className='wa-v27-search-input';input.placeholder='Rechercher une discussion ou un message…';input.autocomplete='off';input.value=existing.value||'';const clear=document.createElement('button');clear.type='button';clear.className='wa-v27-filter';clear.textContent='Effacer';row.append(input,clear);
 const filters=document.createElement('div');filters.className='wa-v27-filters';let active='all';const defs=[['all','Tout'],['photos','Photos'],['videos','Vidéos'],['audio','Audio'],['links','Liens']];defs.forEach(([id,label])=>{const b=document.createElement('button');b.type='button';b.className='wa-v27-filter'+(id==='all'?' active':'');b.textContent=label;b.onclick=()=>{active=id;filters.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');applySearch(shell,input,active)};filters.appendChild(b)});const count=document.createElement('div');count.id='wa-v27-count';count.className='wa-v27-count';shell.append(row,filters,count);host.replaceChildren(shell);
 input.addEventListener('input',()=>{existing.value=input.value;applySearch(shell,input,active)});clear.onclick=()=>{input.value='';existing.value='';applySearch(shell,input,active);input.focus()};
 applySearch(shell,input,active);
}
function boot(){css();installEntryBridge();installMedia();installSearch()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
new MutationObserver(()=>{installMedia();installSearch()}).observe(document.documentElement,{childList:true,subtree:true});
})();