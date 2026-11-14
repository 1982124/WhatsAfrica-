const CACHE='wassafrica-shell-v42';
const CACHE_PREFIX='wassafrica-shell-';
const CORE=['/','/launch-shell.html','/launch-v1.html','/launch-v2.html','/install','/install.html','/manifest.webmanifest','/manifesto','/manifesto.html','/icon-192.png','/icon-512.png','/wassafrica-logo.svg','/icon-192.svg','/icon-512.svg','/universe-fast-v4.html','/smartlink-public.html','/brand-normalizer.js','/brand-observer.js','/wa-showcase-demo.js','/assets/product-presence.jpg','/assets/product-smartlink.jpg','/assets/product-vitrine.jpg','/assets/wassafrica-hero-showcase.svg','/assets/wassafrica-smartlink-realistic.svg','/assets/wassafrica-network-hero.webp','/assets/wassafrica-profile-realistic.svg','/wa-theme.js','/wa-i18n.js','/wa-accessibility.js','/wa-performance.js','/wa-network.js'];
const STATIC_EXT=/\.(?:html|js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i;
const HTML_EXT=/\.html$/i;
const SENSITIVE_PATH=/^\/(?:api(?:\/|$)|(?:auth|profile|inbox|messages|messagerie|messaging|chat|dashboard|analytics|cockpit|admin(?:-[^/]+)?|radar|crm|group-admin(?:-v\d+)?|group-manager|groups|community|cart|checkout(?:-group)?|orders|commande|payments?|payment-links|finance|financial-services(?:-v\d+)?|account-security|forgot-password|reset-password|confirm-email|message-invite|invite|share(?:-center)?|s)(?:\/|\.|$)|(?:s|commande)\/)/i;
function isSensitive(url){return Boolean(url.search)||SENSITIVE_PATH.test(url.pathname);}
function isCacheableResponse(response){
  if(!response||!response.ok||response.headers.has('set-cookie'))return false;
  const policy=response.headers.get('cache-control')||'';
  return !/(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(policy);
}
async function cacheCore(){
  const cache=await caches.open(CACHE);
  await Promise.allSettled(CORE.map(async path=>{
    const request=new Request(path,{cache:'reload'});
    const response=await fetch(request);
    if(isCacheableResponse(response))await cache.put(request,response);
  }));
}
self.addEventListener('install',event=>{event.waitUntil(cacheCore().then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||!request.url.startsWith(self.location.origin))return;
  const url=new URL(request.url);
  const pathname=url.pathname;
  if(isSensitive(url))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(isCacheableResponse(response))caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>caches.match(request).then(cached=>cached||caches.match('/launch-shell.html'))));
    return;
  }
  if(!STATIC_EXT.test(pathname))return;
  if(HTML_EXT.test(pathname)){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(isCacheableResponse(response))caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(isCacheableResponse(response))caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{});
    return response;
  }).catch(()=>cached)));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=event.notification.data&&event.notification.data.url?event.notification.data.url:'/inbox';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){return client.navigate(url).then(()=>client.focus()).catch(()=>client.focus())}}return clients.openWindow(url);}));});
self.addEventListener('sync',event=>{if(event.tag==='wassafrica-message-outbox'||event.tag==='wassafrica-media-outbox'){const type=event.tag==='wassafrica-media-outbox'?'wassafrica:flush-media-outbox':'wassafrica:flush-message-outbox';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>Promise.all(list.map(client=>client.postMessage({type})))).catch(()=>{}));}});
