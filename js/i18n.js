(function () {
  'use strict';

  const STORAGE_KEY = 'lang';
  const DEFAULT_LANG = 'en';
  const SUPPORTED = ['en', 'tr', 'de', 'ru', 'fr'];

  function detectLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    return DEFAULT_LANG;
  }

  // attr type → dataset key mapping
  // For lang 'en': use data-en / data-en-html / etc.
  // For lang 'tr': use data-tr (captured at runtime) or original
  // For lang 'de'/'ru'/'fr': use data-de / data-ru / data-fr, fallback → en → tr
  // Compose camelCase dataset key: ('en','html') → 'enHtml', ('de','') → 'de'
  function dsKey(l, t) {
    if (!t) return l;
    return l + t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Get translated value for element, with fallback chain: target → en → tr
  function getLangAttr(el, type, lang) {
    if (lang === 'en') return el.dataset[dsKey('en', type)] || null;
    if (lang === 'tr') return el.dataset[dsKey('tr', type)] || null;
    // de/ru/fr: try target lang, then en, then tr
    return el.dataset[dsKey(lang, type)]
      || el.dataset[dsKey('en', type)]
      || el.dataset[dsKey('tr', type)]
      || null;
  }

  function apply(lang) {
    document.documentElement.lang = lang;

    // Text content: data-en="English text" + data-de/ru/fr
    document.querySelectorAll('[data-en]').forEach(el => {
      if (!el.dataset.tr) {
        el.dataset.tr = el.textContent.trim();
      }
      const val = getLangAttr(el, '', lang);
      if (val !== null) el.textContent = val;
    });

    // HTML content: data-en-html
    document.querySelectorAll('[data-en-html]').forEach(el => {
      if (!el.dataset.trHtml) el.dataset.trHtml = el.innerHTML;
      const val = getLangAttr(el, 'html', lang);
      if (val !== null) el.innerHTML = val;
    });

    // Placeholder: data-en-placeholder
    document.querySelectorAll('[data-en-placeholder]').forEach(el => {
      if (!el.dataset.trPlaceholder) el.dataset.trPlaceholder = el.getAttribute('placeholder') || '';
      const val = getLangAttr(el, 'placeholder', lang);
      if (val !== null) el.setAttribute('placeholder', val);
    });

    // Title attribute: data-en-title
    document.querySelectorAll('[data-en-title]').forEach(el => {
      if (!el.dataset.trTitle) el.dataset.trTitle = el.getAttribute('title') || '';
      const val = getLangAttr(el, 'title', lang);
      if (val !== null) el.setAttribute('title', val);
    });

    // Alt attribute: data-en-alt
    document.querySelectorAll('[data-en-alt]').forEach(el => {
      if (!el.dataset.trAlt) el.dataset.trAlt = el.getAttribute('alt') || '';
      const val = getLangAttr(el, 'alt', lang);
      if (val !== null) el.setAttribute('alt', val);
    });

    // Aria-label: data-en-aria
    document.querySelectorAll('[data-en-aria]').forEach(el => {
      if (!el.dataset.trAria) el.dataset.trAria = el.getAttribute('aria-label') || '';
      const val = getLangAttr(el, 'aria', lang);
      if (val !== null) el.setAttribute('aria-label', val);
    });

    // EN-only elements: visible in EN, hidden in others
    document.querySelectorAll('[data-en-only]').forEach(el => {
      el.style.display = (lang === 'en') ? '' : 'none';
    });

    // Toggle pill state
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
      const target = btn.dataset.langToggle;
      btn.classList.toggle('lang-active', target === lang);
      btn.setAttribute('aria-pressed', String(target === lang));
    });

    // Bildirim: dinamik JSON-render kart kodları bunu dinleyip yeniden render eder.
    try {
      document.dispatchEvent(new CustomEvent('kalkanlangchange', { detail: { lang } }));
    } catch (e) { /* ignore */ }
  }

  window.KalkanI18n = {
    get: () => detectLang(),
    set: function (lang) {
      if (!SUPPORTED.includes(lang)) return;
      var from = detectLang();
      localStorage.setItem(STORAGE_KEY, lang);
      apply(lang);
      if (from !== lang) {
        try {
          if (window.plausibleEvent) {
            window.plausibleEvent('lang_switch', {
              from: from,
              to: lang,
              page: location.pathname
            });
          }
        } catch (e) {}
      }
    },
    toggle: function () {
      const cur = detectLang();
      const idx = SUPPORTED.indexOf(cur);
      this.set(SUPPORTED[(idx + 1) % SUPPORTED.length]);
    },
    list: () => SUPPORTED.slice(),
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
      /* Mobile: pin to top-left to avoid hamburger collision */
      @media (max-width:640px){#ki-lang-switcher{top:8px;left:8px;right:auto;padding:3px;}#ki-lang-switcher button{padding:4px 7px;font-size:10px;min-width:26px;}}
      /* Drawer-mounted language chips */
      .ki-drawer-lang{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
      .ki-drawer-lang button{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:0.04em;padding:8px 4px;border-radius:8px;cursor:pointer;transition:all .15s ease;font-family:'Inter',system-ui,sans-serif;}
      .ki-drawer-lang button:hover{background:rgba(244,181,61,0.15);border-color:rgba(244,181,61,0.4);color:#fff;}
      .ki-drawer-lang button.lang-active{background:#f4b53d;color:#0a2e4c!important;border-color:#f4b53d;box-shadow:0 1px 4px rgba(244,181,61,0.4);}
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
      <button type="button" data-lang-toggle="de" title="Deutsch" aria-label="Deutsch">DE</button>
      <button type="button" data-lang-toggle="ru" title="Русский" aria-label="Русский">RU</button>
      <button type="button" data-lang-toggle="fr" title="Français" aria-label="Français">FR</button>
    `;
    document.body.appendChild(el);
  }

  function bindToggleHandlers() {
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
      if (btn._i18nBound) return;
      btn._i18nBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.dataset.langToggle;
        if (SUPPORTED.includes(target)) {
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
      let needsApply = false;
      let needsBind = false;
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            node.matches?.('[data-en],[data-en-html],[data-en-placeholder],[data-en-title],[data-en-alt],[data-en-aria],[data-en-only]') ||
            node.querySelector?.('[data-en],[data-en-html],[data-en-placeholder],[data-en-title],[data-en-alt],[data-en-aria],[data-en-only]')
          ) needsApply = true;
          if (
            node.matches?.('[data-lang-toggle]') ||
            node.querySelector?.('[data-lang-toggle]')
          ) needsBind = true;
        }
      }
      if (needsBind) bindToggleHandlers();
      if (needsApply) apply(detectLang());
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
