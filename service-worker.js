const CACHE_NAME = "tajirox-v12";

const urlsToCache = [
  "./",
  "./index.htm",
  "./manifest.json?v=2026_v4",
  "./favicon.png",
  "./favicon-32x32.png",
  "./favicon-48x48.png",
  "./favicon-96x96.png",
  "./favicon-144x144.png",
  "./icon-192.png",
  "./icon-512.png",
  "./css/style.css?v=2026_v3",
  "./js/security.js?v=2026_v3",
  "./js/api.js?v=2026_v3",
  "./translations.js"
];

// Install Event
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("🎒 [Service Worker] Caching app shell assets...");
        // Use addAll with map or try individually to prevent failure if one file is missing
        return cache.addAll(urlsToCache).catch(err => {
          console.warn("⚠️ [Service Worker] Some non-critical files failed to cache during install:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log("🧹 [Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Cache-First or Network-Fallbacks)
self.addEventListener("fetch", event => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;

  // Skip caching for external APIs (like Google Apps Script execution, sheets API etc.)
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    // Let the network handle external APIs directly without caching
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }) // ignoreSearch: true is awesome for matching query parameters like ?v=...
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache, but fetch fresh in background for static pages
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          }).catch(() => {/* Ignore offline errors in bg fetch */});

          return cachedResponse;
        }

        // Fetch from network otherwise
        return fetch(event.request).then(response => {
          // Cache successful responses for future offline use
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      }).catch(() => {
        // Fallback for document fetch failures (offline)
        if (event.request.headers.get("accept").includes("text/html")) {
          return caches.match("./index.htm");
        }
      })
  );
});
