// ===== SERVICE WORKER — Comércio BES =====
const CACHE_NAME = 'comercio-bes-v8';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/modules/state.js',
  './js/modules/utils.js',
  './js/modules/api.js',
  './js/modules/auth.js',
  './js/modules/cart.js',
  './js/modules/favorites.js',
  './js/modules/orders.js',
  './js/modules/merchants.js',
  './js/modules/theme.js',
  './js/modules/ui.js',
  './js/modules/map.js',
  './js/modules/search.js',
  './js/modules/auth-ui.js',
  './js/modules/checkout.js',
  './js/modules/merchant-ui.js',
  './js/render/promotions.js',
  './js/render/cards.js',
  './js/render/favorites.js',
  './js/render/orders-ui.js',
  './js/render/modal.js',
  './data/data.json',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap'
];

// Install — cache shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for data, cache-first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin (except fonts/tiles)
  if (event.request.method !== 'GET') return;

  // Network-first for data.json (always try fresh data)
  if (url.pathname.endsWith('/data.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache same-origin and fonts
        if (response.ok && (url.origin === self.location.origin || url.hostname.includes('googleapis') || url.hostname.includes('gstatic'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
