(function () {
  'use strict';

  function mountDrawer() {
    // Idempotent: zaten varsa atla
    if (document.getElementById('site-drawer')) return;

    // MENÜ butonunu bul: önce id ile, sonra text ile
    var btn = document.getElementById('menu-btn');
    if (!btn) {
      var allLinks = document.querySelectorAll('a, button');
      for (var i = 0; i < allLinks.length; i++) {
        if (allLinks[i].textContent.trim() === 'MENÜ') {
          btn = allLinks[i];
          break;
        }
      }
    }

    // MENÜ butonu yoksa drawer mount etme (graceful skip)
    if (!btn) return;

    // Drawer HTML'i oluştur
    var wrapper = document.createElement('div');
    wrapper.innerHTML = '<div id="site-drawer" class="fixed inset-0 z-[80]" style="display:none;" aria-hidden="true">' +
      '<div id="site-drawer-backdrop" class="absolute inset-0" style="background:rgba(7,33,54,0.55);backdrop-filter:blur(2px);opacity:0;transition:opacity .22s ease;"></div>' +
      '<aside id="site-drawer-panel" role="dialog" aria-label="Site Haritası" class="absolute left-0 top-0 h-full w-[320px] max-w-[88vw] text-white overflow-y-auto" style="background:linear-gradient(180deg,#0a2e4c 0%,#072136 100%);box-shadow:8px 0 32px -8px rgba(0,0,0,0.5);transform:translateX(-100%);transition:transform .26s cubic-bezier(.4,0,.2,1);">' +
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
              '<li><a class="block py-1.5 hover:text-sun-400" href="restoranlar.html">🍽️ Restoranlar</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="hizmetler.html">🛠️ Hizmetler</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Doğa & Tarih</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="plajlar.html">🏖️ Plajlar</a></li>' +
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
            '<div class="text-[10px] tracking-[0.18em] uppercase font-bold text-sun-400 mb-2">Hesap</div>' +
            '<ul class="space-y-1.5">' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="login.html">🔑 Giriş Yap</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="register.html">✨ Üye Ol</a></li>' +
              '<li><a class="block py-1.5 hover:text-sun-400" href="profil.html">👤 Profilim</a></li>' +
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
      panel.style.transform  = 'translateX(-100%)';
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDrawer);
  } else {
    mountDrawer();
  }
})();
