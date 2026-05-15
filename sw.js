/* Kalkan Info — Service Worker (PWA)
   Cache-first stratejisi statik varlıklar için, network-first stratejisi data/*.json için.
   v1.6.0: HTML pre-cache kaldırıldı (Vercel cleanUrls 308 → redirected Response cache.put crash'ini önler).
   Versiyon güncellendiğinde eski cache temizlenir.
*/

const CACHE_VERSION = 'kalkan-info-v1.6.0-redirect-fix';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// HTML'ler pre-cache'te DEĞİL — cleanUrls ile 308 redirect olduğu için install fail eder.
// HTML'ler runtime'da, redirect-safe şekilde cache'lenir (fetch handler'da).
const STATIC_ASSETS = [
  './',
  './manifest.json',
  './dist/tw.css',
  './js/render.js',
  './js/pwa.js',
  './js/auth.js',
  './js/auth-pill.js',
  './js/site-drawer.js',
  './js/header-search.js',
  './js/bottom-nav.js',
  './js/newsletter.js',
  './js/villa-modal.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Redirected Response'ları cache'lenemez (cache.put TypeError atar).
// Body'yi clone'layıp yeni (redirected: false) Response paketleyerek güvenli kaydet.
async function safeCachePut(cacheName, req, res) {
  if (!res || !res.ok) return;
  if (res.type === 'opaque' || res.type === 'opaqueredirect') return;
  try {
    if (res.redirected) {
      const body = await res.clone().blob();
      const clean = new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });
      const cache = await caches.open(cacheName);
      await cache.put(req, clean);
    } else {
      const cache = await caches.open(cacheName);
      await cache.put(req, res.clone());
    }
  } catch (e) {
    // iOS PWA bazen quota / type hatasi atar — sessizce geç.
    console.warn('[SW] cache.put skipped:', req.url, e?.message);
  }
}

// Install — pre-cache statik varlıklar (her biri tek tek, biri fail etse digerleri eklensin)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] precache skipped:', url, err?.message))
        )
      ))
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
//   - HTML navigation → network-first (taze içerik), fallback to cache (offline)
//   - JS/CSS/img → cache-first, fallback to network
//   - Cross-origin (Unsplash, fonts) → network-first, runtime cache
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
          safeCachePut(DATA_CACHE, req, res);
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) HTML navigation (sayfa istekleri) — network-first
  //    iOS PWA'da cache-first + redirected Response = beyaz ekran. network-first taze içerik garanti eder.
  if (sameOrigin && (req.mode === 'navigate' || req.destination === 'document')) {
    event.respondWith(
      fetch(req, { redirect: 'follow' })
        .then(res => {
          safeCachePut(STATIC_CACHE, req, res);
          // Redirected response'u clone'layıp düz Response döndür (iOS PWA fix)
          if (res.redirected) {
            return res.clone().blob().then(body => new Response(body, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            }));
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./')))
    );
    return;
  }

  // 3) Same-origin static (JS/CSS/img) — cache-first
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        safeCachePut(STATIC_CACHE, req, res);
        return res;
      }).catch(() => caches.match('./')))
    );
    return;
  }

  // 4) Cross-origin (CDN, fonts) — network-first, runtime cache
  event.respondWith(
    fetch(req).then(res => {
      safeCachePut(RUNTIME_CACHE, req, res);
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
