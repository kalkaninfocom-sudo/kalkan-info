(async () => {
  const data = await KalkanData.load('plajlar');
  const grid = document.getElementById('card-grid');
  const searchEl = document.getElementById('search-input');
  const catEl = document.getElementById('category-filter');

  if (catEl && data.categories) {
    catEl.innerHTML = '<option value="">Tüm Kategoriler</option>' +
      data.categories.map(c => `<option>${c}</option>`).join('');
  }

  function render() {
    const items = KalkanData.filterItems(data.items, {
      q: searchEl ? searchEl.value : '',
      category: catEl ? catEl.value : ''
    });
    grid.innerHTML = items.map(KalkanData.plajCard).join('') ||
      '<div class="col-span-full text-center py-12 text-ink-700/60">Sonuç bulunamadı.</div>';
  }
  let searchDebounce = 0;
  if (searchEl) searchEl.addEventListener('input', () => {
    render();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const q = (searchEl.value || '').trim();
      if (q.length >= 2 && window.plausibleEvent) {
        window.plausibleEvent('search', { page: 'plajlar', query_len: String(q.length) });
      }
    }, 600);
  });
  if (catEl) catEl.addEventListener('change', () => {
    render();
    if (window.plausibleEvent && catEl.value) {
      window.plausibleEvent('category_filter', { page: 'plajlar', category: catEl.value });
    }
  });
  render();
})();
