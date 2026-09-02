(function(){'use strict';
/* WhatsAfrica: deterministic navigation + resilient Cockpit auth + calls CTA. */
function cockpitNav(){
  if(!/Cockpit/i.test(document.title))return;
  const wrap=document.querySelector('.wrap');
  if(!wrap||document.getElementById('waCockpitNav'))return;
  const nav=document.createElement('nav');
  nav.id='waCockpitNav';
  nav.setAttribute('aria-label','Navigation WhatsAfrica');
  nav.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 18px;padding:10px 0;border-bottom:1px solid #26334c;';
  const links=[['🏠 Accueil','/'],['🔴 Business Live','/live'],['🎯 CRM','/crm'],['📥 Inbox','/inbox']];
  links.forEach(([label,href])=>{
    const a=document.createElement('a');
    a.href=href;
    a.textContent=label;
    a.className='btn ghost';
    a.style.textDecoration='none';
    nav.appendChild(a);
  });
  const top=wrap.querySelector('.top');
  if(top)top.insertAdjacentElement('afterend',nav);else wrap.prepend(nav);
  const live=document.getElementById('liveBtn');
  if(live){
    const a=document.createElement('a');
    a.href='/live';a.textContent='🔴 Business Live';a.className=live.className;a.style.textDecoration='none';a.setAttribute('role','button');
    live.replaceWith(a);
  }
}
function stabilizeCockpitAuth(){
  if(!/Cockpit/i.test(document.title)||typeof db==='undefined'||!db.auth)return;
  const auth=document.getElementById('auth'),app=document.getElementById('app'),logout=document.getElementById('logout'),msg=document.getElementById('authMsg');
  const reveal=session=>{if(!session?.user)return;window.__WA_AUTH_USER=session.user;if(auth)auth.classList.add('hidden');if(app)app.classList.remove('hidden');if(logout)logout.classList.remove('hidden')};
  const recover=async session=>{if(!session?.user)return;reveal(session);try{if(typeof enter==='function')await enter(session.user)}catch(e){console.error('Cockpit secondary initialization',e)}reveal(session);if(msg)msg.textContent=''};
  db.auth.getSession().then(({data,error})=>{if(error){console.error('Cockpit getSession',error);return}if(data?.session)recover(data.session)}).catch(e=>console.error('Cockpit session bootstrap',e));
  db.auth.onAuthStateChange((event,session)=>{if(session&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION'))recover(session);if(event==='SIGNED_OUT'){if(app)app.classList.add('hidden');if(auth)auth.classList.remove('hidden');if(logout)logout.classList.add('hidden')}});
  const login=document.getElementById('login');
  if(login&&!login.dataset.waBound){
    login.dataset.waBound='1';
    login.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const email=(document.getElementById('email')?.value||'').trim(),password=document.getElementById('password')?.value||'';
      if(!email||!password){if(msg)msg.innerHTML='<span class="err">Saisissez votre e-mail et votre mot de passe.</span>';return}
      login.disabled=true;login.textContent='Connexion en cours…';
      try{const r=await db.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(!r.data?.session||!r.data?.user)throw new Error('Session de connexion non reçue.');reveal(r.data.session);try{if(typeof enter==='function')await enter(r.data.user)}catch(e2){console.error('Cockpit login secondary init',e2)}reveal(r.data.session);if(msg)msg.textContent=''}catch(e){console.error('Cockpit login',e);if(msg)msg.innerHTML='<span class="err">'+String(e.message||'Connexion impossible.').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</span>'}finally{login.disabled=false;login.textContent='Se connecter'}
    },true);
  }
  if(logout&&!logout.dataset.waBound){logout.dataset.waBound='1';logout.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();try{await db.auth.signOut()}finally{location.reload()}},true)}
}
const css='.wa-call-cta{margin:18px 0;padding:22px;border:1px solid rgba(242,184,75,.35);border-radius:18px;background:linear-gradient(135deg,rgba(242,184,75,.13),rgba(34,199,163,.08));box-shadow:0 12px 36px rgba(0,0,0,.16)}.wa-call-cta h2{margin:0 0 7px;font-size:22px}.wa-call-cta p{margin:0 0 14px;color:#98a5bb;line-height:1.55}.wa-call-cta .wa-call-actions{display:flex;gap:9px;flex-wrap:wrap}.wa-call-cta a{display:inline-flex;align-items:center;justify-content:center;padding:11px 15px;border-radius:11px;text-decoration:none;font-weight:850}.wa-call-primary{background:#f2b84b;color:#171208}.wa-call-secondary{border:1px solid #26334c;color:#fff;background:transparent}@media(max-width:600px){.wa-call-cta{padding:18px}.wa-call-cta .wa-call-actions a{width:100%}}';
function mount(){if(document.getElementById('waCallCta'))return;const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);const c=document.createElement('section');c.id='waCallCta';c.className='wa-call-cta';const cockpit=/Cockpit/i.test(document.title);c.innerHTML='<div style="font-size:12px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:#22c7a3;margin-bottom:7px">Communication WhatsAfrica</div><h2>📹 Appels vidéo</h2><p>'+(cockpit?'Appelez vos contacts directement depuis WhatsAfrica. Présentez un produit, négociez ou concluez une affaire en vidéo.':'Appelez, présentez, négociez et concluez en vidéo. La conversation peut maintenant devenir une rencontre directe.')+'</p><div class="wa-call-actions"><a class="wa-call-primary" href="/calls">📹 Appeler maintenant</a><a class="wa-call-secondary" href="/calls">Découvrir les appels vidéo</a></div>';const main=document.querySelector('main');if(!main)return;if(cockpit){const h1=main.querySelector('h1');if(h1&&h1.parentNode)h1.parentNode.insertBefore(c,h1.nextSibling);else main.prepend(c)}else{const hero=main.querySelector('.hero');const grid=main.querySelector('.grid');if(grid)grid.parentNode.insertBefore(c,grid);else if(hero)hero.appendChild(c);else main.prepend(c)}}
function boot(){cockpitNav();stabilizeCockpitAuth();mount()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();