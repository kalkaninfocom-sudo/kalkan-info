// Plausible analytics — yalnızca KVKK 'analytics' rızası varsa yüklenir.
// cookie-banner.js KalkanConsent global'ini tanımlar; bu script onu bekler.
//
// Custom event API:
//   window.plausibleEvent(name, props)        — generic event fire
//   window.plausibleEvent.queue(name, props)  — queue if plausible not ready
//
// Dev mod (localhost / 127.0.0.1 / ?debug=1): her event console'a log'lanır.
(function () {
  'use strict';

  // ── Dev flag (localhost veya ?debug=1) ──────────────────────────────────────
  function isDevHost() {
    var h = location.hostname || '';
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')
      || (location.search || '').indexOf('debug=1') !== -1;
  }
  var DEV = isDevHost();

  // ── Plausible script loader (yeni Auto-collect bundle) ─────────────────────
  // Berkay'ın Plausible dashboard'undan aldığı site-spesifik bundle URL'i.
  // Eski script.manual.js'in yerini alır; pageview otomatik gönderir, plausible.init() ile başlatılır.
  function loadPlausible() {
    if (document.getElementById('ki-plausible')) return;

    // window.plausible queue stub — script yüklenirken çağrılan event'ler kaybolmasın
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    window.plausible.init = window.plausible.init || function (i) { window.plausible.o = i || {}; };

    var s = document.createElement('script');
    s.id = 'ki-plausible';
    s.async = true;
    s.src = 'https://plausible.io/js/pa-WDst05-xZaCn0apL8me2-.js';
    s.onload = function () {
      try { window.plausible.init(); } catch (e) {}
      // Yeni bundle pageview'i otomatik gönderir — manuel çağrıya gerek yok.
      // Sadece consent öncesi queue'lanan custom event'leri boşalt.
      flushQueue();
    };
    document.head.appendChild(s);
  }

  function checkAndLoad() {
    if (window.KalkanConsent && window.KalkanConsent.has && window.KalkanConsent.has('analytics')) {
      loadPlausible();
    }
  }

  // ── Event queue (consent gelene kadar bekleyenler) ─────────────────────────
  var queue = [];
  function flushQueue() {
    if (typeof window.plausible !== 'function') return;
    while (queue.length) {
      var ev = queue.shift();
      try { window.plausible(ev.name, { props: ev.props || {} }); } catch (e) {}
    }
  }

  function hasConsent() {
    return !!(window.KalkanConsent && window.KalkanConsent.has && window.KalkanConsent.has('analytics'));
  }

  // ── Public helper ──────────────────────────────────────────────────────────
  function plausibleEvent(name, props) {
    if (!name) return;
    props = props || {};
    // Page url her zaman faydalı
    if (!props.page) props.page = location.pathname + location.hash;
    if (DEV) {
      try { console.log('[plausible]', name, props); } catch (e) {}
    }
    if (!hasConsent()) {
      // Consent yoksa drop — analytics rızası şart
      return;
    }
    if (typeof window.plausible === 'function') {
      try { window.plausible(name, { props: props }); } catch (e) {}
    } else {
      queue.push({ name: name, props: props });
    }
  }
  plausibleEvent.queue = function (name, props) { queue.push({ name: name, props: props || {} }); };

  window.plausibleEvent = plausibleEvent;

  // ── Global outbound + tel + maps listener ──────────────────────────────────
  // Her sayfada outbound `<a target="_blank">`, `tel:`, `mailto:`, maps linkleri yakalanır.
  function classifyLink(a) {
    if (!a || !a.href) return null;
    var href = a.href;
    try {
      var u = new URL(href, location.href);
      if (u.protocol === 'tel:')    return { ev: 'phone_click',     props: { number: u.pathname || '' } };
      if (u.protocol === 'mailto:') return { ev: 'email_click',     props: { email_domain: (u.pathname || '').split('@')[1] || '' } };
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

      var host = u.hostname.replace(/^www\./, '');
      var self = location.hostname.replace(/^www\./, '');
      if (host === self) return null; // internal nav → bypass

      // WhatsApp/Maps/IG/Booking/Airbnb/Tripadvisor — özel kategoriler
      if (/(^|\.)wa\.me$/.test(host) || /(^|\.)whatsapp\.com$/.test(host)) {
        return { ev: 'wa_click', props: { dest: host, page: location.pathname } };
      }
      if (/(^|\.)google\.[a-z.]+$/.test(host) && /\/maps\//.test(u.pathname + u.search)) {
        return { ev: 'maps_click', props: { dest: host } };
      }
      if (/(^|\.)instagram\.com$/.test(host)) {
        return { ev: 'instagram_visit', props: { url_path: u.pathname } };
      }
      if (/(^|\.)booking\.com$/.test(host) || /(^|\.)airbnb\.[a-z.]+$/.test(host) || /(^|\.)tripadvisor\.[a-z.]+$/.test(host)) {
        return { ev: 'outbound_link', props: { dest: host, category: 'ota' } };
      }
      return { ev: 'outbound_link', props: { dest: host } };
    } catch (e) { return null; }
  }

  function onDocClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var info = classifyLink(a);
    if (!info) return;
    plausibleEvent(info.ev, info.props);

    // data-cta="..." varsa cta_click de fire et
    var cta = a.getAttribute && a.getAttribute('data-cta');
    if (cta) plausibleEvent('cta_click', { cta: cta, page: location.pathname });
  }

  function bindGlobals() {
    document.addEventListener('click', onDocClick, true);

    // data-cta="..." attribute olan butonlar (a olmayan) için ayrı listener
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
      if (!t || t.tagName === 'A') return; // a tagleri yukarıda işlendi
      var cta = t.getAttribute('data-cta');
      if (cta) plausibleEvent('cta_click', { cta: cta, page: location.pathname });
    }, true);

    // Web Share API kullanımı (varsa) — share event
    try {
      var origShare = navigator.share;
      if (typeof origShare === 'function') {
        navigator.share = function (data) {
          try { plausibleEvent('share', { has_url: !!(data && data.url), page: location.pathname }); } catch (e) {}
          return origShare.call(navigator, data);
        };
      }
    } catch (e) {}
  }

  // cookie-banner.js defer ile yüklü; küçük gecikme ile KalkanConsent hazır olur
  function init() {
    bindGlobals();
    setTimeout(checkAndLoad, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Kullanıcı sonradan rıza verirse anında yükle
  document.addEventListener('ki-consent-changed', checkAndLoad);
})();
