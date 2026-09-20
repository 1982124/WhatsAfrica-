/* WassAfrica — messaging mobile-first navigation polish v1 */
(function(){
  'use strict';
  function ready(fn){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true}); else fn(); }
  ready(function(){
    const app=document.getElementById('app'), chat=document.querySelector('.chat'), sidebar=document.querySelector('.sidebar'), top=document.querySelector('.chat-top');
    if(!app||!chat||!sidebar||!top)return;
    const style=document.createElement('style');
    style.textContent=`
      @media(max-width:820px){
        #app.wa-chat-open .sidebar{display:none!important}
        #app.wa-chat-open .chat{display:flex!important;grid-row:1/-1;height:100%!important}
        #app.wa-chat-open .chat-top{position:sticky;top:0;z-index:12;background:#fff}
        .wa-mobile-back{display:inline-grid;place-items:center;width:40px;height:40px;flex:0 0 40px;border:1px solid #dce6e0;border-radius:12px;background:#fff;font-size:20px;cursor:pointer}
        .wa-mobile-back:active{transform:scale(.97)}
        #body{font-size:16px}
      }
      @media(min-width:821px){.wa-mobile-back{display:none!important}}
    `;
    document.head.appendChild(style);
    const back=document.createElement('button');
    back.type='button'; back.className='wa-mobile-back'; back.setAttribute('aria-label','Retour aux conversations'); back.title='Retour aux conversations'; back.textContent='‹';
    top.insertBefore(back,top.firstChild);
    const isMobile=()=>window.matchMedia('(max-width:820px)').matches;
    const setOpen=open=>{
      if(!isMobile()) {app.classList.remove('wa-chat-open');return;}
      app.classList.toggle('wa-chat-open',!!open);
      if(open) setTimeout(()=>document.getElementById('body')?.focus({preventScroll:true}),120);
    };
    back.addEventListener('click',()=>setOpen(false));
    document.addEventListener('wa:conversation-selected',()=>setOpen(true));
    window.addEventListener('resize',()=>{if(!isMobile())app.classList.remove('wa-chat-open')});
    window.addEventListener('popstate',()=>setOpen(false));
    document.addEventListener('wa:inbox-ready',()=>{
      const input=document.getElementById('target');
      if(input) input.setAttribute('aria-label','Rechercher une personne ou démarrer une conversation');
    });
  });
})();