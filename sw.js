/* Kalkan Info — Service Worker (PURE SELF-DESTRUCT, NO RELOAD LOOP)
   2026-05-22 — v3.0.0-purekill
   Önceki kill-switch'te activate event'inde client.navigate(client.url)
   sonsuz reload loop'a yol açıyordu. Bu sürüm sadece kendini unregister
   eder ve cache'leri siler — navigate YOK. Browser SW update check'te
   /sw.js'e gider, Vercel'in Clear-Site-Data header'ı her şeyi temizler.
*/

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try {
      await self.registration.unregister();
    } catch (_) {}
    // NO client.navigate — sonsuz reload loop yapıyordu.
    // Kullanıcı kendi reload edince temiz başlar.
  })());
});

self.addEventListener('fetch', () => {
  // Hiç fetch'e karışma — browser direkt network'e gitsin.
  return;
});
