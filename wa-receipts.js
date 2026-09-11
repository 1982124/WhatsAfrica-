/* WhatsAfrica messaging runtime recovery — authenticated inbox boot. */
(()=>{'use strict';
const PATH='/inbox';
const KEY='whatsafrica-auth';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const getClient=()=>window.supabase?.createClient?.('https://dzifpwqrqnvssfhwjccj.supabase.co','sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:KEY}});
const findInline=()=>[...document.scripts].find(s=>s.textContent.includes("const db=supabase.createClient")&&s.textContent.includes('async function boot'));
const normalizeCode=script=>{
 let code=script.textContent||'';
 code=code.replace(/\n<script>[\s\S]*?<\/script>\n<\/script>\s*$/,'\n');
 code=code.replace("storage:window.localStorage}})","storage:window.localStorage,storageKey:'"+KEY+"'}})");
 code=code.replaceAll('🔐 Préparation sécurisée de la conversation…','Envoi en cours…');
 code=code.replaceAll('🔐 Préparation sécurisée en cours','Envoi en cours…');
 code=code.replaceAll('🔐 ','');
 code=code.replaceAll('⏳ Message sécurisé mis en attente. Il sera envoyé automatiquement dès que la connexion sera rétablie.','Message en attente…');
 code=code.replaceAll('Téléversement chiffré depuis votre appareil…','Envoi en cours…');
 code=code.replaceAll('Préparation sécurisée en cours','Envoi en cours…');
 return code;
};
const enterFix=()=>{
 const body=document.getElementById('body'),composer=document.getElementById('composer');
 if(!body||!composer||body.dataset.enterSendReady==='1')return;
 body.dataset.enterSendReady='1';
 body.addEventListener('keydown',event=>{
   if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
     event.preventDefault();
     if(typeof composer.requestSubmit==='function')composer.requestSubmit();
     else composer.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   }
 });
};
const restartIfAuthenticated=async()=>{
 if(location.pathname!==PATH||window.__WA_MESSAGING_BOOT_RECOVERED__)return;
 const client=getClient(); if(!client)return;
 let session=null;
 for(let i=0;i<8&&!session;i++){try{session=(await client.auth.getSession()).data?.session||null}catch(e){}if(!session&&i<7)await wait(250)}
 if(!session)return;
 const login=document.getElementById('login'),main=document.getElementById('main');
 if(!login||!main)return;
 if(!login.classList.contains('hide')||main.classList.contains('hide')){
   const inline=findInline();
   if(inline){
     try{
       const s=document.createElement('script');
       s.textContent=normalizeCode(inline);
       document.head.appendChild(s);
       window.__WA_MESSAGING_BOOT_RECOVERED__=true;
       await wait(250);
     }catch(error){console.error('WhatsAfrica inbox recovery failed',error)}
   }
   login.classList.add('hide');
   main.classList.remove('hide');
 }
 enterFix();
};
window.addEventListener('error',event=>{
 const msg=String(event?.message||'');
 if(/Unexpected token|Unexpected identifier|boot/i.test(msg))setTimeout(restartIfAuthenticated,0);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(restartIfAuthenticated,300),{once:true});
else setTimeout(restartIfAuthenticated,300);
setTimeout(restartIfAuthenticated,1800);
})();