/**
 * SevaHealth - PWA Service Worker
 * Caches core application shell assets for offline rural use.
 */

const CACHE_NAME = "sevahealth-v4.0.0-role-nav";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/dashboard.html",
  "/patient.html",
  "/doctor.html",
  "/specialist.html",
  "/referrals.html",
  "/followups.html",
  "/css/style.css?v=4.0.0",
  "/images/login-bg.jpg",
  "/images/header-banner.jpg?v=4.0.0",
  "/js/api.js?v=4.0.0",
  "/js/auth.js?v=4.0.0",
  "/js/i18n.js?v=4.0.0",
  "/js/offline.js?v=4.0.0",
  "/js/triage.js?v=4.0.0",
  "/js/dashboard.js?v=4.0.0",
  "/js/patient.js?v=4.0.0",
  "/js/doctor.js?v=4.0.0",
  "/js/specialist.js?v=4.0.0",
  "/js/referrals.js?v=4.0.0",
  "/js/followups.js?v=4.0.0",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/icon.svg",
  "/icons/favicon.ico"
];

// Skip waiting message listener
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Install Event: Cache app shell immediately and force activation
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching New Application Shell Assets v3.9.5");
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch((err) => console.warn("[Service Worker] Cache install notice:", err))
  );
});

// Activate Event: Cleanup ALL old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Purging old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first with offline cache fallback
self.addEventListener("fetch", (event) => {
  // Do not intercept API data requests with generic cache (API sync handled by IndexedDB)
  if (event.request.url.includes("/api/")) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, clone and update cache
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback from cache
        const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
        if (cachedResponse) {
          return cachedResponse;
        }

        const acceptHeader = event.request.headers ? event.request.headers.get("accept") : null;
        if (acceptHeader && acceptHeader.includes("text/html")) {
          // Check if URL matches a known page
          const url = new URL(event.request.url);
          const pathname = url.pathname;
          
          if (pathname.includes("doctor")) return caches.match("/doctor.html");
          if (pathname.includes("specialist")) return caches.match("/specialist.html");
          if (pathname.includes("patient")) return caches.match("/patient.html");
          if (pathname.includes("referrals")) return caches.match("/referrals.html");
          if (pathname.includes("followups")) return caches.match("/followups.html");
          if (pathname.includes("login")) return caches.match("/login.html");
          
          return caches.match("/dashboard.html") || caches.match("/index.html");
        }

        return new Response("Offline resource unavailable", {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "Content-Type": "text/plain" })
        });
      })
  );
});
