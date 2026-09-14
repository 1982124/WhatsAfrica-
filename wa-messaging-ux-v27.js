/* WASSAFRICA — messaging UX bridge: deterministic conversation entry + WhatsApp-like media controls. */
(()=>{
'use strict';
if(window.__WA_MESSAGING_UX_V27__)return;
window.__WA_MESSAGING_UX_V27__=true;
const $=id=>document.getElementById(id);
const text=x=>String(x||'').replace(/\s+/g,' ').trim();
function css(){if($('wa-v27-css'))return;const s=document.createElement('style');s.id='wa-v27-css';s.textContent='.wa-v27-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0 0;padding:7px 0}.wa-v27-btn{border:1px solid #d7e1dc;background:#fff;border-radius:12px;min-width:42px;height:42px;padding:0 10px;font:800 14px system-ui,sans-serif;cursor:pointer}.wa-v27-btn:hover{background:#f2f6f3}.wa-v27-btn:disabled{opacity:.45;cursor:not-allowed}.wa-v27-label{font-size:11px;color:#68766f;margin-left:2px}.wa-v27-status{font-size:11px;color:#68766f;margin-left:4px}@media(max-width:640px){.wa-v27-toolbar{gap:5px}.wa-v27-btn{min-width:44px;height:44px;padding:0 8px}.wa-v27-label{display:none}}';document.head.appendChild(s)}
function conversationReady(){try{return !!(window.WA_MEDIA_P2P?.getConversationContext?.()?.conversationId)}catch{return false}}
function setStatus(v){const e=$('wa-v27-status');if(e)e.textContent=v||''}
function findEntryButton(){return [...document.querySelectorAll('button,a,[role="button"]')].find(e=>text(e.textContent).toLowerCase()==='entrer')||null}
function forceConversationEntry(el){
  const root=el?.closest('[data-conversation-id],.conv,[data-id],li,.card,article,section,div');
  const id=root?.dataset?.conversationId||root?.dataset?.id||el?.dataset?.conversationId||el?.dataset?.id;
  if(id){
    const row=document.querySelector('.conv[data-conversation-id="'+CSS.escape(id)+'"],.conv[data-id="'+CSS.escape(id)+'"]');
    if(row&&row!==el){row.click();return true}
  }
  const row=root?.matches?.('.conv')?root:root?.querySelector?.('.conv');
  if(row&&row!==el){row.click();return true}
  const start=$('start'),target=$('target');
  if(start&&target&&text(target.value)){start.disabled=false;start.click();return true}
  return false;
}
function installEntryBridge(){
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('button,a,[role="button"]');
    if(!b||text(b.textContent).toLowerCase()!=='entrer')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!forceConversationEntry(b))setStatus('Impossible d’ouvrir cette conversation.');
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing)return;
    const a=document.activeElement;
    if(a&&text(a.textContent).toLowerCase()==='entrer'){e.preventDefault();a.click()}
  },true);
  document.addEventListener('click',e=>{
    const row=e.target?.closest?.('.conv');
    if(row){setTimeout(()=>{if(conversationReady())setStatus('Conversation ouverte');},50)}
  },true);
}
function mediaButton(label,icon,title){const b=document.createElement('button');b.type='button';b.className='wa-v27-btn';b.innerHTML=icon+' <span>'+label+'</span>';b.title=title;return b}
async function sendFile(file){const api=window.WA_MEDIA_P2P;if(!api?.sendFile)throw Error('MEDIA_UNAVAILABLE');if(!conversationReady())throw Error('NO_CONVERSATION');await api.sendFile(file)}
function installMedia(){
  const composer=$('composer');if(!composer||$('wa-v27-toolbar'))return;
  css();
  const bar=document.createElement('div');bar.id='wa-v27-toolbar';bar.className='wa-v27-toolbar';
  const photo=mediaButton('Photo','📷','Envoyer une photo');
  const video=mediaButton('Vidéo','🎥','Enregistrer une courte vidéo');
  const audio=mediaButton('Audio','🎙️','Enregistrer un audio');
  const callAudio=mediaButton('Appel audio','📞','Appel audio');
  const callVideo=mediaButton('Appel vidéo','📹','Appel vidéo');
  const label=document.createElement('span');label.className='wa-v27-label';label.textContent='Photo · Vidéo · Audio · Appel';
  const status=document.createElement('span');status.id='wa-v27-status';status.className='wa-v27-status';
  bar.append(photo,video,audio,callAudio,callVideo,label,status);composer.parentElement.insertBefore(bar,composer);
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.id='wa-v27-photo-input';composer.parentElement.appendChild(input);
  photo.onclick=()=>input.click();
  input.onchange=async()=>{const f=input.files?.[0];input.value='';if(!f)return;try{await sendFile(f);setStatus('Photo envoyée')}catch(e){setStatus('Photo non envoyée')}};
  video.onclick=async()=>{
    if(!conversationReady()){setStatus('Choisis une conversation');return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus('Vidéo indisponible sur cet appareil');return}
    video.disabled=true;let stream=null;let rec=null;const chunks=[];
    try{stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});rec=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':'video/webm'});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=async()=>{try{const f=new File([new Blob(chunks,{type:rec.mimeType||'video/webm'})],'video-'+Date.now()+'.webm',{type:rec.mimeType||'video/webm'});await sendFile(f);setStatus('Vidéo envoyée')}catch{setStatus('Vidéo non envoyée')}finally{stream?.getTracks().forEach(t=>t.stop());video.disabled=false}};rec.start();setStatus('Enregistrement…');setTimeout(()=>{if(rec?.state==='recording')rec.stop()},5000)}catch{stream?.getTracks().forEach(t=>t.stop());video.disabled=false;setStatus('Autorisation caméra/micro requise')}};
  let recording=null,audioStream=null,audioChunks=[];
  audio.onclick=async()=>{
    if(recording){recording.stop();return}
    if(!conversationReady()){setStatus('Choisis une conversation');return}
    try{audioStream=await navigator.mediaDevices.getUserMedia({audio:true});audioChunks=[];const type=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';recording=new MediaRecorder(audioStream,{mimeType:type});recording.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};recording.onstop=async()=>{try{const f=new File([new Blob(audioChunks,{type})],'audio-'+Date.now()+'.webm',{type});await sendFile(f);setStatus('Audio envoyé')}catch{setStatus('Audio non envoyé')}finally{audioStream?.getTracks().forEach(t=>t.stop());audioStream=null;recording=null;audio.textContent='🎙️ Audio';}};recording.start();audio.textContent='⏹️ Stop';setStatus('Enregistrement audio…')}catch{audioStream?.getTracks().forEach(t=>t.stop());audioStream=null;recording=null;setStatus('Autorisation micro requise')}};
  const invokeCall=id=>{const b=$(id);if(b){b.click();return}setStatus('Appel indisponible ici');};
  callAudio.onclick=()=>invokeCall('waAudioBtn');callVideo.onclick=()=>invokeCall('waVideoBtn');
  const sync=()=>{const ok=conversationReady();[photo,video,audio,callAudio,callVideo].forEach(b=>b.disabled=!ok)};
  sync();setInterval(sync,700);
}
function boot(){css();installEntryBridge();installMedia()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
new MutationObserver(()=>{installMedia()}).observe(document.documentElement,{childList:true,subtree:true});
})();