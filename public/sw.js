/* Mahaffeys offline app-shell service worker.
 *
 * Strategy:
 *  - Precache the app shell so the login/dashboard loads with zero network.
 *  - Navigations: network-first, falling back to the cached shell (offline yard).
 *  - Static assets (hashed JS/CSS/images): cache-first.
 *  - API calls: always network — data must never be served stale from a cache;
 *    the app's own offline queue handles writes while disconnected.
 */

const CACHE_NAME = "mahaffeys-shell-v1";
const SHELL_URLS = ["/", "/index.html", "/manifest.json", "/mahaffeys-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin requests; cross-origin (OCR CDN, etc.) pass through.
  if (url.origin !== self.location.origin) return;

  // API traffic is never cached — serve a clean 503 when the network is down
  // so the client's offline queue and sync layer take over.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // Page navigations: try the network first, fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/index.html"))
        )
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
