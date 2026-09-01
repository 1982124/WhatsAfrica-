/* WhatsAfrica — mobile/weak-network resilience helpers. */
(function(){
'use strict';
const listeners=new Set();
let online=navigator.onLine;
function notify(){online=navigator.onLine;listeners.forEach(fn=>{try{fn(online)}catch(e){}});window.dispatchEvent(new CustomEvent('wa:network',{detail:{online}}));}
window.addEventListener('online',notify,{passive:true});
window.addEventListener('offline',notify,{passive:true});
function isOnline(){return online;}
function onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);try{fn(online)}catch(e){}return()=>listeners.delete(fn);}
async function retry(fn,{attempts=3,baseMs=350,maxMs=2500,shouldRetry=()=>true}={}){
 let last;
 for(let i=0;i<attempts;i++){
  try{return await fn(i+1)}catch(e){last=e;if(i===attempts-1||!shouldRetry(e))throw e;await new Promise(r=>setTimeout(r,Math.min(maxMs,baseMs*Math.pow(2,i))));}
 }
 throw last;
}
function guard(action){if(!isOnline())throw new Error('Hors connexion');return action();}
window.WA_NETWORK={isOnline,onChange,retry,guard};
})();
