var CACHE_NAME = "whatsafrica-v2";
var URLS_TO_CACHE = ["./", "./app-v2.html", "./manifest.json"];
self.addEventListener("install", function(event){event.waitUntil(caches.open(CACHE_NAME).then(function(cache){return cache.addAll(URLS_TO_CACHE);}));self.skipWaiting();});
self.addEventListener("activate", function(event){event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){return key!==CACHE_NAME;}).map(function(key){return caches.delete(key);}));}));self.clients.claim();});
self.addEventListener("fetch", function(event){if(event.request.method!=="GET")return;event.respondWith(caches.match(event.request).then(function(cached){if(cached)return cached;return fetch(event.request).then(function(response){if(response.ok){caches.open(CACHE_NAME).then(function(cache){cache.put(event.request,response.clone());});}return response;}).catch(function(){return caches.match("./app-v2.html");});}));});
