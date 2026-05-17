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
    s.textContent = `
      [data-lang-toggle]{transition:color .15s ease,background .15s ease;}
      [data-lang-toggle].lang-active{color:#f4b53d!important;font-weight:800;}
      #ki-lang-switcher{position:fixed;top:14px;right:14px;z-index:9995;display:flex;align-items:center;gap:0;background:rgba(7,33,54,0.78);backdrop-filter:blur(10px);border:1px solid rgba(244,181,61,0.3);border-radius:9999px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.25);font-family:'Inter',system-ui,sans-serif;}
      #ki-lang-switcher button{background:transparent;border:0;color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:0.04em;padding:5px 10px;border-radius:9999px;cursor:pointer;transition:all .18s ease;min-width:32px;}
      #ki-lang-switcher button.lang-active{background:#f4b53d;color:#0a2e4c!important;font-weight:800!important;box-shadow:0 1px 4px rgba(244,181,61,0.4);}
      #ki-lang-switcher button:not(.lang-active):hover{color:#fff;background:rgba(255,255,255,0.08);}
      #ki-lang-switcher button:disabled{opacity:0.45;cursor:not-allowed;}
      @media (max-width:640px){#ki-lang-switcher{top:10px;right:10px;padding:3px;}#ki-lang-switcher button{padding:4px 8px;font-size:10px;min-width:28px;}}
    `;
    document.head.appendChild(s);
  }

  function injectSwitcher() {
    if (document.getElementById('ki-lang-switcher')) return;
    const el = document.createElement('div');
    el.id = 'ki-lang-switcher';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Dil seçimi / Language');
    el.innerHTML = `
      <button type="button" data-lang-toggle="en" title="English" aria-label="English">EN</button>
      <button type="button" data-lang-toggle="tr" title="Türkçe" aria-label="Türkçe">TR</button>
      <button type="button" disabled title="Deutsch — yakında" aria-label="Deutsch (yakında)">DE</button>
      <button type="button" disabled title="Русский — yakında" aria-label="Русский (yakında)">RU</button>
      <button type="button" disabled title="Français — yakında" aria-label="Français (yakında)">FR</button>
    `;
    document.body.appendChild(el);
  }

  function bindToggleHandlers() {
    // CSP nedeniyle inline onclick yok — addEventListener ile bağla
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
      if (btn._i18nBound) return;
      btn._i18nBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.langToggle;
        if (target === 'en' || target === 'tr') {
          window.KalkanI18n.set(target);
        }
      });
    });
  }

  function init() {
    injectStyles();
    injectSwitcher();
    bindToggleHandlers();
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
