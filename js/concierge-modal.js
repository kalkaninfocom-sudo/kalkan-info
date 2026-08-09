/**
 * js/concierge-modal.js — Kalkan Info
 * ARTIK LYRA BOOTSTRAP (2026-07-28).
 * Eski 2-profil WhatsApp modali yerine AI konsiyerj **Lyra**'yı yükler.
 *  - Mevcut #concierge yüzen butonu gizlenir; Lyra'nın kendi altın FAB'ı gelir.
 *  - Tüm [data-concierge-trigger] linkleri Lyra'yı açar.
 *  - İnsan devri (Berkay WhatsApp) Lyra içindeki 👤 ile korunur; WhatsApp-niyetli
 *    linkler doğrudan insan devrini açar.
 * Widget kaynağı: ai/concierge-widget/lyra-widget.js → js/lyra-widget.js (deploy kopyası).
 */
(function () {
  'use strict';
  if (window.__kalkan_concierge_mounted) return;
  window.__kalkan_concierge_mounted = true;

  // 1) Lyra yapılandırması (sayfa kendi LYRA_CONFIG'ini set etmediyse). anonKey public'tir.
  window.LYRA_CONFIG = window.LYRA_CONFIG || {
    endpoint: 'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/lyra-chat',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWNoZmVhbHpkcGZoZGdyeXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTU4MTcsImV4cCI6MjA5NDIzMTgxN30.iu4IunNFuy5TEfiQ6bwmWlf7YH5cOCZOG1tY-tDxjQc',
    conciergeData: '/data/concierge.json'
  };

  // 2) Lyra widget'ını yükle
  if (!document.querySelector('script[data-lyra-widget]')) {
    var s = document.createElement('script');
    s.src = '/js/lyra-widget.js?v=20260809b';
    s.defer = true;
    s.setAttribute('data-lyra-widget', '1');
    document.head.appendChild(s);
  }

  // 3) Eski yüzen concierge butonunu gizle (Lyra'nın FAB'ı onun yerine geçer)
  var hideCss = document.createElement('style');
  hideCss.textContent = '#concierge{display:none !important;}';
  document.head.appendChild(hideCss);

  // 4) Lyra async yüklendiği için hazır olunca aç
  function openLyra(human) {
    var tries = 0;
    (function wait() {
      if (window.Lyra) { human ? window.Lyra.human() : window.Lyra.open(); return; }
      if (tries++ > 50) return;
      setTimeout(wait, 100);
    })();
  }

  // 5) Tüm concierge tetikleyicilerini Lyra'ya bağla
  function bind() {
    document.querySelectorAll('#concierge, [data-concierge-trigger]').forEach(function (el) {
      if (el.__lyraBound) return;
      el.__lyraBound = true;
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var meta = (el.getAttribute('aria-label') || '') + (el.getAttribute('data-en') || '') +
                   (el.getAttribute('data-en-aria') || '') + (el.getAttribute('data-concierge-source') || '');
        openLyra(/wa\b|whatsapp/i.test(meta));   // WhatsApp niyetli link → doğrudan insan devri
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  // Geriye uyumluluk (eski window.openConcierge çağrıları)
  window.openConcierge = function () { openLyra(false); };
})();
