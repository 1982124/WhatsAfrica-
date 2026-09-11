/* WhatsAfrica messaging compatibility + runtime recovery. */
(()=>{'use strict';
const recover=()=>{
  if(location.pathname!=='/inbox'||window.__WA_MESSAGING_RECOVERED__)return;
  const inline=[...document.scripts].find(s=>s.textContent.includes("const db=supabase.createClient")&&s.textContent.includes("async function boot"));
  if(!inline)return;
  let code=inline.textContent;
  if(!code.includes("<script>"))return;
  code=code.replace(/\n<script>[\s\S]*?<\/script>\n<\/script>\s*$/,'\n');
  code=code.replace("storage:window.localStorage}})","storage:window.localStorage,storageKey:'whatsafrica-auth'}})");
  code=code.replaceAll('🔐 Préparation sécurisée de la conversation…','Envoi en cours…');
  code=code.replaceAll('🔐 Préparation sécurisée en cours','Envoi en cours…');
  code=code.replaceAll('🔐 ','');
  code=code.replaceAll('⏳ Message sécurisé mis en attente. Il sera envoyé automatiquement dès que la connexion sera rétablie.','Message en attente…');
  code=code.replaceAll('Téléversement chiffré depuis votre appareil…','Envoi en cours…');
  code=code.replaceAll('Préparation sécurisée en cours','Envoi en cours…');
  try{
    const s=document.createElement('script');
    s.textContent=code;
    document.head.appendChild(s);
    window.__WA_MESSAGING_RECOVERED__=true;
    const body=document.getElementById('body'),composer=document.getElementById('composer');
    if(body&&composer&&!body.dataset.enterSendReady){
      body.dataset.enterSendReady='1';
      body.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
          event.preventDefault();
          if(typeof composer.requestSubmit==='function')composer.requestSubmit();
        }
      });
    }
  }catch(error){console.error('WhatsAfrica messaging recovery failed',error)}
};
window.addEventListener('error',event=>{
  if(String(event?.message||'').includes('Unexpected token')||String(event?.message||'').includes('Unexpected identifier'))setTimeout(recover,0);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',recover,{once:true});else recover();
})();