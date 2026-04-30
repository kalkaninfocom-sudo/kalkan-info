/* Kalkan Info — PWA Helper
   Service worker kayıt + install prompt yönetimi
*/

(() => {
  // Service Worker register
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          console.log('[PWA] SW registered:', reg.scope);
          // Yeni versiyon varsa kullanıcıya bildir
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateToast();
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW register failed:', err));
    });
  }

  // Install prompt — beforeinstallprompt yakala, custom buton göster
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  function showInstallButton() {
    if (document.getElementById('pwa-install-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.textContent = '📱 Uygulamayı Yükle';
    btn.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 60;
      background: #f4b53d; color: #0a2e4c; font-weight: 700;
      padding: 12px 18px; border: none; border-radius: 999px;
      box-shadow: 0 8px 24px -4px rgba(244,181,61,0.5);
      cursor: pointer; font-family: 'Montserrat', system-ui, sans-serif;
      font-size: 14px; transition: transform 120ms ease;
    `;
    btn.onmouseenter = () => btn.style.transform = 'translateY(-2px)';
    btn.onmouseleave = () => btn.style.transform = 'translateY(0)';
    btn.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      deferredPrompt = null;
      hideInstallButton();
    };
    document.body.appendChild(btn);
  }

  function hideInstallButton() {
    const el = document.getElementById('pwa-install-btn');
    if (el) el.remove();
  }

  function showUpdateToast() {
    if (document.getElementById('pwa-update-toast')) return;
    const t = document.createElement('div');
    t.id = 'pwa-update-toast';
    t.innerHTML = `
      <span>Yeni versiyon hazır.</span>
      <button onclick="location.reload()" style="margin-left:12px;background:#f4b53d;color:#0a2e4c;font-weight:700;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;">Yenile</button>
      <button onclick="this.parentElement.remove()" style="margin-left:6px;background:transparent;color:white;border:none;cursor:pointer;font-size:18px;">×</button>
    `;
    t.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; z-index: 70;
      background: #0a2e4c; color: white; padding: 12px 16px;
      border-radius: 10px; box-shadow: 0 8px 24px -4px rgba(7,33,54,0.5);
      font-family: 'Inter', system-ui, sans-serif; font-size: 14px;
      display: flex; align-items: center;
    `;
    document.body.appendChild(t);
  }

  // Admin link artık GİRİŞ YAP dropdown'ı içinde — bu floating pill devre dışı.
  // Eski "admin-link-btn" varsa temizle (cache'lenmiş sayfalar için).
  function removeLegacyAdminLink() {
    const old = document.getElementById('admin-link-btn');
    if (old) old.remove();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyAdminLink);
  } else {
    removeLegacyAdminLink();
  }

  // Online/offline indicator
  window.addEventListener('online', () => removeOfflineBar());
  window.addEventListener('offline', () => showOfflineBar());

  function showOfflineBar() {
    if (document.getElementById('pwa-offline-bar')) return;
    const b = document.createElement('div');
    b.id = 'pwa-offline-bar';
    b.textContent = '⚠️ Çevrimdışısınız — kayıtlı içerik gösteriliyor';
    b.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #c0392b; color: white; text-align: center;
      padding: 8px 12px; font-size: 13px; font-weight: 600;
    `;
    document.body.appendChild(b);
  }
  function removeOfflineBar() {
    const el = document.getElementById('pwa-offline-bar');
    if (el) el.remove();
  }
})();
