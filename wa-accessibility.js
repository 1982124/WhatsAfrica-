/* WhatsAfrica — accessibility baseline shared by active pages. */
(function(){
'use strict';
const root=document.documentElement;
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)root.dataset.reducedMotion='true';
function announce(text){let el=document.getElementById('wa-a11y-live');if(!el){el=document.createElement('div');el.id='wa-a11y-live';el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');el.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';document.body.appendChild(el)}el.textContent=String(text||'')}
function focus(el){if(el&&typeof el.focus==='function'){el.setAttribute('tabindex',el.getAttribute('tabindex')||'-1');el.focus({preventScroll:true})}}
window.WA_A11Y={announce,focus};
})();
