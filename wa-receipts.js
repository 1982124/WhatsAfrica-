/* WASSAFRICA messaging runtime recovery — resilient authenticated inbox boot. */
(()=>{'use strict';
const PATH='/inbox';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SUPABASE_URL='https://dzifpwqrqnvssfhwjccj.supabase.co';
const SUPABASE_KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const getClient=()=>window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
const replaceBrand=value=>String(value??'').replace(/WhatsAfrica(?![A-Za-z])/g,'WASSAFRICA').replace(/Whats Africa/g,'WASSAFRICA');
const paintBrand=()=>{
 document.title=replaceBrand(document.title);
 const root=document.body||document.documentElement;if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{const v=replaceBrand(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v});
 root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el=>['title','aria-label','placeholder'].forEach(a=>{if(el.hasAttribute(a)){const v=replaceBrand(el.getAttribute(a));if(v!==el.getAttribute(a))el.setAttribute(a,v)}}));
 root.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href')||'';if(/whatsafrica\.vercel\.app/i.test(href)){a.dataset.wassafricaLegacyHref=href;a.textContent=replaceBrand(a.textContent)}});
};
const brandObserver=()=>{if(window.__WASSAFRICA_BRAND_OBSERVER__)return;window.__WASSAFRICA_BRAND_OBSERVER__=true;const start=()=>{const root=document.documentElement;if(!root)return;const ob=new MutationObserver(()=>paintBrand());ob.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','href']});paintBrand();};if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});};
brandObserver();
const findInline=()=>[...document.scripts].find(s=>s!==document.currentScript&&s.textContent.includes("const db=supabase.createClient")&&s.textContent.includes('async function boot'));
const normalizeCode=script=>{
 let code=script.textContent||'';
 code=code.replace(/<\/?script\b[^>]*>/gi,'');
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
const enterFix=()=>{const body=document.getElementById('body'),composer=document.getElementById('composer');if(!body||!composer||body.dataset.enterSendReady==='1')return;body.dataset.enterSendReady='1';body.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();event.stopPropagation();if(typeof composer.requestSubmit==='function')composer.requestSubmit(document.getElementById('send'));else composer.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}},true)};
const restartIfAuthenticated=async()=>{
 if(location.pathname!==PATH||window.__WASSAFRICA_INBOX_RECOVERED__)return;
 const client=getClient();if(!client)return;
 let session=null;for(let i=0;i<12&&!session;i++){try{session=(await client.auth.getSession()).data?.session||null}catch(e){}if(!session&&i<11)await wait(250)}
 const login=document.getElementById('login'),main=document.getElementById('main');
 if(!login||!main)return;
 const inline=findInline();
 if(session&&inline){try{const code=normalizeCode(inline);const run=new Function(code);run();window.__WASSAFRICA_INBOX_RECOVERED__=true;await wait(350)}catch(error){console.error('WASSAFRICA inbox recovery failed',error)}}
 if(session){login.classList.add('hide');main.classList.remove('hide');enterFix();}
 paintBrand();
};
window.addEventListener('error',event=>{const msg=String(event?.message||'');if(/Unexpected|SyntaxError|boot|supabase|WASSAFRICA inbox recovery/i.test(msg))setTimeout(restartIfAuthenticated,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(restartIfAuthenticated,200),{once:true});else setTimeout(restartIfAuthenticated,200);
setTimeout(restartIfAuthenticated,1000);setTimeout(restartIfAuthenticated,2500);setTimeout(restartIfAuthenticated,5000);setTimeout(paintBrand,10000);
})();