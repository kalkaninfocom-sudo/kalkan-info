/* Kalkan Info — Service Worker MINIMAL KILL SWITCH
   No client.navigate() — sonsuz reload döngüsünü kırar.
   Sadece sessizce kendini unregister eder + cache'leri temizler.
   v3.0.0-silent-kill — 2026-05-23
*/

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    // NOT navigating clients — clients.navigate() infinite-reload loop'a giriyordu.
  })());
});

self.addEventListener('fetch', () => {});
