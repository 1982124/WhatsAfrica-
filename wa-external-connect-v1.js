/* WASSAFRICA — External Connect v1
 * Safe interoperability layer:
 * - opens official/public web entry points instead of proxying traffic;
 * - uses Web Share when the browser supports it;
 * - can pass a locally captured media file to the native share sheet;
 * - never stores third-party credentials or asks WASSAFRICA to relay calls;
 * - keeps the camera UI untouched and compact.
 */
(()=>{'use strict';
if(window.__WA_EXTERNAL_CONNECT_V1__)return;window.__WA_EXTERNAL_CONNECT_V1__=true;
const NETWORKS=[
 {id:'whatsapp',label:'WhatsApp',url:'https://wa.me/'},
 {id:'telegram',label:'Telegram',url:'https://t.me/'},
 {id:'facebook',label:'Facebook',url:'https://www.facebook.com/'},
 {id:'instagram',label:'Instagram',url:'https://www.instagram.com/'},
 {id:'youtube',label:'YouTube',url:'https://www.youtube.com/'},
 {id:'tiktok',label:'TikTok',url:'https://www.tiktok.com/'},
 {id:'linkedin',label:'LinkedIn',url:'https://www.linkedin.com/'},
];
const css=`.wa-ext{position:fixed;inset:0;z-index:100000;background:#08120dcc;display:grid;place-items:end center;padding:12px}.wa-ext.hidden{display:none}.wa-ext-box{width:min(520px,100%);background:#fff;border:1px solid #dce5df;border-radius:22px;padding:14px;box-shadow:0 20px 70px #0005}.wa-ext-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.wa-ext-title{font:900 17px system-ui;color:#173d2d}.wa-ext-close{border:1px solid #dce5df;background:#fff;border-radius:12px;padding:8px 10px;font-weight:800}.wa-ext-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.wa-ext-grid button,.wa-ext-share{border:1px solid #dce5df;background:#fff;color:#173d2d;border-radius:14px;padding:11px;text-align:left;font-weight:800}.wa-ext-note{font:12px system-ui;color:#69746e;margin-top:10px;line-height:1.4}.wa-ext-call{margin-top:8px;width:100%;border:1px solid #173d2d;background:#173d2d;color:#fff;border-radius:14px;padding:11px;font-weight:800}`;
function install(){if(document.getElementById('waExtCss'))return;const s=document.createElement('style');s.id='waExtCss';s.textContent=css;document.head.appendChild(s);const d=document.createElement('div');d.id='waExternal';d.className='wa-ext hidden';d.innerHTML='<div class="wa-ext-box"><div class="wa-ext-head"><div class="wa-ext-title">Réseaux & contacts</div><button class="wa-ext-close" type="button">Fermer</button></div><div class="wa-ext-grid"></div><button class="wa-ext-share" type="button">↗ Partager depuis WASSAFRICA</button><div class="wa-ext-note">WASSAFRICA ouvre le réseau choisi. Les identifiants, messages et appels restent gérés par le service tiers. Aucun relais vidéo ou appel par les serveurs WASSAFRICA.</div><button class="wa-ext-call" type="button">☎ Appeler un numéro</button></div>';document.body.appendChild(d);d.querySelector('.wa-ext-close').onclick=close;d.querySelector('.wa-ext-share').onclick=()=>share();d.querySelector('.wa-ext-call').onclick=call;const grid=d.querySelector('.wa-ext-grid');for(const n of NETWORKS){const b=document.createElement('button');b.type='button';b.textContent=n.label;b.onclick=()=>window.open(n.url,'_blank','noopener,noreferrer');grid.appendChild(b)}}
function open(){install();document.getElementById('waExternal').classList.remove('hidden')}
function close(){document.getElementById('waExternal')?.classList.add('hidden')}
async function share(data={}){if(navigator.share){try{await navigator.share({title:data.title||'WASSAFRICA',text:data.text||'',url:data.url||location.href,files:data.files||undefined});return true}catch(e){if(e?.name==='AbortError')return false}}try{await navigator.clipboard.writeText(data.url||location.href);alert('Lien copié. Vous pouvez le coller dans le réseau de votre choix.');return false}catch{window.open(data.url||location.href,'_blank','noopener,noreferrer');return false}}
function call(){const n=prompt('Numéro à appeler');if(!n)return;const clean=n.trim();if(!/^[+0-9][0-9 .()-]{5,}$/.test(clean))return alert('Numéro invalide.');location.href='tel:'+clean.replace(/[^+0-9]/g,'')}
async function shareStudioMedia(){const out=document.getElementById('waStudioOutput'),media=out?.querySelector('img,video');if(!media?.src)return;try{const r=await fetch(media.src),blob=await r.blob();const ext=(blob.type.split('/')[1]||'bin').split(';')[0];const file=new File([blob],`WASSAFRICA-media.${ext}`,{type:blob.type||'application/octet-stream'});const ok=await share({title:'WASSAFRICA',text:'Média partagé depuis WASSAFRICA',files:[file]});if(ok)return}catch(e){}alert('Le partage de fichier n’est pas disponible dans ce navigateur. Vous pouvez utiliser le téléchargement du média puis le partager depuis votre appareil.')}
function wireStudio(){const out=document.getElementById('waStudioOutput');if(!out||out.dataset.waExtStudio)return;out.dataset.waExtStudio='1';const actions=out.querySelector('.wa-studio-actions');if(!actions)return;const b=document.createElement('button');b.type='button';b.textContent='↗ Partager ailleurs';b.onclick=shareStudioMedia;actions.appendChild(b)}
window.WA_EXTERNAL_CONNECT={version:1,open,close,share,call,shareStudioMedia,networks:NETWORKS};
function wire(){install();const tools=document.querySelector('.tools');if(tools&&!tools.dataset.waExt){tools.dataset.waExt='1';const b=document.createElement('button');b.id='waExternalBtn';b.className='tool';b.type='button';b.textContent='🌐 Réseaux';b.title='Ouvrir un réseau ou partager';b.onclick=e=>{e.preventDefault();open()};tools.appendChild(b)}wireStudio()}
function loadBrand(){if(document.getElementById('waWassafricaBrandScript'))return;const s=document.createElement('script');s.id='waWassafricaBrandScript';s.src='/wa-wassafrica-brand-v1.js';s.async=false;document.body.appendChild(s)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{wire();loadBrand()},{once:true});else{wire();loadBrand()}
new MutationObserver(()=>{wire();loadBrand()}).observe(document.body,{childList:true,subtree:true});
})();