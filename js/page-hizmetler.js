(async () => {
  const data = await KalkanData.load('hizmetler');

  // Tarih
  const fmt = new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric'});
  const dateEl = document.getElementById('today-date'); if(dateEl) dateEl.textContent = fmt.format(new Date());

  // Taksi SVG ikonu
  const taksiSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2M17 17v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2M5 17l1.5-7.5A2 2 0 0 1 8.46 8h7.08a2 2 0 0 1 1.96 1.5L19 17M3 17h18"/></svg>`;

  // --- Nöbetçi Eczane ---
  const ecz = data.nobetciEczane || {};
  const eczName = document.getElementById('ecz-name');
  const eczAddr = document.getElementById('ecz-address');
  const eczPhone = document.getElementById('ecz-phone');
  const eczMap = document.getElementById('ecz-map');
  if (eczName) eczName.textContent = ecz.name || '—';
  if (eczAddr) eczAddr.textContent = ecz.address || '';
  if (eczPhone) { eczPhone.textContent = ecz.phone || ''; eczPhone.href = 'tel:' + (ecz.phone||'').replace(/\s/g,''); }
  if (eczMap) eczMap.href = ecz.mapUrl || '#';

  // --- Acil Numaralar ---
  const acilGrid = document.getElementById('acil-grid');
  if (acilGrid && data.acilNumaralar && data.acilNumaralar.items) {
    acilGrid.innerHTML = data.acilNumaralar.items.map(item => `
      <a href="tel:${KalkanData.escape((item.number||'').replace(/\s/g,''))}"
         class="group bg-white rounded-xl border border-sea-100 p-4 card-hover hover:border-coral-500 transition flex items-center gap-3"
         style="box-shadow:0 1px 3px rgba(7,33,54,0.06),0 4px 16px -6px rgba(7,33,54,0.12);">
        <div class="text-2xl flex-shrink-0">${KalkanData.escape(item.icon||'📞')}</div>
        <div class="min-w-0">
          <div class="font-display font-bold text-sea-800 text-sm leading-tight truncate">${KalkanData.escape(item.name)}</div>
          <div class="font-mono text-sm text-coral-600 font-bold mt-0.5">${KalkanData.escape(item.number)}</div>
        </div>
      </a>`).join('');
  }

  // --- Taksi Durakları ---
  const taksiGrid = document.getElementById('taksi-grid');
  if (taksiGrid && data.taksiler && data.taksiler.items) {
    taksiGrid.innerHTML = data.taksiler.items.map(t => `
      <a href="tel:${KalkanData.escape(t.phoneRaw||t.phone.replace(/\s/g,''))}"
         class="group bg-white rounded-xl border border-sea-100 p-5 card-hover hover:border-sun-500 transition"
         style="box-shadow:0 1px 3px rgba(7,33,54,0.06),0 4px 16px -6px rgba(7,33,54,0.12);">
        <div class="flex items-center justify-between">
          <div class="w-10 h-10 rounded-md bg-sun-500 text-white grid place-items-center tile-icon">${taksiSvg}</div>
          <span class="text-xs text-sea-500">${KalkanData.escape(t.location)}</span>
        </div>
        <div class="font-display font-bold text-sea-800 mt-3">${KalkanData.escape(t.name)}</div>
        <div class="font-mono text-sm text-sea-700 mt-1">${KalkanData.escape(t.phone)}</div>
      </a>`).join('');
  }

  // --- Provider counts ---
  const providerCounts = {};
  try {
    const provRes = await fetch(`data/hizmet-saglayicilari.json?t=${Date.now()}`);
    const provData = await provRes.json();
    Object.entries(provData.services || {}).forEach(([key, svc]) => {
      providerCounts[key] = (svc.providers || []).length;
    });
  } catch(e) { console.error('[Hizmetler] sağlayıcı sayıları okunamadı:', e); }

  // --- Kategori dropdown ---
  const catFilter = document.getElementById('cat-filter');
  const allItems = (data.items || []).map(it => ({ ...it, providerCount: providerCounts[it.id] || 0 }));
  if (catFilter && data.categories) {
    data.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      catFilter.appendChild(opt);
    });
  }

  // --- Items render ---
  function renderItems() {
    const cat = catFilter ? catFilter.value : '';
    const q = document.getElementById('search-input') ? document.getElementById('search-input').value : '';
    const filtered = KalkanData.filterItems(allItems, { category: cat || undefined, q: q || undefined });
    const grid = document.getElementById('items-grid');
    const heading = document.getElementById('items-heading');
    if (heading) heading.textContent = filtered.length + ' Hizmet';
    if (grid) grid.innerHTML = filtered.map(it => KalkanData.hizmetCard(it)).join('');
  }

  renderItems();
  if (catFilter) catFilter.addEventListener('change', renderItems);
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', renderItems);
})();
