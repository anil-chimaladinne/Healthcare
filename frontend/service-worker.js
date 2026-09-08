/**
 * SevaHealth - PWA Service Worker
 * Caches core application shell assets for offline rural use.
 */

const CACHE_NAME = "sevahealth-v1.0.0";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/dashboard.html",
  "/patient.html",
  "/doctor.html",
  "/referrals.html",
  "/followups.html",
  "/css/style.css",
  "/js/api.js",
  "/js/auth.js",
  "/js/i18n.js",
  "/js/offline.js",
  "/js/triage.js",
  "/js/dashboard.js",
  "/js/patient.js",
  "/manifest.json"
];

// Install Event: Cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching Application Shell");
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.warn("[Service Worker] Cache install notice:", err))
  );
  self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-first with offline cache fallback
self.addEventListener("fetch", (event) => {
  // Do not intercept API data requests with generic cache (API sync handled by IndexedDB)
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and update cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Offline fallback from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match("/dashboard.html");
          }
        });
      })
  );
});
