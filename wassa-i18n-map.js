(()=>{
 const map={
  '.nav a:nth-child(1)':'messages','.nav a:nth-child(2)':'home','.nav a:nth-child(3)':'explore','.nav a:nth-child(4)':'groups','.nav a:nth-child(5)':'market','.nav a:nth-child(6)':'me',
  '.hero .ey':'eyebrow','.hero h1':'h1b','.hero p':'hero','.actions a:nth-child(1)':'open','.actions a:nth-child(2)':'discover','.actions a:nth-child(3)':'start',
  '.quick a:nth-child(1) strong':'myMessages','.quick a:nth-child(1) span':'messagesDesc','.quick a:nth-child(2) strong':'marketTitle','.quick a:nth-child(2) span':'marketDesc','.quick a:nth-child(3) strong':'exploreTitle','.quick a:nth-child(3) span':'exploreDesc','.quick a:nth-child(4) strong':'identity','.quick a:nth-child(4) span':'identityDesc',
  '.section:nth-of-type(1) .title h2':'what','.section:nth-of-type(1) .title p':'whatDesc',
  '.story a:nth-child(1) .story-copy strong':'create','.story a:nth-child(1) .story-copy span':'createDesc','.story a:nth-child(2) .story-copy strong':'develop','.story a:nth-child(2) .story-copy span':'developDesc','.story a:nth-child(3) .story-copy strong':'collab','.story a:nth-child(3) .story-copy span':'collabDesc',
  '.world .ey':'worldEyebrow','.world h2':'worldTitle','.world p':'worldDesc',
  '.final h2':'finalTitle','.final p':'finalDesc','.final .actions a:nth-child(1)':'openMessaging','.final .actions a:nth-child(2)':'discoverMarket',
  '.footer a:nth-child(1)':'privacy','.footer a:nth-child(2)':'terms','.footer a:nth-child(3)':'seller'
 };
 function tag(){Object.entries(map).forEach(([sel,key])=>document.querySelectorAll(sel).forEach(el=>el.setAttribute('data-wassa',key)));if(window.WASSAFRICA_I18N)window.WASSAFRICA_I18N.setLang(window.WASSAFRICA_I18N.getLang());}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tag);else tag();
})();