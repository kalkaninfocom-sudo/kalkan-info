(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────
  // Global a11y + motion guards (her sayfaya tek seferlik enjekte).
  // - :focus-visible için altın halka (WCAG 2.1 AA)
  // - prefers-reduced-motion: marquee + animate-pulse + tile-icon dur
  // ────────────────────────────────────────────────────────────────────────
  (function injectA11yCSS() {
    if (document.getElementById('ki-a11y-styles')) return;
    var style = document.createElement('style');
    style.id = 'ki-a11y-styles';
    style.textContent =
      ':focus-visible{outline:2px solid #f4b53d;outline-offset:2px;border-radius:4px;}' +
      'button:focus:not(:focus-visible),a:focus:not(:focus-visible){outline:none;}' +
      '@media (prefers-reduced-motion: reduce){' +
        '*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}' +
        '.marquee,#lf-marquee{animation:none!important;transform:none!important;}' +
      '}';
    (document.head || document.documentElement).appendChild(style);
  })();

  function mountDrawer() {
    // Idempotent: zaten varsa atla
    if (document.getElementById('site-drawer')) return;

    // MENÜ butonunu bul: önce id ile, sonra text ile, son olarak alt navdan
    var btn = document.getElementById('menu-btn') || document.getElementById('ki-bn-menu-btn');
    if (!btn) {
      var allLinks = document.querySelectorAll('a, button');
      for (var i = 0; i < allLinks.length; i++) {
        if (allLinks[i].textContent.trim() === 'MENÜ') {
          btn = allLinks[i];
          break;
        }
      }
    }

    // Hiç bulamasak bile drawer mount et — bottom-nav sonradan ekleyebilir
    if (!btn) btn = document.createElement('button'); // sahte trigger

    // Drawer HTML'i oluştur
    var wrapper = document.createElement('div');
    wrapper.innerHTML = '<div id="site-drawer" class="fixed inset-0 z-[80]" style="display:none;" aria-hidden="true">' +
      '<div id="site-drawer-backdrop" class="absolute inset-0" style="background:rgba(7,33,54,0.55);backdrop-filter:blur(2px);opacity:0;transition:opacity .22s ease;"></div>' +
      '<aside id="site-drawer-panel" role="dialog" aria-label="Site Haritası" class="absolute right-0 top-0 h-full w-[320px] max-w-[88vw] text-white overflow-y-auto" style="background:linear-gradient(180deg,#0a2e4c 0%,#072136 100%);box-shadow:-8px 0 32px -8px rgba(0,0,0,0.5);transform:translateX(100%);transition:transform .26s cubic-bezier(.4,0,.2,1);">' +
        '<div class="flex items-center justify-between px-5 py-4 border-b border-white/10">' +
          '<div class="flex items-center gap-2 font-display font-extrabold tracking-tight">' +
            '<span class="text-sun-500">◆</span> KALKAN <span class="text-sun-500">INFO</span>' +
          '</div>' +
          '<button id="site-drawer-close" type="button" aria-label="Kapat" class="w-9 h-9 grid place-items-center rounded hover:bg-white/10" style="transition:background .15s ease;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<nav class="px-5 py-5 space-y-6 text-sm">' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2" data-en="Language" data-de="Sprache" data-ru="Язык" data-fr="Langue">Dil / Language</div>' +
            '<div class="ki-drawer-lang">' +
              '<button type="button" data-lang-toggle="tr" title="Türkçe" aria-label="Türkçe">TR</button>' +
              '<button type="button" data-lang-toggle="en" title="English" aria-label="English">EN</button>' +
              '<button type="button" data-lang-toggle="de" title="Deutsch" aria-label="Deutsch">DE</button>' +
              '<button type="button" data-lang-toggle="ru" title="Русский" aria-label="Русский">RU</button>' +
              '<button type="button" data-lang-toggle="fr" title="Français" aria-label="Français">FR</button>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Keşfet</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="index.html">🏠 Ana Sayfa</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="haberler.html">📰 Haberler</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="aktiviteler.html">🎯 Bölgesel Aktiviteler</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Konaklama & Yeme-İçme</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="villalar.html">🏡 Villalar</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="restoranlar.html">🍽️ Restoran & Bar</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="hizmetler.html">🛠️ Hizmetler</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Doğa & Tarih</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="plajlar.html">🏖️ Plajlar</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="pazarlar.html">🧺 Pazarlar</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="turlar.html">⛵ Turlar</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="antik-kentler.html">🏛️ Antik Kentler</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Planlama Araçları</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="tatil-asistani.html">🧭 Tatil Asistanı</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="hizmet-ekle.html">➕ İşletme Ekle</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">İş & Kariyer</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="ilanlar.html">💼 İş İlanları</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="ilan-ver.html">📝 İlan Ver</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Hesap</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="login.html">🔑 Giriş Yap</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="register.html">✨ Üye Ol</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="profil.html">👤 Profilim</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Kurumsal</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="hakkimizda.html">ℹ️ Hakkımızda</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Yasal & Yönetim</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="kvkk.html">📋 KVKK Aydınlatma</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="privacy.html">🔒 Gizlilik Politikası</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="terms.html">📄 Kullanım Şartları</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400 text-white/70" href="admin.html">⚙️ Admin Girişi</a></li>' +
            '</ul>' +
          '</div>' +
        '</nav>' +
        '<div class="px-5 py-4 border-t border-white/10 text-[11px] text-white/50">' +
          'Kalkan Info · Yerel bilgi, seçili tavsiyeler' +
        '</div>' +
      '</aside>' +
    '</div>';

    document.body.appendChild(wrapper.firstChild);

    var drawer   = document.getElementById('site-drawer');
    var backdrop = document.getElementById('site-drawer-backdrop');
    var panel    = document.getElementById('site-drawer-panel');
    var closeBtn = document.getElementById('site-drawer-close');

    function openDrawer() {
      drawer.style.display = 'block';
      drawer.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () {
        backdrop.style.opacity = '1';
        panel.style.transform  = 'translateX(0)';
      });
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      backdrop.style.opacity = '0';
      panel.style.transform  = 'translateX(100%)';
      btn.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      setTimeout(function () { drawer.style.display = 'none'; }, 260);
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Global trigger — bottom-nav vb. dış kaynaklar için
    window.openSiteDrawer = openDrawer;
    window.closeSiteDrawer = closeDrawer;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDrawer);
  } else {
    mountDrawer();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Bugünün tarihi — her sayfa için merkezi güncelleme.
  // Hedef: hardcoded "29/30 Nisan 2026" string'lerinin yerine bugünün tarihi.
  // Eleman: <span id="today-date"> veya <span data-today>
  // ──────────────────────────────────────────────────────────────────────────
  function updateToday() {
    try {
      var fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      var text = fmt.format(new Date());
      var nodes = document.querySelectorAll('#today-date, [data-today]');
      nodes.forEach(function (n) { n.textContent = text; });
    } catch (e) { /* ignore */ }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Hava durumu — Kalkan (36.27, 29.41). Open-Meteo, CORS açık, anahtarsız.
  // Hedef eleman: <span data-weather>  (örn. "☀ 22°C / Açık")
  // Fallback: çağrı başarısızsa eleman gizlenir (fake veri göstermek yerine).
  // ──────────────────────────────────────────────────────────────────────────
  function updateWeather() {
    var targets = document.querySelectorAll('[data-weather]');
    if (!targets.length) return;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=36.27&longitude=29.41&current=temperature_2m,weather_code&timezone=Europe%2FIstanbul';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      var c = data && data.current;
      if (!c || typeof c.temperature_2m !== 'number') {
        targets.forEach(function (n) { n.style.display = 'none'; });
        return;
      }
      var code = c.weather_code;
      // WMO weather code → emoji + Türkçe etiket (özet eşleme)
      var map = {
        0:  ['☀', 'Açık'],            1:  ['🌤', 'Çoğunlukla açık'],
        2:  ['⛅', 'Parçalı bulutlu'], 3:  ['☁',  'Bulutlu'],
        45: ['🌫', 'Sis'],            48: ['🌫', 'Donlu sis'],
        51: ['🌦', 'Hafif çisenti'],  53: ['🌦', 'Çisenti'],     55: ['🌦', 'Yoğun çisenti'],
        61: ['🌧', 'Hafif yağmur'],   63: ['🌧', 'Yağmur'],       65: ['🌧', 'Şiddetli yağmur'],
        71: ['🌨', 'Hafif kar'],      73: ['🌨', 'Kar'],          75: ['🌨', 'Yoğun kar'],
        80: ['🌦', 'Hafif sağanak'],  81: ['🌦', 'Sağanak'],      82: ['⛈', 'Şiddetli sağanak'],
        95: ['⛈', 'Gök gürültülü'],   96: ['⛈', 'Dolu ile fırtına'], 99: ['⛈', 'Şiddetli fırtına']
      };
      var entry = map[code] || ['🌡', '—'];
      var label = entry[0] + ' ' + Math.round(c.temperature_2m) + '°C / ' + entry[1];
      targets.forEach(function (n) { n.textContent = label; });
    }).catch(function () {
      targets.forEach(function (n) { n.style.display = 'none'; });
    });
  }

  function runHeaderUpdates() { updateToday(); updateWeather(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runHeaderUpdates);
  } else {
    runHeaderUpdates();
  }
})();
