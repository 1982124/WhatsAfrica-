(()=>{'use strict';
const path=location.pathname;
if(!['/offer-create','/digital-products','/services'].includes(path))return;
const types=[['physical','🛍️ Produit physique','Objet ou marchandise'],['digital','📚 Produit digital','Fichier à vendre'],['service','🧰 Service','Prestation'],['collection','🗂️ Collection','Pack digital']];
const params=new URLSearchParams(location.search);
const current=params.get('type')||'physical';
const href=t=>`/offer-create?type=${encodeURIComponent(t)}`;
const run=()=>{
  const hero=document.querySelector('.hero');
  if(hero){const eyebrow=[...hero.children].find(x=>x.tagName==='DIV'&&!x.classList.contains('types'));if(eyebrow)eyebrow.textContent='CRÉER UNE OFFRE';const p=hero.querySelector('p');if(p)p.textContent='Choisissez ce que vous proposez. WASSAFRICA vous accompagne jusqu’à la publication dans le Marché.';}
  document.querySelectorAll('.types .type').forEach((el,i)=>{
    const t=el.dataset.type||types[i]?.[0];if(!t)return;
    el.setAttribute('type','button');
    el.setAttribute('aria-label',`Créer un ${types[i]?.[1]||t}`);
    el.classList.toggle('active',t===current);
    if(!el.dataset.waCommerceFlow){
      el.dataset.waCommerceFlow='1';
      el.addEventListener('click',()=>{if(location.search!==`?type=${encodeURIComponent(t)}`)location.href=href(t);});
      el.title='Choisir ce type d’offre';
    }
  });
  const gate=document.querySelector('#gate .gate');
  if(gate){const b=gate.querySelector('b');if(b)b.textContent='🔒 Abonnement requis pour publier dans le Marché.';const p=gate.querySelector('p');if(p)p.textContent='Starter, Business ou Premium actif permet de publier vos offres. Votre Smart Link reste votre identité WASSAFRICA.';const a=gate.querySelector('a');if(a){a.href='/market-pricing';a.textContent='Voir les abonnements';}}
  const editor=document.querySelector('#editor');
  if(editor&&!editor.classList.contains('hidden')){
    const context=document.querySelector('#context');
    if(context&&!context.dataset.waFlowContext){context.dataset.waFlowContext='1';context.insertAdjacentHTML('afterbegin','<div style="margin-bottom:8px;font-weight:900">'+({physical:'🛍️ Produit physique',digital:'📚 Produit digital',service:'🧰 Service',collection:'🗂️ Collection'}[current]||'Créer une offre')+'</div>');}
  }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(()=>run()).observe(document.documentElement,{subtree:true,childList:true});
})();