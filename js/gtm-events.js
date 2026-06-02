/**
 * GTM Conversion Event Tracking
 * kalkaninfo.com — vanilla JS, no dependencies
 * Events: whatsapp_click, tel_click, reservation_submit,
 *         review_card_click, language_change, review_section_view
 */
(function () {
  'use strict';

  function dl(obj) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(obj);
  }

  function getSlug() {
    var m = location.pathname.match(/\/restoran\/([^/]+)/);
    return m ? m[1] : null;
  }

  // --- Click delegation ---
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button');
    if (!el) return;

    var href = el.getAttribute('href') || '';

    // 1. WhatsApp click
    if (href.indexOf('wa.me') !== -1) {
      var waNum = href.replace(/[^+\d]/g, '').replace(/^.*(\+\d+).*$/, '$1') ||
                  href.split('wa.me/')[1] && href.split('wa.me/')[1].split('?')[0];
      dl({
        event: 'whatsapp_click',
        wa_destination: waNum || 'unknown',
        page_path: location.pathname,
        restaurant_slug: getSlug()
      });
      return;
    }

    // 2. Telefon click
    if (href.indexOf('tel:') === 0) {
      dl({
        event: 'tel_click',
        tel_number: href.replace('tel:', ''),
        page_path: location.pathname,
        restaurant_slug: getSlug()
      });
      return;
    }

    // 4. "Yorumlar & Detay" click (ana sayfa restoran kartı)
    if (href.indexOf('restoran/') !== -1 && href.indexOf('#reviews') !== -1) {
      var slugMatch = href.match(/restoran\/([^/#]+)/);
      dl({
        event: 'review_card_click',
        restaurant_slug: slugMatch ? slugMatch[1] : 'unknown',
        page_path: location.pathname
      });
      return;
    }
  }, true);

  // 3. Rezervasyon form submit
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('#reserve form, form[data-gtm="reservation"]');
    if (!form) return;
    dl({
      event: 'reservation_submit',
      page_path: location.pathname,
      restaurant_slug: getSlug()
    });
  }, true);

  // 5. Dil değiştirme — .lang-pill click
  document.addEventListener('click', function (e) {
    var pill = e.target.closest('.lang-pill');
    if (!pill) return;
    var lang = pill.dataset.lang || pill.textContent.trim();
    dl({
      event: 'language_change',
      to_lang: lang,
      page_path: location.pathname
    });
  }, true);

  // 6. Section view — #reviews IntersectionObserver (tek seferlik)
  if ('IntersectionObserver' in window) {
    var fired = false;
    var reviewsEl = document.getElementById('reviews');
    if (reviewsEl) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!fired && entry.isIntersecting) {
            fired = true;
            obs.disconnect();
            dl({
              event: 'review_section_view',
              page_path: location.pathname,
              restaurant_slug: getSlug()
            });
          }
        });
      }, { threshold: 0.25 });
      obs.observe(reviewsEl);
    }
  }
})();
