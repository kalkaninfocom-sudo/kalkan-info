(async () => {
  const data = await KalkanData.load('restoranlar');
  const grid = document.getElementById('card-grid');
  const searchEl = document.getElementById('search-input');
  const catEl = document.getElementById('category-filter');
  const counter = document.getElementById('result-count');

  // ── Dynamic hero/section title from data._meta (5-lang) ───────────────────
  // The HTML carries data-en/de/ru/fr fallback attributes; we OVERWRITE them
  // here from JSON so a single source of truth (data/restoranlar.json) drives
  // the title across all langs. js/i18n.js MutationObserver re-applies after
  // we mutate.
  function applyMetaI18n(selector, dict, baseTR) {
    if (!dict && !baseTR) return;
    document.querySelectorAll(selector).forEach(el => {
      if (baseTR) el.textContent = baseTR;
      if (!dict) return;
      ['en','de','ru','fr'].forEach(lng => {
        if (dict[lng]) el.setAttribute(`data-${lng}`, dict[lng]);
      });
    });
  }

  const meta = data._meta || {};
  applyMetaI18n('[data-meta="title"]', meta.titleI18n, meta.title);
  applyMetaI18n('[data-meta="subtitle"]', meta.subtitleI18n, meta.subtitle);

  // ── Category filter (with i18n placeholder for "All Categories") ──────────
  if (data.categories) {
    catEl.innerHTML = '<option value="" data-en="All Categories" data-de="Alle Kategorien" data-ru="Все категории" data-fr="Toutes les catégories">Tüm Kategoriler</option>'
      + data.categories.map(c => `<option>${c}</option>`).join('');
  }

  // ── Counter labels by language ────────────────────────────────────────────
  const LABELS = {
    tr: 'mekan',
    en: 'venues',
    de: 'Lokale',
    ru: 'заведений',
    fr: 'établissements'
  };
  function currentLang() {
    try {
      const stored = localStorage.getItem('lang');
      if (stored && LABELS[stored]) return stored;
    } catch(e){}
    return document.documentElement.lang || 'tr';
  }
  function applyCounter(n) {
    if (!counter) return;
    counter.textContent = `${n} ${LABELS[currentLang()] || LABELS.tr}`;
    // Also write multi-lang attrs so manual switcher updates label without re-render
    ['en','de','ru','fr'].forEach(lng => counter.setAttribute(`data-${lng}`, `${n} ${LABELS[lng]}`));
  }

  function render() {
    const items = KalkanData.filterItems(data.items, { q: searchEl.value, category: catEl.value });
    grid.innerHTML = items.map(KalkanData.restoranCard).join('')
      || '<div class="col-span-full text-center py-12 text-sea-700/60" data-en="No results." data-de="Keine Ergebnisse." data-ru="Нет результатов." data-fr="Aucun résultat.">Sonuç bulunamadı.</div>';
    applyCounter(items.length);
  }
  // Search & filter — debounce + plausible
  let searchDebounce = 0;
  searchEl.addEventListener('input', () => {
    render();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const q = (searchEl.value || '').trim();
      if (q.length >= 2 && window.plausibleEvent) {
        window.plausibleEvent('search', {
          page: 'restoranlar',
          query_len: String(q.length)
        });
      }
    }, 600);
  });
  catEl.addEventListener('change', () => {
    render();
    if (window.plausibleEvent && catEl.value) {
      window.plausibleEvent('category_filter', {
        page: 'restoranlar',
        category: catEl.value
      });
    }
  });
  render();
})();
