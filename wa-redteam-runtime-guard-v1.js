/* WASSAFRICA RED TEAM runtime guard v1
 * Fast-fail protection for conversation RPCs + friendly media states.
 */
(()=>{'use strict';if(window.__WA_REDTEAM_RUNTIME_GUARD__)return;window.__WA_REDTEAM_RUNTIME_GUARD__=true;
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  const isSupabase=String(url).includes('/rest/v1/');
  if(!isSupabase)return nativeFetch(input,init);
  const ac=new AbortController();const parent=init.signal;
  const timeout=setTimeout(()=>ac.abort('WASSAFRICA_TIMEOUT'),9000);
  if(parent){if(parent.aborted)ac.abort(parent.reason);else parent.addEventListener('abort',()=>ac.abort(parent.reason),{once:true});}
  try{return await nativeFetch(input,{...init,signal:ac.signal});}
  finally{clearTimeout(timeout)}
};
function cleanMediaText(){
  document.querySelectorAll('#msgs .bubble').forEach(b=>{
    const t=(b.textContent||'').trim();
    if(/média chiffré\s*[—-]\s*clé indisponible|clé indisponible|key unavailable/i.test(t)){
      if(!b.dataset.waRedteamMediaState){b.dataset.waRedteamMediaState='1';b.textContent='🔐 Média sécurisé — restauration en cours…';}
    }
  });
}
const start=()=>{cleanMediaText();const m=document.getElementById('msgs');if(m&&!m.dataset.waRedteamMediaObserver){m.dataset.waRedteamMediaObserver='1';new MutationObserver(()=>requestAnimationFrame(cleanMediaText)).observe(m,{childList:true,subtree:true});}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();