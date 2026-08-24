/* Kalkan Info — PWA Helper v3
   Service worker kayıt + install prompt (Android/Chrome + iOS Safari)
   Dismiss 7 gün localStorage, standalone guard, idempotent mount
*/

if (window.__kalkan_install_mounted) { /* already loaded */ }
else {
window.__kalkan_install_mounted = true;

(() => {
  // ── Helpers ──────────────────────────────────────────────────────────────
  const DISMISS_KEY = 'kalkan_install_dismissed';
  const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days ms

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function isDismissed() {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_TTL;
  }

  function setDismissed() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  // ── Service Worker — KAYIT DEVRE DIŞI 2026-05-23 ─────────────────────────
  // Eski sw.js kill-switch içinde clients.navigate() vardı, sayfa render'da
  // sonsuz reload döngüsü oluşuyordu. Şimdi: register YAPMA, mevcut SW'leri
  // unregister et + cache'leri sil.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(reg => reg.unregister().catch(() => {})))
      .catch(() => {});
    if (window.caches) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }

    // SW yeni cache version'a geçince otomatik reload (1 kez)
    let reloaded = false;
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'SW_UPDATED' && !reloaded) {
        reloaded = true;
        console.log('[PWA] SW updated to', e.data.version, '— reloading');
        setTimeout(() => location.reload(), 300);
      }
    });
  }

  // ── Auth pages: never show install prompt on login / register / profil ───
  function isAuthPage() {
    var p = location.pathname.split('/').pop() || '';
    return /^(login|register|profil)\.html$/i.test(p);
  }

  // ── Consent check: don't show until user has accepted/rejected consent ───
  function hasConsent() {
    try { return !!localStorage.getItem('ki-consent-v1'); } catch(e) { return false; }
  }

  // ── Show install only after consent resolved + 30s engagement ────────────
  function maybeShowInstall(showFn) {
    if (isAuthPage() || isStandalone() || isDismissed()) return;
    if (hasConsent()) {
      // Consent already given: wait 30s engagement before prompting
      setTimeout(showFn, 30000);
    } else {
      // Consent pending: wait for it to resolve, then wait another 30s
      var resolved = false;
      function onConsent() {
        if (resolved) return;
        resolved = true;
        document.removeEventListener('ki-consent-resolved', onConsent);
        setTimeout(showFn, 30000);
      }
      document.addEventListener('ki-consent-resolved', onConsent);
      // Fallback: if consent event never fires (e.g. dismissed via X), check after 60s
      setTimeout(function() {
        if (!resolved && hasConsent()) onConsent();
      }, 60000);
    }
  }

  // ── Android / Chrome — beforeinstallprompt ────────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    maybeShowInstall(showInstallBanner);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeInstallBanner();
  });

  // ── iOS Safari — show instructions if not standalone ─────────────────────
  if (isIOS() && !isAuthPage() && !isStandalone() && !isDismissed()) {
    // Delay until DOM ready then gate behind consent + engagement
    window.addEventListener('DOMContentLoaded', () => {
      maybeShowInstall(showIOSBanner);
    });
  }

  // Also support ?showInstall=true for testing
  if (new URLSearchParams(location.search).get('showInstall') === 'true') {
    window.addEventListener('DOMContentLoaded', () => {
      if (isIOS()) showIOSBanner();
      else showInstallBanner(true); // force=true ignores dismiss state
    });
  }

  // ── Android install banner ────────────────────────────────────────────────
  function showInstallBanner(force) {
    if (document.getElementById('kalkan-install-banner')) return;
    if (!force && (isStandalone() || isDismissed())) return;

    const banner = document.createElement('div');
    banner.id = 'kalkan-install-banner';
    banner.setAttribute('role', 'banner');
    banner.style.cssText = [
      'position:fixed',
      'bottom:64px', // above bottom-nav (56px) + gap
      'left:12px',
      'right:12px',
      'z-index:9999',
      'background:linear-gradient(135deg,#1E2B3C 0%,#16243A 100%)',
      'border:1.5px solid rgba(74,158,245,0.35)',
      'border-radius:14px',
      'padding:14px 16px',
      'display:flex',
      'align-items:center',
      'gap:12px',
      'box-shadow:0 8px 32px -4px rgba(7,20,40,0.55),0 0 0 1px rgba(74,158,245,0.1)',
      'font-family:Inter,system-ui,sans-serif',
      'animation:kalkan-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
    ].join(';');

    banner.innerHTML = `
      <style>
        @keyframes kalkan-slide-up {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
      </style>
      <div style="flex-shrink:0;width:42px;height:42px;background:rgba(232,152,18,0.14);border-radius:10px;display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A9EF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L12 15M12 15L8 11M12 15L16 11"/><rect x="3" y="17" width="18" height="4" rx="2"/>
        </svg>
      </div>
      <div style="flex:1;min-width:0;">
        <p style="margin:0;color:#fff;font-weight:700;font-size:13px;font-family:Montserrat,system-ui,sans-serif;letter-spacing:-0.01em;">Uygulamayı Yükle</p>
        <p style="margin:2px 0 0;color:rgba(220,230,239,0.75);font-size:11px;line-height:1.4;">Ana ekrana ekle, daha hızlı aç</p>
      </div>
      <button id="kalkan-install-btn" style="
        flex-shrink:0;background:#c97b09;color:#fff;font-family:Montserrat,system-ui,sans-serif;
        font-weight:700;font-size:12px;padding:8px 14px;border:none;border-radius:8px;
        cursor:pointer;transition:background 0.15s,transform 0.12s;white-space:nowrap;
      ">Yükle</button>
      <button id="kalkan-install-close" aria-label="Kapat" style="
        flex-shrink:0;background:transparent;color:rgba(220,230,239,0.5);border:none;
        cursor:pointer;font-size:20px;line-height:1;padding:4px;transition:color 0.15s;
      ">×</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('kalkan-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      removeInstallBanner();
    });

    document.getElementById('kalkan-install-close').addEventListener('click', () => {
      setDismissed();
      removeInstallBanner();
    });

    // Hover effects
    const installBtn = document.getElementById('kalkan-install-btn');
    installBtn.addEventListener('mouseenter', () => { installBtn.style.background = '#2b82d9'; installBtn.style.transform = 'translateY(-1px)'; });
    installBtn.addEventListener('mouseleave', () => { installBtn.style.background = '#4A9EF5'; installBtn.style.transform = 'translateY(0)'; });
  }

  function removeInstallBanner() {
    const el = document.getElementById('kalkan-install-banner');
    if (el) el.remove();
  }

  // ── iOS Safari instruction banner ─────────────────────────────────────────
  function showIOSBanner(force) {
    if (document.getElementById('kalkan-ios-banner')) return;
    if (!force && (isStandalone() || isDismissed())) return;

    const banner = document.createElement('div');
    banner.id = 'kalkan-ios-banner';
    banner.style.cssText = [
      'position:fixed',
      'bottom:64px',
      'left:12px',
      'right:12px',
      'z-index:9999',
      'background:linear-gradient(135deg,#1E2B3C 0%,#16243A 100%)',
      'border:1.5px solid rgba(74,158,245,0.35)',
      'border-radius:14px',
      'padding:14px 16px',
      'box-shadow:0 8px 32px -4px rgba(7,20,40,0.55)',
      'font-family:Inter,system-ui,sans-serif',
      'animation:kalkan-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
    ].join(';');

    banner.innerHTML = `
      <style>
        @keyframes kalkan-slide-up {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
      </style>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
        <p style="margin:0;color:#fff;font-weight:700;font-size:13px;font-family:Montserrat,system-ui,sans-serif;">Ana Ekrana Ekle</p>
        <button id="kalkan-ios-close" aria-label="Kapat" style="background:transparent;color:rgba(220,230,239,0.5);border:none;cursor:pointer;font-size:20px;line-height:1;padding:0 0 0 8px;">×</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;color:rgba(220,230,239,0.85);font-size:12px;line-height:1.5;">
          <span style="color:#4A9EF5;font-size:16px;">①</span>
          <span>Safari alt çubuğundaki</span>
          <!-- Share icon -->
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A9EF5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          <span><strong style="color:#fff;">Paylaş</strong> ikonuna dokun</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;color:rgba(220,230,239,0.85);font-size:12px;line-height:1.5;margin-bottom:4px;">
        <span style="color:#4A9EF5;font-size:16px;">②</span>
        <span>Menüden <strong style="color:#fff;">"Ana Ekrana Ekle"</strong> seç</span>
        <!-- Plus-square icon -->
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4A9EF5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('kalkan-ios-close').addEventListener('click', () => {
      setDismissed();
      banner.remove();
    });
  }

  // ── Update toast ──────────────────────────────────────────────────────────
  function showUpdateToast() {
    if (document.getElementById('pwa-update-toast')) return;
    const t = document.createElement('div');
    t.id = 'pwa-update-toast';
    t.innerHTML = `
      <span>Yeni versiyon hazır.</span>
      <button onclick="location.reload()" style="margin-left:12px;background:#f4b53d;color:#0a2e4c;font-weight:700;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;">Yenile</button>
      <button onclick="this.parentElement.remove()" style="margin-left:6px;background:transparent;color:white;border:none;cursor:pointer;font-size:18px;">×</button>
    `;
    t.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'left:20px',
      'z-index:9998',
      'background:#16243A',
      'color:white',
      'padding:12px 16px',
      'border-radius:10px',
      'box-shadow:0 8px 24px -4px rgba(7,33,54,0.5)',
      'font-family:Inter,system-ui,sans-serif',
      'font-size:14px',
      'display:flex',
      'align-items:center',
    ].join(';');
    document.body.appendChild(t);
  }

  // ── Online/offline bar ────────────────────────────────────────────────────
  window.addEventListener('online',  () => { const el = document.getElementById('pwa-offline-bar'); if (el) el.remove(); });
  window.addEventListener('offline', () => {
    if (document.getElementById('pwa-offline-bar')) return;
    const b = document.createElement('div');
    b.id = 'pwa-offline-bar';
    b.textContent = '⚠️ Çevrimdışısınız — kayıtlı içerik gösteriliyor';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:#c0392b;color:white;text-align:center;padding:8px 12px;font-size:13px;font-weight:600;';
    document.body.appendChild(b);
  });

  // ── Legacy admin link cleanup ─────────────────────────────────────────────
  function removeLegacyAdminLink() {
    const old = document.getElementById('admin-link-btn');
    if (old) old.remove();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyAdminLink);
  } else {
    removeLegacyAdminLink();
  }

})();
} // end mount guard
