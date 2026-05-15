(async () => {
  const data = await KalkanData.load('turlar');
  const grid = document.getElementById('card-grid');
  function render() {
    const items = (data.items || []);
    grid.innerHTML = items.map(KalkanData.turCard).join('') || '<div class="col-span-full text-center py-12 text-sea-700/60">Henüz tur yok.</div>';
  }
  render();
})();
