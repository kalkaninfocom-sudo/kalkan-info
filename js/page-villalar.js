(async () => {
  const data = await KalkanData.load('villalar');
  const grid = document.getElementById('card-grid');
  const searchEl = document.getElementById('search-input');
  const catEl = document.getElementById('category-filter');
  if (catEl && data.categories) {
    catEl.innerHTML = '<option value="">Tüm Kategoriler</option>' + data.categories.map(c => `<option>${c}</option>`).join('');
  }
  function render() {
    const items = KalkanData.filterItems(data.items, { q: searchEl?.value || '', category: catEl?.value || '' });
    grid.innerHTML = items.map(KalkanData.villaCard).join('') || '<div class="col-span-full text-center py-12 text-sea-700/60">Sonuç bulunamadı.</div>';
  }
  searchEl?.addEventListener('input', render);
  catEl?.addEventListener('change', render);
  render();
})();

/* Villa carousel — gallery slide kontrolü, hover arrows, dot navigation, swipe */
(function() {
  function setSlide(card, idx) {
    const slides = card.querySelectorAll('.villa-slide');
    const dots   = card.querySelectorAll('.villa-dot');
    if (!slides.length) return;
    const n = slides.length;
    const next = ((idx % n) + n) % n;
    slides.forEach((s, i) => s.style.opacity = (i === next ? 1 : 0));
    dots.forEach((d, i) => d.style.background = (i === next ? '#fff' : 'rgba(255,255,255,0.45)'));
    card.dataset.cur = next;
  }
  function curIdx(card) { return parseInt(card.dataset.cur || '0', 10); }

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.villa-card');
    if (!card) return;
    if (e.target.closest('.villa-prev')) { e.preventDefault(); setSlide(card, curIdx(card) - 1); return; }
    if (e.target.closest('.villa-next')) { e.preventDefault(); setSlide(card, curIdx(card) + 1); return; }
    const dot = e.target.closest('.villa-dot');
    if (dot) { e.preventDefault(); setSlide(card, parseInt(dot.dataset.idx, 10)); return; }
  });

  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.villa-card')) return;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const card = e.target.closest('.villa-card');
    if (!card) return;
    const dx = (e.changedTouches[0].clientX - touchStartX);
    if (Math.abs(dx) < 40) return;
    setSlide(card, curIdx(card) + (dx < 0 ? 1 : -1));
  });

  document.addEventListener('keydown', (e) => {
    const card = document.activeElement?.closest?.('.villa-card');
    if (!card) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setSlide(card, curIdx(card) - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setSlide(card, curIdx(card) + 1); }
  });
})();
