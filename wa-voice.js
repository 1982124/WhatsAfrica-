/* WhatsAfrica Voice — encrypted voice media + visible inbox media controls. */
(function(global){'use strict';
const te=new TextEncoder();
const b64=bytes=>{let s='';const a=new Uint8Array(bytes);for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encryptBytes(bytes,rawKey,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},await key(rawKey),bytes));return{iv,ciphertext:ct}}
async function decryptBytes(bytes,rawKey,iv,aad){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},await key(rawKey),bytes))}
function preferredMime(){if(typeof MediaRecorder==='undefined')return null;const types=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'];return types.find(x=>{try{return MediaRecorder.isTypeSupported(x)}catch{return false}})||null}
function mimeBase(mime){return String(mime||'audio/webm').split(';')[0]}
function detectAudioMime(bytes,fallback){const b=new Uint8Array(bytes||[]);if(b.length>=4&&b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)return'audio/webm';if(b.length>=4&&String.fromCharCode(...b.slice(0,4))==='OggS')return'audio/ogg';if(b.length>=8&&String.fromCharCode(...b.slice(4,8))==='ftyp')return'audio/mp4';return mimeBase(fallback)||'audio/webm'}
async function startRecording(){if(!navigator.mediaDevices?.getUserMedia)throw new Error('Le microphone n’est pas disponible sur cet appareil ou ce navigateur.');const mime=preferredMime();if(!mime)throw new Error('Les messages vocaux ne sont pas pris en charge sur cet appareil.');let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){if(e?.name==='NotAllowedError')throw new Error('Autorisez le microphone dans les réglages Android pour envoyer un vocal.');if(e?.name==='NotFoundError')throw new Error('Aucun microphone disponible sur cet appareil.');throw new Error('Accès au microphone impossible.')}let recorder;try{recorder=new MediaRecorder(stream,{mimeType:mime})}catch(e){stream.getTracks().forEach(t=>t.stop());throw new Error('Le format audio choisi n’est pas compatible avec cet appareil.')}const chunks=[];const startedAt=Date.now();let settled=false;const cleanup=()=>stream.getTracks().forEach(t=>{try{t.stop()}catch{}});recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const done=new Promise((resolve,reject)=>{recorder.onstop=()=>{if(settled)return;settled=true;cleanup();const actualMime=mimeBase(chunks[0]?.type||mime);resolve({blob:new Blob(chunks,{type:actualMime}),durationMs:Math.max(0,Date.now()-startedAt),mime:actualMime})};recorder.onerror=e=>{if(settled)return;settled=true;cleanup();reject(e.error||new Error('Enregistrement vocal impossible'))}});try{recorder.start(300)}catch(e){cleanup();throw new Error('Démarrage de l’enregistrement vocal impossible.')}return{recorder,done,stop:()=>{if(recorder.state==='recording')recorder.stop();return done}}}
async function send({db,storage,conversationId,senderId,rawKey,messageId,blob,durationMs,mime}){storage=storage||db?.storage;if(!db||!storage||!conversationId||!senderId||!rawKey||!blob)throw new Error('Message vocal invalide');if(blob.size>8*1024*1024)throw new Error('Message vocal trop volumineux (8 Mo maximum).');const id=messageId||crypto.randomUUID(),actualMime=mimeBase(mime||blob.type),aad=`whatsafrica:voice:v1:${conversationId}:${id}`,bytes=new Uint8Array(await blob.arrayBuffer()),enc=await encryptBytes(bytes,rawKey,aad),path=`${senderId}/${conversationId}/${id}.bin`,upload=await storage.from('private-voice').upload(path,new Blob([enc.ciphertext],{type:'application/octet-stream'}),{contentType:'application/octet-stream',upsert:false});if(upload.error)throw upload.error;const payload={id,conversation_id:conversationId,sender_id:senderId,body:null,message_type:'voice',audio_url:null,encryption_version:1,ciphertext:null,encryption_metadata:{v:1,kind:'voice',alg:'AES-256-GCM',iv:b64(enc.iv),aad,media_path:path,media_mime:actualMime,media_duration_ms:Math.round(durationMs||0),key_version:1},media_path:path,media_mime:actualMime,media_duration_ms:Math.round(durationMs||0)};const ins=await db.from('messages_v2').insert(payload).select('id,conversation_id,sender_id,message_type,created_at,encryption_version,ciphertext,encryption_metadata,media_path,media_mime,media_duration_ms').single();if(ins.error){await storage.from('private-voice').remove([path]).catch(()=>{});throw ins.error}return ins.data}
async function getUrl(storage,path){const r=await storage.from('private-voice').createSignedUrl(path,300);if(r.error)throw r.error;return r.data.signedUrl}
async function loadAndDecrypt(storage,path,rawKey,ivB64,aad,expectedMime){const r=await storage.from('private-voice').download(path);if(r.error)throw r.error;const bytes=new Uint8Array(await r.data.arrayBuffer()),plain=await decryptBytes(bytes,rawKey,unb64(ivB64),aad),mime=detectAudioMime(plain,expectedMime);return new Blob([plain],{type:mime})}
global.WhatsAfricaVoice={preferredMime,startRecording,send,getUrl,loadAndDecrypt};
})(window);

/* Inbox UI: render capabilities directly after the document exists. */
(function(){'use strict';
function install(){
 if(location.pathname!=='/inbox')return;
 const empty=document.getElementById('empty');
 if(!empty||document.getElementById('wa-media-empty'))return;
 const inner=empty.firstElementChild||empty;
 const card=document.createElement('div');
 card.id='wa-media-empty';
 card.style.cssText='margin:18px auto 0;max-width:680px;padding:18px;border:1px solid #263751;border-radius:18px;background:#111c2d;box-shadow:0 8px 24px rgba(0,0,0,.2)';
 card.innerHTML='<div style="font-weight:900;font-size:20px">🎙️ Vocal &nbsp; 📞 Appel audio &nbsp; 📹 Appel vidéo</div><div style="margin-top:8px;color:#98a8bd;font-size:14px;line-height:1.5">Communiquez par message, vocal, appel audio ou vidéo depuis WhatsAfrica.</div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px"><button type="button" id="wa-open-conversation" class="btn gold">🆕 Ouvrir une conversation</button><a href="/calls" class="btn ghost" style="text-decoration:none">📞📹 Ouvrir les appels</a></div><div style="margin-top:10px;color:#98a8bd;font-size:12px">🔒 Les appels et vocaux s’activent lorsque vous ouvrez un contact.</div>';
 inner.appendChild(card);
 const open=document.getElementById('wa-open-conversation');
 open?.addEventListener('click',()=>{const phone=document.getElementById('phone');if(phone){phone.focus();phone.scrollIntoView({behavior:'smooth',block:'center'})}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,1000);
setInterval(install,3000);
})();

/* Optional speech-to-text microphone, installed safely after DOM ready. */
(function(){'use strict';
function install(){
 if(location.pathname!=='/inbox')return;
 const composer=document.getElementById('composer'),body=document.getElementById('body'),voice=document.getElementById('voice');
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!composer||!body||!voice||composer.querySelector('.wa-speech-btn')||!SpeechRecognition)return;
 const btn=document.createElement('button');btn.type='button';btn.className='btn ghost wa-speech-btn';btn.textContent='🗣️';btn.title='Parler pour écrire';btn.setAttribute('aria-label','Parler pour écrire un message');composer.insertBefore(btn,voice);
 let recognition=null,listening=false,finalText='';
 btn.addEventListener('click',()=>{if(listening){recognition?.stop();return}recognition=new SpeechRecognition();recognition.lang=(navigator.language||'fr-FR');recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;finalText=body.value.trim();listening=true;btn.textContent='⏹️';btn.classList.add('gold');const status=document.getElementById('status');if(status){status.textContent='🎙️ Je vous écoute…';status.className='status ok'}recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const text=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)finalText=(finalText?finalText+' ':'')+text.trim();else interim+=text}body.value=(finalText+(interim?' '+interim:'')).trim()};recognition.onerror=e=>{listening=false;btn.textContent='🗣️';btn.classList.remove('gold');if(status){status.textContent=e.error==='not-allowed'?'Autorisez le microphone pour utiliser la saisie vocale.':'Saisie vocale indisponible : '+e.error;status.className='status err'}};recognition.onend=()=>{listening=false;btn.textContent='🗣️';btn.classList.remove('gold');body.focus();if(status){status.textContent=body.value.trim()?'Voix convertie en message. Appuyez sur ➤ pour envoyer.':'Prêt.';status.className='status ok'}};try{recognition.start()}catch(e){listening=false;btn.textContent='🗣️';btn.classList.remove('gold')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,1000);
setInterval(install,3000);
})();

/* Inbox recommendations: real visual cards, visible on the empty/home state. */
(function(){'use strict';
const items=[
 {title:'Découvrir des commerces africains',text:'Boutiques, restaurants et services à découvrir.',img:'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',href:'/market',label:'🛍️ Explorer le Marché'},
 {title:'Rencontrer la communauté',text:'Découvrez des personnes et des communautés africaines.',img:'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',href:'/groups',label:'👥 Voir les communautés'},
 {title:'Découvrir des activités',text:'Entreprises, créateurs et initiatives à travers l’Afrique.',img:'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80',href:'/universe',label:'🔎 Explorer'},
 {title:'Sorties & expériences',text:'Des lieux et expériences à découvrir autour de vous.',img:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',href:'/universe',label:'🌍 Découvrir'}
];
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function install(){
 if(location.pathname!=='/inbox')return;
 const app=document.getElementById('app'),empty=document.getElementById('empty');
 if(!app||!empty||document.getElementById('wa-recommendations'))return;
 const section=document.createElement('section');section.id='wa-recommendations';section.style.cssText='margin:18px 0 4px;width:100%;';
 section.innerHTML='<div style="font-weight:900;font-size:20px;margin-bottom:10px">✨ Recommandé pour vous</div><div style="color:#98a8bd;font-size:13px;line-height:1.5;margin-bottom:13px">Découvrez des personnes, activités, commerces et expériences sur WhatsAfrica.</div><div class="wa-rec-grid">'+items.map(x=>'<article style="background:#111c2d;border:1px solid #263751;border-radius:16px;overflow:hidden;min-width:0"><img src="'+esc(x.img)+'" alt="'+esc(x.title)+'" loading="lazy" referrerpolicy="no-referrer" style="display:block;width:100%;height:150px;object-fit:cover"><div style="padding:12px"><div style="font-weight:850;font-size:15px">'+esc(x.title)+'</div><div style="color:#98a8bd;font-size:12px;line-height:1.45;margin-top:5px">'+esc(x.text)+'</div><a href="'+esc(x.href)+'" class="btn ghost" style="display:inline-flex;text-decoration:none;margin-top:10px;font-size:12px">'+esc(x.label)+'</a></div></article>').join('')+'</div><style>#wa-recommendations .wa-rec-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:760px){#wa-recommendations .wa-rec-grid{grid-template-columns:1fr}}</style>';
 const parent=empty.parentElement||app;parent.appendChild(section);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,1200);setInterval(install,3000);
})();