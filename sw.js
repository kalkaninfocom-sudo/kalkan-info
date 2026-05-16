/* Kalkan Info — Service Worker (KILL SWITCH MODU)
   Sürekli cache sorunu çözmek için: bu yeni SW yüklendiğinde
   kendini unregister eder, tüm cache'leri temizler ve açık tüm tabları
   yeniler. Sonrasında SW kayıt OLMAZ — site her zaman taze içerik yükler.
   v2.0.0-killswitch — 2026-05-16
*/

const CACHE_VERSION = 'kalkan-info-killswitch-2.0.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Tüm cache'leri sil
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* noop */ }

    // 2. Bu SW'yi unregister et
    try { await self.registration.unregister(); } catch (e) { /* noop */ }

    // 3. Tüm açık tabları yeniden yükle (kontrolü devral, postMessage)
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try {
        client.postMessage({ type: 'SW_KILLSWITCH', version: CACHE_VERSION });
        // navigate ile force reload (no-cache)
        if ('navigate' in client) {
          client.navigate(client.url);
        }
      } catch (e) { /* noop */ }
    }
  })());
});

// Fetch — her şey network'ten gelsin, SW'yi atla
self.addEventListener('fetch', (event) => {
  // Hiç müdahale etme — browser direkt network'e gitsin
  return;
});
