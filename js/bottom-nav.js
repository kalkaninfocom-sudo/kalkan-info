/**
 * bottom-nav.js — Tüm sayfalarda altta sabit navbar
 * - Eski floating butonları gizler (#ki-auth-details, #concierge, #pwa-install-btn)
 * - 4 ana eylem: Anasayfa, Ara, Concierge (WhatsApp), Giriş/Profil
 * - PWA install mevcutsa üstte "Uygulamayı Yükle" mini şerit
 * - Auth state değişince Profil'e dönüşür
 * - Mobile-first: tam genişlik, ikon+etiket; desktop'ta max 640px ortalı
 */

(function () {
  'use strict';

  const WHATSAPP = 'https://wa.me/905306650794?text=Merhaba+Kalkan+Info';

  // --- Inject styles & DOM ---
  function _ensureStyles() {
    if (document.getElementById('ki-bottomnav-styles')) return;
    const css = `
      /* Eski floating elementleri gizle */
      #ki-auth-details, #pwa-install-btn { display: none !important; }
      #concierge { display: none !important; }

      /* Body altına padding — içerik bar arkasına gizlenmesin */
      body { padding-bottom: env(safe-area-inset-bottom, 0px); }
      body.ki-bn-active { padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px)); }

      /* Bar */
      #ki-bn {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 9990;
        background: rgba(255,255,255,0.98); backdrop-filter: blur(10px);
        border-top: 1px solid #cfdfee;
        box-shadow: 0 -4px 20px rgba(7,33,54,0.08);
        padding-bottom: env(safe-area-inset-bottom, 0px);
        font-family: 'Inter', system-ui, sans-serif;
      }
      #ki-bn-inner {
        max-width: 640px; margin: 0 auto;
        display: grid; grid-template-columns: repeat(4, 1fr);
        height: 64px;
      }
      .ki-bn-item {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 3px; padding: 6px 4px; min-width: 0;
        background: transparent; border: 0; cursor: pointer;
        color: #5d97c4; font-size: 11px; font-weight: 600;
        text-decoration: none;
        transition: color .15s ease;
        position: relative;
      }
      .ki-bn-item:hover, .ki-bn-item.active { color: #0a2e4c; }
      .ki-bn-item .ki-bn-icon {
        font-size: 22px; line-height: 1;
        transition: transform .18s ease;
      }
      .ki-bn-item:hover .ki-bn-icon, .ki-bn-item.active .ki-bn-icon { transform: translateY(-2px); }
      .ki-bn-item.active::before {
        content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
        width: 28px; height: 3px; background: #1a5e93; border-radius: 0 0 3px 3px;
      }
      .ki-bn-item .ki-bn-label {
        max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .ki-bn-item.cta { color: #25D366; }
      .ki-bn-item.cta .ki-bn-icon { color: #25D366; }

      /* Install — küçük floating dairesel ikon (sağ alt, bar üstünde) */
      #ki-bn-install {
        position: fixed; right: 14px; z-index: 9991;
        bottom: calc(76px + env(safe-area-inset-bottom, 0px));
        width: 44px; height: 44px; border-radius: 9999px;
        background: linear-gradient(135deg, #f4b53d, #e89812);
        color: #0a2e4c;
        display: none; align-items: center; justify-content: center;
        box-shadow: 0 4px 14px -2px rgba(232,152,18,0.5), 0 2px 6px rgba(7,33,54,0.15);
        cursor: pointer; border: 0;
        font-size: 20px; line-height: 1;
        transition: transform .18s ease, box-shadow .18s ease;
      }
      #ki-bn-install.show { display: inline-flex; }
      #ki-bn-install:hover { transform: translateY(-2px) scale(1.06); box-shadow: 0 6px 18px -2px rgba(232,152,18,0.6); }
      #ki-bn-install:active { transform: translateY(0) scale(0.98); }
      #ki-bn-install::after {
        content: 'Uygulamayı Yükle';
        position: absolute; right: 52px; top: 50%; transform: translateY(-50%);
        background: #0a2e4c; color: #fff;
        font-family: 'Inter', system-ui, sans-serif; font-size: 11px; font-weight: 700;
        padding: 5px 10px; border-radius: 6px; white-space: nowrap;
        opacity: 0; pointer-events: none; transition: opacity .15s ease;
      }
      #ki-bn-install:hover::after { opacity: 1; }
      #ki-bn-install .ki-bn-install-x  {
        position: absolute; top: -4px; right: -4px;
        width: 18px; height: 18px; border-radius: 9999px;
        background: #5d97c4; color: #fff; border: 1.5px solid #fff;
        font-size: 11px; line-height: 1; padding: 0;
        cursor: pointer; display: grid; place-items: center;
      }
      #ki-bn-install .ki-bn-install-x:hover { background: #134c79; }

      /* Profil drop-up menu */
      #ki-bn-menu {
        position: fixed; right: 12px; z-index: 9992;
        bottom: calc(72px + env(safe-area-inset-bottom, 0px));
        background: #fff; border: 1px solid #cfdfee; border-radius: 14px;
        box-shadow: 0 12px 32px rgba(7,33,54,0.18);
        min-width: 200px; padding: 6px;
        display: none; flex-direction: column;
        font-family: 'Inter', system-ui, sans-serif;
      }
      #ki-bn-menu.show { display: flex; }
      #ki-bn-menu a, #ki-bn-menu button {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; border-radius: 8px;
        color: #134c79; text-decoration: none; font-size: 14px; font-weight: 500;
        background: transparent; border: 0; cursor: pointer; text-align: left;
      }
      #ki-bn-menu a:hover, #ki-bn-menu button:hover { background: #eaf2f9; }
      #ki-bn-menu .ki-bn-menu-divider { height: 1px; background: #cfdfee; margin: 4px 8px; }
      #ki-bn-menu .ki-bn-menu-user {
        padding: 8px 12px 10px; border-bottom: 1px solid #cfdfee; margin-bottom: 4px;
      }
      #ki-bn-menu .ki-bn-menu-user .name { font-weight: 700; color: #0a2e4c; font-size: 13px; }
      #ki-bn-menu .ki-bn-menu-user .email { font-size: 11px; color: #5d97c4; margin-top: 2px; }
    `;
    const style = document.createElement('style');
    style.id = 'ki-bottomnav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function _ensureBar() {
    if (document.getElementById('ki-bn')) return;
    _ensureStyles();
    const html = `
      <div id="ki-bn" role="navigation" aria-label="Alt menü">
        <div id="ki-bn-inner">
          <a class="ki-bn-item" href="index.html" data-key="home">
            <span class="ki-bn-icon">🏠</span>
            <span class="ki-bn-label">Anasayfa</span>
          </a>
          <button class="ki-bn-item" type="button" data-action="open-search" data-key="search">
            <span class="ki-bn-icon">🔍</span>
            <span class="ki-bn-label">Ara</span>
          </button>
          <a class="ki-bn-item cta" href="${WHATSAPP}" target="_blank" rel="noopener" data-key="concierge">
            <span class="ki-bn-icon">💬</span>
            <span class="ki-bn-label">Concierge</span>
          </a>
          <button class="ki-bn-item" type="button" data-key="auth" id="ki-bn-auth">
            <span class="ki-bn-icon">🔐</span>
            <span class="ki-bn-label">Giriş</span>
          </button>
        </div>
      </div>
      <button id="ki-bn-install" type="button" aria-label="Uygulamayı Yükle" title="Uygulamayı Yükle">
        📱
        <span class="ki-bn-install-x" aria-label="Kapat" role="button">×</span>
      </button>
      <div id="ki-bn-menu" role="menu"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.classList.add('ki-bn-active');

    // Aktif sayfayı işaretle (anasayfa)
    const path = location.pathname.split('/').pop() || 'index.html';
    if (path === '' || path === 'index.html') {
      document.querySelector('#ki-bn-inner [data-key="home"]')?.classList.add('active');
    }

    // Search butonu — header-search.js varsa onu çağır, yoksa #search-input'a focus
    const searchBtn = document.querySelector('#ki-bn-inner [data-key="search"]');
    searchBtn?.addEventListener('click', () => {
      if (window.KalkanSearch?.open) window.KalkanSearch.open();
      else {
        const inp = document.getElementById('search-input') || document.getElementById('abnb-search') || document.getElementById('hizmet-arama');
        inp?.focus(); inp?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Auth menu toggle
    const authBtn = document.getElementById('ki-bn-auth');
    const menuEl  = document.getElementById('ki-bn-menu');
    let _user = null;
    authBtn?.addEventListener('click', e => {
      e.stopPropagation();
      _renderMenu(_user);
      menuEl.classList.toggle('show');
    });
    document.addEventListener('click', e => {
      if (!menuEl.contains(e.target) && !authBtn.contains(e.target)) menuEl.classList.remove('show');
    });

    // Auth state'i dinle (eğer auth.js var ise)
    (async () => {
      try {
        const mod = await import('./auth.js');
        if (mod?.onAuthStateChanged && mod.auth) {
          mod.onAuthStateChanged(mod.auth, user => {
            _user = user;
            _updateAuthIcon(user);
            if (menuEl.classList.contains('show')) _renderMenu(user);
          });
        }
      } catch(_) { /* auth.js yoksa default */ }
    })();

    // PWA install — js/pwa.js beforeinstallprompt'u yakalıyor; biz onu beğeniriz
    // Mevcut pwa.js'in showInstallButton'ı eski elementi yapıyor — onu CSS'le gizledik.
    // Burada da kendi event listener'ımızı koyalım (deferredPrompt'u biz alalım).
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      _showInstallStrip();
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      _hideInstallStrip();
    });

    const installEl = document.getElementById('ki-bn-install');
    // Ana ikon → install prompt
    installEl.addEventListener('click', async (e) => {
      // Kapatma × tıklandıysa promp'u atla
      if (e.target.closest('.ki-bn-install-x')) return;
      if (!deferredPrompt) return _hideInstallStrip();
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch(_) {}
      deferredPrompt = null;
      _hideInstallStrip();
    });
    // Kapatma × — session boyunca gizle
    installEl.querySelector('.ki-bn-install-x').addEventListener('click', (e) => {
      e.stopPropagation();
      _hideInstallStrip();
      try { sessionStorage.setItem('ki-bn-install-dismissed', '1'); } catch(_) {}
    });
  }

  function _showInstallStrip() {
    try { if (sessionStorage.getItem('ki-bn-install-dismissed')) return; } catch(_) {}
    document.getElementById('ki-bn-install')?.classList.add('show');
  }
  function _hideInstallStrip() {
    document.getElementById('ki-bn-install')?.classList.remove('show');
  }

  function _updateAuthIcon(user) {
    const btn = document.getElementById('ki-bn-auth');
    if (!btn) return;
    if (user) {
      btn.innerHTML = `
        <span class="ki-bn-icon">${user.photoURL ? `<img src="${_esc(user.photoURL)}" alt="" style="width:24px;height:24px;border-radius:9999px;object-fit:cover;display:inline-block;" />` : '👤'}</span>
        <span class="ki-bn-label">${_esc(_short(user.displayName || user.email || 'Profil', 8))}</span>`;
    } else {
      btn.innerHTML = `<span class="ki-bn-icon">🔐</span><span class="ki-bn-label">Giriş</span>`;
    }
  }

  function _renderMenu(user) {
    const menu = document.getElementById('ki-bn-menu');
    if (!menu) return;
    if (user) {
      menu.innerHTML = `
        <div class="ki-bn-menu-user">
          <div class="name">${_esc(user.displayName || 'Hesabım')}</div>
          ${user.email ? `<div class="email">${_esc(user.email)}</div>` : ''}
        </div>
        <a href="profil.html"><span>👤</span>Profilim</a>
        <a href="hizmet-ekle.html"><span>➕</span>İşletme/Hizmet Ekle</a>
        <a href="admin.html"><span>⚙️</span>Admin Paneli</a>
        <div class="ki-bn-menu-divider"></div>
        <button data-action="logout" type="button"><span>🚪</span>Çıkış Yap</button>
      `;
    } else {
      menu.innerHTML = `
        <a href="login.html"><span>🔐</span>Giriş Yap</a>
        <a href="register.html"><span>✨</span>Üye Ol</a>
        <div class="ki-bn-menu-divider"></div>
        <a href="hizmet-ekle.html"><span>➕</span>İşletme/Hizmet Ekle</a>
        <a href="admin.html"><span>⚙️</span>Admin Paneli</a>
      `;
    }
    // Menu içindeki link'lere tıklayınca menuyü kapat
    menu.querySelectorAll('a, button').forEach(a => a.addEventListener('click', () => menu.classList.remove('show')));

    // Logout: auth.js'i lazy import et
    const logoutBtn = menu.querySelector('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const mod = await import('./auth.js');
          if (mod && typeof mod.logout === 'function') await mod.logout();
        } catch (err) { console.warn('[bottom-nav] logout failed', err); }
        window.location.href = 'index.html';
      });
    }
  }

  function _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
  function _short(s, n) { s = String(s||''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // Init
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _ensureBar);
  else _ensureBar();
})();
