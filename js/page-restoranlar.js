(async () => {
  const data = await KalkanData.load('restoranlar');
  const grid = document.getElementById('card-grid');
  const searchEl = document.getElementById('search-input');
  const catEl = document.getElementById('category-filter');
  const counter = document.getElementById('result-count');

  if (data.categories) {
    catEl.innerHTML = '<option value="">Tüm Kategoriler</option>' + data.categories.map(c => `<option>${c}</option>`).join('');
  }
  function render() {
    const items = KalkanData.filterItems(data.items, { q: searchEl.value, category: catEl.value });
    grid.innerHTML = items.map(KalkanData.restoranCard).join('') || '<div class="col-span-full text-center py-12 text-sea-700/60">Sonuç bulunamadı.</div>';
    counter.textContent = `${items.length} mekan`;
  }
  searchEl.addEventListener('input', render);
  catEl.addEventListener('change', render);
  render();
})();
