/* WASSAFRICA — Smart Link Commerce Engine v1
   Public entry point: Smart Link -> event spine -> product/conversation hooks.
   Languages: fr, en, yo, bm (Bambara), fon (Fongbé). */
(function(){
'use strict';
const SB='https://dzifpwqrqnvssfhwjccj.supabase.co';
const KEY='sb_publishable_olHxhduENR5AnqUwAh8Qtw_4az5UmRV';
const SID='wa-smart-link-session-v1';
const LANGS=['fr','en','yo','bm','fon'];
const LABELS={fr:{open:'Découvrir',contact:'Contacter',share:'Partager'},en:{open:'Discover',contact:'Contact',share:'Share'},yo:{open:'Ṣàwárí',contact:'Kàn sí',share:'Pín'},bm:{open:'Jɛlen',contact:'Aw ye kuma',share:'Wele'},fon:{open:'Nùxɔ́',contact:'Kpɔ́ nú',share:'Sɛ̀n'}};
function getLang(){
 const raw=(navigator.languages||[navigator.language||'fr']).map(x=>String(x).toLowerCase().split('-')[0]);
 const stored=localStorage.getItem('wa-language');
 return LANGS.includes(stored)?stored:(raw.find(x=>LANGS.includes(x))||'fr');
}
function sid(){try{let x=localStorage.getItem(SID);if(!x){x=crypto.randomUUID();localStorage.setItem(SID,x)}return x}catch{return null}}
let smartLinkId=null;let bootReady=false;const pending=[];
async function resolveSmartLinkId(){
 if(smartLinkId)return smartLinkId;
 const u=new URL(location.href);
 const explicit=u.searchParams.get('smart_link_id')||u.searchParams.get('sl');
 if(explicit){smartLinkId=explicit;return smartLinkId;}
 const slug=decodeURIComponent(u.pathname.replace(/^\\/+/, '').split('/')[0]||'').trim();
 if(!slug||slug.startsWith('api'))return null;
 try{
  const r=await fetch(SB+'/rest/v1/smart_links?select=id&slug=eq.'+encodeURIComponent(slug)+'&is_public=eq.true&limit=1',{headers:{apikey:KEY,Accept:'application/json'}});
  const rows=await r.json(); smartLinkId=rows?.[0]?.id||null;
 }catch{}
 return smartLinkId;
}
function meta(extra){
 const u=new URL(location.href);
 return {source:'smart_link',session_id:sid(),path:location.pathname,referrer:document.referrer.slice(0,240),
  smart_link_id:extra?.smart_link_id||u.searchParams.get('smart_link_id')||u.searchParams.get('sl'),
  product_id:extra?.product_id||u.searchParams.get('product_id')||null,language:getLang(),...(extra||{})};
}
async function track(event,extra={}){
 const id=meta(extra).smart_link_id||smartLinkId;
 if(!id){if(!bootReady)pending.push([event,extra]);return;}
 try{await fetch(SB+'/rest/v1/rpc/track_smart_link_event',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
 body:JSON.stringify({p_smart_link_id:id,p_event_type:event,p_metadata:meta(extra)}),keepalive:true})}catch{}
}
function boot(){
 const lang=getLang();window.WA_SMART_LINK={language:lang,languages:LANGS,labels:LABELS[lang]||LABELS.fr,track};
 const u=new URL(location.href),id=u.searchParams.get('smart_link_id')||u.searchParams.get('sl');
 if(id)track('smart_link_opened',{smart_link_id:id});
 document.documentElement.dataset.waLanguage=lang;
 document.addEventListener('click',e=>{
  const el=e.target?.closest?.('[data-wa-smart-event]');
  if(!el)return;
  track(el.dataset.waSmartEvent,{smart_link_id:el.dataset.smartLinkId||id,product_id:el.dataset.productId||null});
 },{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();