// Microsoft Clarity heatmap / session-recording loader.
// KVKK-uyumlu: yalnızca 'analytics' rızası varsa yüklenir (Plausible ile aynı kategori).
// Project ID kaynakları (öncelik sırası):
//   1) window.KALKAN_CLARITY_PROJECT_ID
//   2) <script data-clarity-id="XXXXXXXXXX" src="js/clarity-loader.js">
//   3) <meta name="clarity-project-id" content="XXXXXXXXXX">
//
// KVKK notları:
//   - clarity.identify() KULLANILMAZ (PII riski).
//   - Tüm <input> ve formlar mask edilir (clarity("set", "mask", ...) + global mask).
//   - Cookie banner'da "Analytics" kategorisi altındadır; rıza geri çekilirse oturum boyu çalışır,
//     bir sonraki sayfa yüklemesinde dur (Clarity'nin çalışma şekli — yeniden enjekte edilmez).
(function () {
  'use strict';

  // ── Dev flag ──────────────────────────────────────────────────────────────
  function isDevHost() {
    var h = location.hostname || '';
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')
      || (location.search || '').indexOf('debug=1') !== -1;
  }
  var DEV = isDevHost();

  function log() {
    if (!DEV) return;
    try { console.log.apply(console, ['[clarity]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ── Project ID çözümlemesi ─────────────────────────────────────────────────
  function resolveProjectId() {
    if (typeof window.KALKAN_CLARITY_PROJECT_ID === 'string' && window.KALKAN_CLARITY_PROJECT_ID) {
      return window.KALKAN_CLARITY_PROJECT_ID.trim();
    }
    var selfTag = document.querySelector('script[src*="clarity-loader.js"]');
    if (selfTag) {
      var attr = selfTag.getAttribute('data-clarity-id');
      if (attr && attr.trim()) return attr.trim();
    }
    var meta = document.querySelector('meta[name="clarity-project-id"]');
    if (meta) {
      var c = meta.getAttribute('content');
      if (c && c.trim()) return c.trim();
    }
    return null;
  }

  // ── Geçerli ID kontrolü (placeholder olmasın) ──────────────────────────────
  function isValidId(id) {
    if (!id || typeof id !== 'string') return false;
    var v = id.trim();
    if (!v) return false;
    if (/^X+$/i.test(v)) return false;             // 'XXXXXXXXXX' placeholder
    if (/^YOUR[_-]?ID/i.test(v)) return false;
    if (v.length < 6 || v.length > 32) return false;
    return /^[a-z0-9]+$/i.test(v);                  // Clarity ID alfanumerik
  }

  function hasConsent() {
    return !!(window.KalkanConsent && window.KalkanConsent.has && window.KalkanConsent.has('analytics'));
  }

  // ── Clarity snippet ────────────────────────────────────────────────────────
  function injectClarity(projectId) {
    if (document.getElementById('ki-clarity')) return;
    log('loading project', projectId);

    // Standard Clarity bootstrap (Microsoft tarafından önerilen pattern)
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.id = 'ki-clarity';
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', projectId);

    // KVKK sertleştirme: tüm input / textarea / form alanlarını maskele.
    // 'mask' API'si bir CSS selector + 'mask' opsiyonu kabul eder.
    try {
      window.clarity('set', 'analytics_consent', 'granted');
      // Default content masking — Clarity dashboard'da "Mask" alanları için belirleyici
      // Form alanları + class="ki-clarity-mask" işaretli elementler maskelenir.
      window.clarity('mask', [
        'input', 'textarea', 'select', '[data-pii]', '.ki-clarity-mask'
      ]);
    } catch (e) { log('mask setup failed', e); }

    // Plausible'a fire et: kaç kullanıcı analytics consent verdi (Clarity yüklendi)
    try {
      if (typeof window.plausibleEvent === 'function') {
        window.plausibleEvent('clarity_loaded', { page: location.pathname });
      }
    } catch (e) {}
  }

  function checkAndLoad() {
    if (!hasConsent()) { log('no consent yet'); return; }
    var id = resolveProjectId();
    if (!isValidId(id)) {
      log('project id missing or placeholder, skip', id);
      return;
    }
    injectClarity(id);
  }

  function init() {
    setTimeout(checkAndLoad, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Kullanıcı sonradan rıza verirse Clarity yüklensin
  document.addEventListener('ki-consent-changed', checkAndLoad);
})();
