const CACHE='wassafrica-shell-v42';
const CACHE_PREFIX='wassafrica-shell-';
const CORE=["/","/launch-shell.html","/launch-v1.html","/launch-v2.html","/install","/install.html","/manifest.webmanifest","/manifesto","/manifesto.html","/icon-192.png","/icon-512.png","/wassafrica-logo.svg","/icon-192.svg","/icon-512.svg","/profile.html","/inbox.html","/groups.html","/community-v7.html","/group-admin-v1.html","/live.html","/calls-v1.html","/universe-fast-v4.html","/marche.html","/analytics-shell.html","/smartlink-free-v3.html","/smartlink-business.html","/smartlink-public.html","/share-center.html","/share.html","/financial-services-v2.html","/offer-create-v4.html","/crm.html","/brand-normalizer.js","/brand-observer.js","/wa-showcase-demo.js","/assets/product-presence.jpg","/assets/product-smartlink.jpg","/assets/product-vitrine.jpg","/assets/wassafrica-hero-showcase.svg","/assets/wassafrica-smartlink-realistic.svg","/assets/wassafrica-network-hero.webp","/assets/wassafrica-profile-realistic.svg","/wa-theme.js","/wa-i18n.js","/wa-accessibility.js","/wa-performance.js","/wa-network.js","/wa-message-outbox.js","/wa-message-cache.js","/e2ee.js","/wa-media.js","/wa-calls.js"];
const STATIC_EXT=/\\.(?:html|js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i;
const HTML_EXT=/\\.html$/i;
const SENSITIVE_PATH=/^\\/(?:api(?:\\/|$)|admin(?:[-/]|$)|cockpit(?:\\.html|\\/|$)|auth(?:\\.html|\\/|$)|dashboard(?:\\.html|\\/|$)|checkout(?:[-/]|\\.html|$)|orders?(?:\\.html|\\/|$)|cart(?:\\.html|\\/|$)|payment(?:[-/]|\\.html|$))/i;
function canCacheResponse(response){if(!response||!response.ok||response.type==='opaque')return false;const cc=(response.headers.get('Cache-Control')||'').toLowerCase();return !/(?:private|no-store|no-cache)/.test(cc);}
function safeNavigation(url){return !url.search && !SENSITIVE_PATH.test(url.pathname);}
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.filter(u=>!SENSITIVE_PATH.test(new URL(u,self.location.origin).pathname)).map(u=>c.add(new Request(u,{cache:'reload'}))))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const r=event.request;
 if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
 const url=new URL(r.url),pathname=url.pathname;
 if(pathname.startsWith('/api/'))return;
 if(r.mode==='navigate'){
  event.respondWith(fetch(r,{cache:'no-store'}).then(res=>{
   if(safeNavigation(url)&&canCacheResponse(res)){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});}
   return res;
  }).catch(()=>caches.match('/launch-shell.html')));
  return;
 }
 if(!STATIC_EXT.test(pathname)||url.search||SENSITIVE_PATH.test(pathname))return;
 if(HTML_EXT.test(pathname)){
  event.respondWith(fetch(r,{cache:'no-store'}).then(res=>{
   if(canCacheResponse(res)){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});}
   return res;
  }).catch(()=>caches.match(r)));
  return;
 }
 event.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(res=>{
  if(canCacheResponse(res)){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});}
  return res;
 }).catch(()=>cached)));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=event.notification.data&&event.notification.data.url?event.notification.data.url:'/inbox';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){return client.navigate(url).then(()=>client.focus()).catch(()=>client.focus())}}return clients.openWindow(url);}));});
self.addEventListener('sync',event=>{if(event.tag==='wassafrica-message-outbox'||event.tag==='wassafrica-media-outbox'){const type=event.tag==='wassafrica-media-outbox'?'wassafrica:flush-media-outbox':'wassafrica:flush-message-outbox';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>Promise.all(list.map(c=>c.postMessage({type})))).catch(()=>{}));}});
