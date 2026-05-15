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
  if (searchEl) searchEl.addEventListener('input', render);
  if (catEl) catEl.addEventListener('change', render);
  render();
})();
