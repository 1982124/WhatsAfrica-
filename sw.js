const CACHE='wassafrica-shell-v24';
const CORE=[
  '/',
  '/launch-shell.html',
  '/launch-v2.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
  '/brand-normalizer.js',
  '/brand-observer.js'
];
const STATIC_EXT=/\.(?:html|js|css|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i;
const HTML_EXT=/\.html$/i;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'}))).catch(()=>{})).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;const pathname=new URL(r.url).pathname;if(pathname.startsWith('/api/'))return;
if(r.mode==='navigate'){event.respondWith(fetch(r,{cache:'no-store'}).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});}return res;}).catch(()=>caches.match(r).then(cached=>cached||caches.match('/launch-shell.html'))));return;}
if(!STATIC_EXT.test(pathname))return;
if(HTML_EXT.test(pathname)){event.respondWith(fetch(r,{cache:'no-store'}).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});}return res;}).catch(()=>caches.match(r)));return;}
event.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});}return res;}).catch(()=>cached)));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=event.notification.data&&event.notification.data.url?event.notification.data.url:'/inbox';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){return client.navigate(url).then(()=>client.focus()).catch(()=>client.focus())}}return clients.openWindow(url);}));});
self.addEventListener('sync',event=>{if(event.tag==='wassafrica-message-outbox'||event.tag==='wassafrica-media-outbox'){const type=event.tag==='wassafrica-media-outbox'?'wassafrica:flush-media-outbox':'wassafrica:flush-message-outbox';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>Promise.all(list.map(c=>c.postMessage({type})))).catch(()=>{}));}});
