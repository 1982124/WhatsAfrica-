var CACHE_NAME = "whatsafrica-v6";
var APP_SHELL = ["./app-v5.html", "./manifest.json"];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(key) {
        return key !== CACHE_NAME;
      }).map(function(key) {
        return caches.delete(key);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;

  var url = new URL(event.request.url);

  // Never serve the HTML entry point from an old service-worker cache.
  // This prevents stale deployments from masking the current Vercel production build.
  if (url.pathname === "/" || url.pathname.endsWith("/app-v5.html")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(function() {
        return caches.match("./app-v5.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      });
    })
  );
});
