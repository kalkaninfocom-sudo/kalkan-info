(function () {
  'use strict';

  var CONSENT_KEY = 'ki-consent-v1';
  var CONSENT_VERSION = 1;
  var CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 12 ay

  // ── Metinler ──────────────────────────────────────────────────────────────
  var T = {
    en: {
      title: 'Cookie & Storage Preferences',
      body: 'We use browser storage to enhance your experience (language preference, map state, content cache). Some uses are essential for the site to work. You can manage your preferences below.',
      functional: 'Functional (Required)',
      functionalDesc: 'Language preference, session state. Cannot be disabled.',
      analytics: 'Analytics',
      analyticsDesc: 'Anonymised visit statistics via Plausible (no cookies, no cross-site tracking).',
      marketing: 'Marketing',
      marketingDesc: 'Social feed embeds, promotional content personalisation.',
      acceptAll: 'Accept All',
      functionalOnly: 'Essential Only',
      manage: 'Manage Preferences',
      save: 'Save Preferences',
      kvkkLink: 'Privacy Policy (KVKK)',
      close: 'Close',
    },
    tr: {
      title: 'Çerez & Depolama Tercihleri',
      body: 'Deneyiminizi geliştirmek için tarayıcı depolama alanı kullanıyoruz (dil tercihi, harita durumu, içerik önbelleği). Bazı kullanımlar sitenin çalışması için zorunludur. Tercihlerinizi aşağıdan yönetebilirsiniz.',
      functional: 'İşlevsel (Zorunlu)',
      functionalDesc: 'Dil tercihi, oturum durumu. Devre dışı bırakılamaz.',
      analytics: 'Analitik',
      analyticsDesc: 'Plausible üzerinden anonimleştirilmiş ziyaret istatistikleri (çerez yok, çapraz site takip yok).',
      marketing: 'Pazarlama',
      marketingDesc: 'Sosyal medya akışı yerleştirmeleri, promosyon içerik kişiselleştirmesi.',
      acceptAll: 'Tümünü Kabul Et',
      functionalOnly: 'Yalnızca Zorunlu',
      manage: 'Tercihleri Yönet',
      save: 'Tercihleri Kaydet',
      kvkkLink: 'Gizlilik Politikası (KVKK)',
      close: 'Kapat',
    }
  };

  // ── Yardımcılar ───────────────────────────────────────────────────────────
  function getLang() {
    if (window.KalkanI18n) return window.KalkanI18n.get();
    var stored = localStorage.getItem('lang');
    return (stored === 'tr') ? 'tr' : 'en';
  }

  function t(key) {
    var lang = getLang();
    return (T[lang] && T[lang][key]) ? T[lang][key] : T['en'][key];
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.version !== CONSENT_VERSION) return null;
      // 12 ay re-consent kontrolü
      if (!obj.ts || (Date.now() - new Date(obj.ts).getTime()) > CONSENT_TTL_MS) return null;
      return obj;
    } catch (e) { return null; }
  }

  function writeConsent(analytics, marketing) {
    var obj = {
      functional: true,
      analytics: !!analytics,
      marketing: !!marketing,
      ts: new Date().toISOString(),
      version: CONSENT_VERSION
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(obj));
    return obj;
  }

  // ── Global API ────────────────────────────────────────────────────────────
  window.KalkanConsent = {
    has: function (purpose) {
      var c = readConsent();
      if (!c) return false;
      return !!c[purpose];
    },
    get: readConsent,
    reset: function () {
      localStorage.removeItem(CONSENT_KEY);
    }
  };

  // ── Lyra orb — consent açıkken gizle ─────────────────────────────────────
  function _hideLyraOrb() {
    var orb = document.getElementById('lyra-root');
    if (orb) orb.style.setProperty('display', 'none', 'important');
  }
  function _showLyraOrb() {
    var orb = document.getElementById('lyra-root');
    if (orb) orb.style.removeProperty('display');
  }

  // ── Install banners — consent açıkken gizle ───────────────────────────────
  function _hideInstallUIs() {
    var els = [
      document.getElementById('kalkan-install-banner'),
      document.getElementById('kalkan-ios-banner'),
      document.getElementById('ki-bn-install'),
    ];
    els.forEach(function (el) { if (el) el.style.setProperty('display', 'none', 'important'); });
  }
  function _restoreInstallUIs() {
    // ki-bn-install uses .show class for visibility — only restore if it had show
    var bnInstall = document.getElementById('ki-bn-install');
    if (bnInstall && bnInstall.dataset.kiWasVisible) {
      bnInstall.style.removeProperty('display');
      delete bnInstall.dataset.kiWasVisible;
    }
    // pwa.js banners: just remove the display override; pwa.js manages their lifecycle
    var others = [
      document.getElementById('kalkan-install-banner'),
      document.getElementById('kalkan-ios-banner'),
    ];
    others.forEach(function (el) { if (el) el.style.removeProperty('display'); });
  }

  // ── Stil enjeksiyonu ──────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ki-cookie-styles')) return;
    var s = document.createElement('style');
    s.id = 'ki-cookie-styles';
    s.textContent = [
      // ── Banner: slim fixed bar, max 112px tall on mobile ──────────────────
      '#ki-cookie-banner{',
        'position:fixed;bottom:0;left:0;right:0;z-index:10100;',
        'background:rgba(5,18,35,0.97);',
        'border-top:1px solid rgba(74,158,245,0.25);',
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'font-family:"Inter",system-ui,sans-serif;',
        'padding:10px 20px;',
        'box-shadow:0 -4px 32px rgba(0,0,0,0.45),0 -1px 0 rgba(74,158,245,0.12);',
        'opacity:0;transform:translateY(24px);',
        'transition:opacity .32s ease,transform .32s ease;',
        'max-height:120px;overflow:hidden;',
      '}',
      '#ki-cookie-banner.ki-cb-visible{opacity:1;transform:translateY(0);}',
      '#ki-cookie-inner{max-width:900px;margin:0 auto;}',
      // Single-row layout: title left, buttons right
      '#ki-cookie-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:0;}',
      '#ki-cookie-title{margin:0;color:#fff;font-size:13px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;}',
      // Body text hidden by default — shown only on wider screens
      '#ki-cookie-body{display:none;}',
      '#ki-cookie-close{background:transparent;border:none;color:rgba(210,225,240,0.45);font-size:20px;line-height:1;cursor:pointer;padding:0 0 0 6px;flex-shrink:0;}',
      '#ki-cookie-close:hover{color:#fff;}',
      // Actions: inline row, no wrapping — keep all buttons visible
      '#ki-cookie-actions{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;margin-top:8px;}',
      '#ki-cookie-actions button{',
        'border:none;cursor:pointer;font-size:11px;font-weight:700;',
        'letter-spacing:0.01em;padding:7px 12px;border-radius:8px;',
        'transition:opacity .18s ease,transform .18s ease;white-space:nowrap;flex-shrink:0;',
      '}',
      '#ki-cookie-actions button:hover{opacity:.88;transform:translateY(-1px);}',
      '#ki-cookie-actions button:active{transform:translateY(0);}',
      '#ki-cb-accept-all{background:#4A9EF5;color:#0a2e4c;}',
      '#ki-cb-functional{background:rgba(74,158,245,0.12);color:#4A9EF5;border:1px solid rgba(74,158,245,0.3)!important;}',
      '#ki-cb-manage{background:transparent;color:rgba(210,225,240,0.6);text-decoration:underline;padding:7px 6px!important;}',
      '#ki-cb-manage:hover{color:#fff;opacity:1!important;transform:none!important;}',
      // KVKK link: hidden on mobile to save space, shown on wider screens
      '.ki-cb-kvkk{display:none;margin-left:auto;font-size:11px;color:rgba(74,158,245,0.65);text-decoration:none;white-space:nowrap;}',
      '.ki-cb-kvkk:hover{color:#4A9EF5;}',
      // Wider screens: show body text and KVKK link
      '@media(min-width:641px){',
        '#ki-cookie-body{display:block;margin:4px 0 0;color:rgba(210,225,240,0.78);font-size:12px;line-height:1.5;}',
        '.ki-cb-kvkk{display:inline;}',
        '#ki-cookie-banner{max-height:none;padding:14px 20px;}',
        '#ki-cookie-top{margin-bottom:6px;}',
        '#ki-cookie-actions button{font-size:12px;padding:8px 16px;}',
      '}',
      // Modal (detail panel)
      '#ki-cookie-modal{',
        'display:none;position:fixed;bottom:0;left:0;right:0;z-index:10101;',
        'background:rgba(5,18,35,0.98);',
        'border-top:1px solid rgba(74,158,245,0.3);',
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
        'padding:20px;',
        'max-height:80vh;overflow-y:auto;',
        'box-shadow:0 -8px 40px rgba(0,0,0,0.55);',
        'opacity:0;transform:translateY(32px);',
        'transition:opacity .3s ease,transform .3s ease;',
      '}',
      '#ki-cookie-modal.ki-cb-visible{display:block;opacity:1;transform:translateY(0);}',
      '#ki-modal-inner{max-width:700px;margin:0 auto;}',
      '#ki-modal-title{margin:0 0 14px;color:#fff;font-size:15px;font-weight:700;}',
      '.ki-cb-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(74,158,245,0.1);}',
      '.ki-cb-row:last-of-type{border-bottom:none;}',
      '.ki-cb-row-info{flex:1;min-width:0;}',
      '.ki-cb-row-label{font-size:13px;font-weight:600;color:#fff;margin:0 0 2px;}',
      '.ki-cb-row-desc{font-size:11px;color:rgba(210,225,240,0.6);margin:0;line-height:1.5;}',
      // Toggle switch
      '.ki-toggle{position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0;}',
      '.ki-toggle input{opacity:0;width:0;height:0;}',
      '.ki-toggle-slider{',
        'position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;',
        'background:rgba(255,255,255,0.12);border-radius:22px;',
        'transition:background .2s ease;',
      '}',
      '.ki-toggle-slider:before{',
        'position:absolute;content:"";height:16px;width:16px;',
        'left:3px;bottom:3px;background:#fff;border-radius:50%;',
        'transition:transform .2s ease;',
      '}',
      '.ki-toggle input:checked + .ki-toggle-slider{background:#4A9EF5;}',
      '.ki-toggle input:checked + .ki-toggle-slider:before{transform:translateX(18px);}',
      '.ki-toggle input:disabled + .ki-toggle-slider{opacity:0.4;cursor:not-allowed;}',
      '.ki-toggle input:focus-visible + .ki-toggle-slider{outline:2px solid #4A9EF5;outline-offset:2px;}',
      '#ki-modal-actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;}',
      '#ki-cb-save{background:#4A9EF5;color:#0a2e4c;border:none;cursor:pointer;font-size:13px;font-weight:700;padding:10px 22px;border-radius:8px;transition:opacity .18s ease,transform .18s ease;}',
      '#ki-cb-save:hover{opacity:.88;transform:translateY(-1px);}',
      '#ki-modal-close-btn{background:transparent;border:1px solid rgba(74,158,245,0.25);color:rgba(210,225,240,0.6);cursor:pointer;font-size:12px;font-weight:600;padding:10px 18px;border-radius:8px;transition:opacity .18s ease;}',
      '#ki-modal-close-btn:hover{color:#fff;opacity:.85;}',
      '@media(max-width:640px){',
        '#ki-cookie-modal{padding:16px 14px;}',
      '}',
      // Lyra orb: hide while consent banner is open
      '#ki-cookie-banner.ki-cb-visible ~ * #lyra-root,',
      'body.ki-consent-open #lyra-root{display:none!important;}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Banner DOM ────────────────────────────────────────────────────────────
  function buildBanner() {
    var el = document.createElement('div');
    el.id = 'ki-cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', t('title'));
    el.innerHTML = [
      '<div id="ki-cookie-inner">',
        '<div id="ki-cookie-top">',
          '<p id="ki-cookie-title">' + t('title') + '</p>',
          '<button id="ki-cookie-close" aria-label="' + t('close') + '">×</button>',
        '</div>',
        '<p id="ki-cookie-body">' + t('body') + '</p>',
        '<div id="ki-cookie-actions">',
          '<button id="ki-cb-accept-all" type="button">' + t('acceptAll') + '</button>',
          '<button id="ki-cb-functional" type="button">' + t('functionalOnly') + '</button>',
          '<button id="ki-cb-manage" type="button">' + t('manage') + '</button>',
          '<a class="ki-cb-kvkk" href="kvkk.html">' + t('kvkkLink') + '</a>',
        '</div>',
      '</div>',
    ].join('');
    return el;
  }

  // ── Modal DOM ─────────────────────────────────────────────────────────────
  function buildModal(current) {
    var el = document.createElement('div');
    el.id = 'ki-cookie-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', t('title'));
    var anlChecked = (current && current.analytics) ? 'checked' : '';
    var mktChecked = (current && current.marketing) ? 'checked' : '';
    el.innerHTML = [
      '<div id="ki-modal-inner">',
        '<p id="ki-modal-title">' + t('title') + '</p>',
        // Functional row (disabled)
        '<div class="ki-cb-row">',
          '<div class="ki-cb-row-info">',
            '<p class="ki-cb-row-label">' + t('functional') + '</p>',
            '<p class="ki-cb-row-desc">' + t('functionalDesc') + '</p>',
          '</div>',
          '<label class="ki-toggle"><input type="checkbox" checked disabled><span class="ki-toggle-slider"></span></label>',
        '</div>',
        // Analytics row
        '<div class="ki-cb-row">',
          '<div class="ki-cb-row-info">',
            '<p class="ki-cb-row-label">' + t('analytics') + '</p>',
            '<p class="ki-cb-row-desc">' + t('analyticsDesc') + '</p>',
          '</div>',
          '<label class="ki-toggle"><input id="ki-chk-analytics" type="checkbox" ' + anlChecked + '><span class="ki-toggle-slider"></span></label>',
        '</div>',
        // Marketing row
        '<div class="ki-cb-row">',
          '<div class="ki-cb-row-info">',
            '<p class="ki-cb-row-label">' + t('marketing') + '</p>',
            '<p class="ki-cb-row-desc">' + t('marketingDesc') + '</p>',
          '</div>',
          '<label class="ki-toggle"><input id="ki-chk-marketing" type="checkbox" ' + mktChecked + '><span class="ki-toggle-slider"></span></label>',
        '</div>',
        '<div id="ki-modal-actions">',
          '<button id="ki-cb-save" type="button">' + t('save') + '</button>',
          '<button id="ki-modal-close-btn" type="button">' + t('close') + '</button>',
        '</div>',
      '</div>',
    ].join('');
    return el;
  }

  // ── Banner yönetimi ───────────────────────────────────────────────────────
  var _banner = null;
  var _modal = null;

  function hideBanner() {
    if (_banner) {
      _banner.classList.remove('ki-cb-visible');
      document.body.classList.remove('ki-consent-open');
      _showLyraOrb();
      _restoreInstallUIs();
      setTimeout(function () {
        if (_banner && _banner.parentNode) _banner.parentNode.removeChild(_banner);
        _banner = null;
      }, 350);
    }
  }

  function hideModal() {
    if (_modal) {
      _modal.classList.remove('ki-cb-visible');
      setTimeout(function () {
        if (_modal && _modal.parentNode) _modal.parentNode.removeChild(_modal);
        _modal = null;
      }, 320);
    }
  }

  function openModal() {
    if (_modal) return;
    var current = readConsent();
    _modal = buildModal(current);
    document.body.appendChild(_modal);
    // force reflow then animate
    _modal.getBoundingClientRect();
    _modal.classList.add('ki-cb-visible');

    _modal.querySelector('#ki-cb-save').addEventListener('click', function () {
      var anlChk = _modal.querySelector('#ki-chk-analytics');
      var mktChk = _modal.querySelector('#ki-chk-marketing');
      writeConsent(anlChk && anlChk.checked, mktChk && mktChk.checked);
      hideModal();
      hideBanner();
    });
    _modal.querySelector('#ki-modal-close-btn').addEventListener('click', hideModal);
  }

  function _fireConsentResolved() {
    try { document.dispatchEvent(new CustomEvent('ki-consent-resolved')); } catch (e) {}
  }

  function acceptAll() {
    writeConsent(true, true);
    hideModal();
    hideBanner();
    _fireConsentResolved();
  }

  function acceptFunctionalOnly() {
    writeConsent(false, false);
    hideModal();
    hideBanner();
    _fireConsentResolved();
  }

  function showBanner() {
    if (_banner) return;
    _banner = buildBanner();
    document.body.appendChild(_banner);
    document.body.classList.add('ki-consent-open');
    // Hide competing UI layers while consent is pending
    _hideLyraOrb();
    // Mark ki-bn-install visibility before hiding so we can restore it
    var bnInstall = document.getElementById('ki-bn-install');
    if (bnInstall && bnInstall.classList.contains('show')) {
      bnInstall.dataset.kiWasVisible = '1';
    }
    _hideInstallUIs();
    // force reflow then animate in
    _banner.getBoundingClientRect();
    _banner.classList.add('ki-cb-visible');

    _banner.querySelector('#ki-cb-accept-all').addEventListener('click', acceptAll);
    _banner.querySelector('#ki-cb-functional').addEventListener('click', acceptFunctionalOnly);
    _banner.querySelector('#ki-cb-manage').addEventListener('click', openModal);
    // KVKK: X butonu rıza vermez — sadece banner'ı gizler, sonraki ziyarette tekrar gösterilir
    _banner.querySelector('#ki-cookie-close').addEventListener('click', hideBanner);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    var consent = readConsent();
    if (!consent) {
      // Küçük gecikme: sayfa ilk yüklenişinde layout kayması engelle
      setTimeout(showBanner, 600);

      // MutationObserver: lyra-root veya install banners consent sırasında DOM'a eklenirse gizle
      if (typeof MutationObserver !== 'undefined') {
        var _mo = new MutationObserver(function (mutations) {
          if (!document.body.classList.contains('ki-consent-open')) return;
          mutations.forEach(function (m) {
            m.addedNodes.forEach(function (node) {
              if (!node || node.nodeType !== 1) return;
              var id = node.id || '';
              if (id === 'lyra-root') { node.style.setProperty('display', 'none', 'important'); }
              if (id === 'kalkan-install-banner' || id === 'kalkan-ios-banner') {
                node.style.setProperty('display', 'none', 'important');
              }
            });
          });
        });
        _mo.observe(document.body, { childList: true });
        // Disconnect after consent resolved — no longer needed
        document.addEventListener('ki-consent-resolved', function () { _mo.disconnect(); });
      }
    }
    // i18n değişirse metinleri güncelle (dil değiştikten sonra banner açıksa)
    document.addEventListener('ki-lang-changed', function () {
      // Banner açıksa yeniden oluştur
      if (_banner) {
        var hadBanner = true;
        hideBanner();
        if (hadBanner) setTimeout(showBanner, 380);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
