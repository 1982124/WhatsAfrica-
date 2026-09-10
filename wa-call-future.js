/* WhatsAfrica Future Calls — zero-cost UX layer: direct calling + original WebAudio tones. */
(()=>{'use strict';
const S={ctx:null,ringTimer:null,ringing:false,startedAt:0,durationTimer:null};
const tones={
  message:[{f:660,d:.07},{f:880,d:.09}],
  sent:[{f:520,d:.06},{f:780,d:.08}],
  incoming:[{f:392,d:.14},{f:523,d:.14},{f:659,d:.20}],
  outgoing:[{f:523,d:.12},{f:659,d:.12}],
  end:[{f:659,d:.08},{f:523,d:.12},{f:392,d:.16}]
};
function audio(){if(S.ctx)return S.ctx;try{S.ctx=new (window.AudioContext||window.webkitAudioContext)();return S.ctx}catch(e){return null}}
function tone(seq,loop=false){const c=audio();if(!c)return; if(c.state==='suspended')c.resume().catch(()=>{}); const play=()=>{let t=c.currentTime;for(const x of seq){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(x.f,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.075,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+x.d);o.connect(g).connect(c.destination);o.start(t);o.stop(t+x.d+.015);t+=x.d+.025}return t}; const end=play(); if(loop){clearTimeout(S.ringTimer);S.ringTimer=setTimeout(()=>{if(S.ringing)tone(seq,true)},Math.max(500,(end-c.currentTime)*1000+900))}}
function stopRing(){S.ringing=false;clearTimeout(S.ringTimer);S.ringTimer=null}
function startRing(kind='incoming'){S.ringing=true;tone(tones[kind]||tones.incoming,true)}
function fmt(ms){const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),r=s%60;return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`}
function watchCallModal(){const obs=new MutationObserver(()=>{const m=document.getElementById('waCallModal');if(!m)return;const visible=getComputedStyle(m).display!=='none';const title=m.querySelector('#waCallTitle')?.textContent||'';const incoming=/entrant/i.test(title);if(visible&&incoming&&!S.ringing){S.startedAt=Date.now();startRing('incoming')}if(!visible&&S.ringing)stopRing();if(visible&&!incoming&&S.ringing)stopRing();});obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['style','class']})}
function exposeContext(){const id=window.__WA_CURRENT_CONVERSATION?.id,peer=window.__WA_CURRENT_CONVERSATION?.peerId;if(!id||!peer||!window.WA_CALLS)return false;for(const [sel,mode] of [['#audio','audio'],['#video','video']]){const b=document.querySelector(sel);if(!b||b.dataset.waFutureBound)return true;b.dataset.waFutureBound='1';b.onclick=e=>{e.preventDefault();window.WA_CALLS.start(id,peer,mode).catch(err=>{console.error(err);alert(err?.message||'Appel impossible.')})}}return true}
function installQuickActions(){const head=document.getElementById('chathead');if(!head)return;const actions=head.querySelector('.actions');if(actions){actions.setAttribute('aria-label','Appels directs');actions.title='Appeler directement';}const poll=()=>{exposeContext();setTimeout(poll,800)};poll()}
function soundSettings(){if(document.getElementById('waSoundSettings'))return;const b=document.createElement('button');b.id='waSoundSettings';b.type='button';b.textContent='🔔 Sons';b.className='tool';const toolbar=document.getElementById('toolbar');if(toolbar)toolbar.appendChild(b);b.onclick=()=>{const enabled=localStorage.getItem('wa_sounds')!=='off';localStorage.setItem('wa_sounds',enabled?'off':'on');b.textContent=enabled?'🔕 Sons':'🔔 Sons';if(!enabled)tone(tones.message)};b.title='Activer ou couper les sons WhatsAfrica'}
function init(){watchCallModal();installQuickActions();soundSettings();document.addEventListener('pointerdown',()=>{const c=audio();if(c?.state==='suspended')c.resume().catch(()=>{})},{once:false,passive:true});}
window.WA_FUTURE_CALLS={ring:startRing,stopRing,beep:(kind='message')=>{if(localStorage.getItem('wa_sounds')==='off')return;tone(tones[kind]||tones.message)},duration:()=>S.startedAt?fmt(Date.now()-S.startedAt):'00:00'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();