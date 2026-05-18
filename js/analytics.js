// Plausible analytics — yalnızca KVKK 'analytics' rızası varsa yüklenir.
// cookie-banner.js KalkanConsent global'ini tanımlar; bu script onu bekler.
(function () {
  'use strict';

  function loadPlausible() {
    if (document.getElementById('ki-plausible')) return;
    var s = document.createElement('script');
    s.id = 'ki-plausible';
    s.defer = true;
    s.setAttribute('data-domain', 'kalkaninfo.com');
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }

  function checkAndLoad() {
    if (window.KalkanConsent && window.KalkanConsent.has && window.KalkanConsent.has('analytics')) {
      loadPlausible();
    }
  }

  // cookie-banner.js defer ile yüklü; küçük gecikme ile KalkanConsent hazır olur
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(checkAndLoad, 80); });
  } else {
    setTimeout(checkAndLoad, 80);
  }

  // Kullanıcı sonradan rıza verirse anında yükle
  document.addEventListener('ki-consent-changed', checkAndLoad);
})();
