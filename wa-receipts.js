/* WASSAFRICA messaging runtime recovery — authenticated inbox boot. */
(()=>{'use strict';
const PATH='/inbox';
const KEY='whatsafrica-auth';
const SUPABASE_URL='https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const getClient=()=>window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:KEY}});
const findInline=()=>[...document.scripts].find(s=>s.textContent.includes("const db=supabase.createClient")&&s.textContent.includes('async function boot'));
const normalizeCode=script=>{
 let code=script.textContent||'';
 code=code.replace(/<\/?script\b[^>]*>/gi,'');
 code=code.replace("storage:window.localStorage}})","storage:window.localStorage,storageKey:'"+KEY+"'}})");
 // Replace only the visible brand; never touch identifiers such as WhatsAfricaCrypto/Voice.
 code=code.replace(/WhatsAfrica(?![A-Za-z])/g,'WASSAFRICA');
 code=code.replaceAll('🔐 Préparation sécurisée de la conversation…','Envoi en cours…');
 code=code.replaceAll('🔐 Préparation sécurisée en cours','Envoi en cours…');
 code=code.replaceAll('🔐 Préparation sécurisée','Envoi en cours…');
 code=code.replaceAll('🔐 ','');
 code=code.replaceAll('⏳ Message sécurisé mis en attente. Il sera envoyé automatiquement dès que la connexion sera rétablie.','Message en attente…');
 code=code.replaceAll('Téléversement chiffré depuis votre appareil…','Envoi en cours…');
 code=code.replaceAll('Préparation sécurisée en cours','Envoi en cours…');
 code=code.replaceAll('Préparation sécurisée','Envoi en cours…');
 code=code.replaceAll('Le chiffrement de cette conversation est en cours de préparation.','Envoi en cours…');
 code=code.replaceAll('Important : ajoutez les membres avant le premier message pour initialiser le chiffrement.','Membre ajouté.');
 code=code.replaceAll('Échec vocal :','Impossible d’envoyer le vocal :');
 return code;
};
const replaceBrand=value=>String(value??'').replace(/WhatsAfrica(?![A-Za-z])/g,'WASSAFRICA').replace(/Whats Africa/g,'WASSAFRICA');
const paintBrand=()=>{
 document.title=replaceBrand(document.title);
 if(!document.body)return;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{const v=replaceBrand(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v});
 document.body.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el=>['title','aria-label','placeholder'].forEach(a=>{if(el.hasAttribute(a)){const v=replaceBrand(el.getAttribute(a));if(v!==el.getAttribute(a))el.setAttribute(a,v)}}));
};
const enterFix=()=>{
 const body=document.getElementById('body'),composer=document.getElementById('composer');
 if(!body||!composer||body.dataset.enterSendReady==='1')return;
 body.dataset.enterSendReady='1';
 body.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.stopPropagation();if(typeof composer.requestSubmit==='function')composer.requestSubmit(document.getElementById('send'));else composer.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}},true);
};
const restartIfAuthenticated=async()=>{
 if(location.pathname!==PATH||window.__WA_MESSAGING_BOOT_RECOVERED__)return;
 const client=getClient();if(!client)return;
 let session=null;
 for(let i=0;i<10&&!session;i++){try{session=(await client.auth.getSession()).data?.session||null}catch(e){}if(!session&&i<9)await wait(300)}
 if(!session)return;
 const login=document.getElementById('login'),main=document.getElementById('main');if(!login||!main)return;
 const inline=findInline();
 if(inline){try{const s=document.createElement('script');s.textContent=normalizeCode(inline);document.head.appendChild(s);window.__WA_MESSAGING_BOOT_RECOVERED__=true;await wait(400)}catch(error){console.error('WASSAFRICA inbox recovery failed',error)}}
 login.classList.add('hide');main.classList.remove('hide');enterFix();paintBrand();
};
window.addEventListener('error',event=>{const msg=String(event?.message||'');if(/Unexpected token|Unexpected identifier|boot|supabase/i.test(msg))setTimeout(restartIfAuthenticated,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(restartIfAuthenticated,250),{once:true});else setTimeout(restartIfAuthenticated,250);
setTimeout(restartIfAuthenticated,1800);setTimeout(restartIfAuthenticated,4000);setTimeout(paintBrand,5000);
})();