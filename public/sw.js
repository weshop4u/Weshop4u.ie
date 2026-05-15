// WESHOP4U Service Worker - Basic PWA support
const CACHE_NAME = 'weshop4u-v1';

// Only cache essential static assets
const STATIC_ASSETS = [
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first strategy (always try network, fall back to cache)
// This ensures users always get fresh data from the API
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip all /api/trpc/ requests completely - never intercept tRPC calls
  if (event.request.url.includes('/api/trpc/')) {
    // Pass through to network without any service worker interference
    event.respondWith(fetch(event.request));
    return;
  }

  // Skip other API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && STATIC_ASSETS.some(asset => event.request.url.endsWith(asset))) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});
