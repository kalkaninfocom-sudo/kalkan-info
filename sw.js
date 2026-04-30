/* Kalkan Info — Service Worker (PWA)
   Cache-first stratejisi statik varlıklar için, network-first stratejisi data/*.json için.
   Versiyon güncellendiğinde eski cache temizlenir.
*/

const CACHE_VERSION = 'kalkan-info-v1.0.6';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './plajlar.html',
  './villalar.html',
  './turlar.html',
  './restoranlar.html',
  './hizmetler.html',
  './haberler.html',
  './antik-kentler.html',
  './admin.html',
  './manifest.json',
  './js/render.js',
  './js/pwa.js',
  './admin/admin.js',
  './data/plajlar.json',
  './data/villalar.json',
  './data/turlar.json',
  './data/restoranlar.json',
  './data/hizmetler.json',
  './data/haberler.json',
  './data/antik-kentler.json',
  './data/config.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install — pre-cache statik varlıklar
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] Install partial:', err)))
      .then(() => self.skipWaiting())
  );
});

// Activate — eski cache'leri temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — strateji:
//   - data/*.json → network-first, fallback to cache
//   - HTML/JS/CSS/img → cache-first, fallback to network
//   - Cross-origin (Unsplash, fonts) → runtime cache (network-first)
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) Data JSON — network-first
  if (sameOrigin && url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) Same-origin static — cache-first
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // 3) Cross-origin (CDN, Unsplash, fonts) — network-first, runtime cache
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});

// Mesaj — manuel cache temizleme
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
