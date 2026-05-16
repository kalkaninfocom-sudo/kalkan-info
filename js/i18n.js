(function () {
  'use strict';

  const STORAGE_KEY = 'lang';
  const DEFAULT_LANG = 'en'; // Berkay default EN istiyor
  const SUPPORTED = ['en', 'tr'];

  function detectLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    return DEFAULT_LANG;
  }

  function apply(lang) {
    document.documentElement.lang = lang;

    // Text content: data-en="English text"
    document.querySelectorAll('[data-en]').forEach(el => {
      if (!el.dataset.tr) {
        // Orijinal Türkçe metni sakla — innerHTML değil, sadece textContent
        // (child element içeren node'ları bozmayalım: data-en sadece pure-text node'larda kullanılmalı)
        el.dataset.tr = el.textContent;
      }
      el.textContent = (lang === 'en') ? el.dataset.en : el.dataset.tr;
    });

    // HTML content (rich): data-en-html="<b>English</b>"
    document.querySelectorAll('[data-en-html]').forEach(el => {
      if (!el.dataset.trHtml) el.dataset.trHtml = el.innerHTML;
      el.innerHTML = (lang === 'en') ? el.dataset.enHtml : el.dataset.trHtml;
    });

    // Placeholder: data-en-placeholder="Search..."
    document.querySelectorAll('[data-en-placeholder]').forEach(el => {
      if (!el.dataset.trPlaceholder) el.dataset.trPlaceholder = el.getAttribute('placeholder') || '';
      el.setAttribute('placeholder', (lang === 'en') ? el.dataset.enPlaceholder : el.dataset.trPlaceholder);
    });

    // Title attribute: data-en-title="..."
    document.querySelectorAll('[data-en-title]').forEach(el => {
      if (!el.dataset.trTitle) el.dataset.trTitle = el.getAttribute('title') || '';
      el.setAttribute('title', (lang === 'en') ? el.dataset.enTitle : el.dataset.trTitle);
    });

    // Alt attribute: data-en-alt="..."
    document.querySelectorAll('[data-en-alt]').forEach(el => {
      if (!el.dataset.trAlt) el.dataset.trAlt = el.getAttribute('alt') || '';
      el.setAttribute('alt', (lang === 'en') ? el.dataset.enAlt : el.dataset.trAlt);
    });

    // Aria-label: data-en-aria="..."
    document.querySelectorAll('[data-en-aria]').forEach(el => {
      if (!el.dataset.trAria) el.dataset.trAria = el.getAttribute('aria-label') || '';
      el.setAttribute('aria-label', (lang === 'en') ? el.dataset.enAria : el.dataset.trAria);
    });

    // Toggle pill state
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
      const target = btn.dataset.langToggle;
      btn.classList.toggle('lang-active', target === lang);
      btn.setAttribute('aria-pressed', String(target === lang));
    });
  }

  window.KalkanI18n = {
    get: () => detectLang(),
    set: function (lang) {
      if (!SUPPORTED.includes(lang)) return;
      localStorage.setItem(STORAGE_KEY, lang);
      apply(lang);
    },
    toggle: function () {
      this.set(detectLang() === 'en' ? 'tr' : 'en');
    },
    apply: apply
  };

  // Global short aliases for inline onclick
  window.setLang = (l) => window.KalkanI18n.set(l);

  function injectStyles() {
    if (document.getElementById('ki-i18n-styles')) return;
    const s = document.createElement('style');
    s.id = 'ki-i18n-styles';
    s.textContent = '[data-lang-toggle]{transition:color .15s ease,background .15s ease;}[data-lang-toggle].lang-active{color:#f4b53d!important;font-weight:800;}';
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    apply(detectLang());
    // Geç gelen kart/list render'lar için de uygula
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && (
            node.matches?.('[data-en],[data-en-html],[data-en-placeholder],[data-en-title],[data-en-alt],[data-en-aria]') ||
            node.querySelector?.('[data-en],[data-en-html],[data-en-placeholder],[data-en-title],[data-en-alt],[data-en-aria]')
          )) {
            apply(detectLang());
            return;
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
