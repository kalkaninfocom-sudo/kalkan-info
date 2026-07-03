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

  // Kategori listesi linki olan özet kart (berber/kuaför aggregate kartları için)
  function listUrlCard(it) {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    // {tr,en,de,ru,fr} i18n objesinden data-en/de/ru/fr attribute üret (i18n.js MutationObserver çevirir).
    const i18nAttr = obj => !obj || typeof obj !== 'object' ? '' :
      ['en','de','ru','fr'].map(l => (typeof obj[l] === 'string' && obj[l].trim()) ? `data-${l}="${esc(obj[l])}"` : '').filter(Boolean).join(' ');
    const detAt = i => { const m = it.detailsI18n; if (!m) return ''; const o = {}; ['en','de','ru','fr'].forEach(l => { if (Array.isArray(m[l]) && m[l][i]) o[l] = m[l][i]; }); return i18nAttr(o); };
    const details = (it.details || []).map((d, i) => `<li class="flex items-start gap-1.5 text-xs text-ink-700/70"><span class="text-sea-600">•</span><span ${detAt(i)}>${esc(d)}</span></li>`).join('');
    const imageBlock = it.image ? `<div class="relative aspect-[16/9] overflow-hidden rounded-lg mb-3 -mx-1"><img src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;"><div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(7,33,54,0.55) 100%);"></div></div>` : '';
    return `
      <a href="${esc(it.listUrl)}" class="card block" style="background:white;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);text-decoration:none;color:inherit;transition:transform 0.2s ease,box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.2)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(7,33,54,0.08)';">
        ${imageBlock}
        <div class="flex items-start gap-3">
          <div class="text-3xl">${esc(it.icon || '✂️')}</div>
          <div class="flex-1 min-w-0">
            <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight" ${i18nAttr(it.nameI18n)}>${esc(it.name)}</h3>
            <div class="text-[11px] text-ink-700/60 uppercase tracking-wide mt-0.5">${esc(it.category || '')}</div>
          </div>
        </div>
        <p class="text-sm text-ink-700/80 mt-3" ${i18nAttr(it.summaryI18n)}>${esc(it.summary || '')}</p>
        ${details ? `<ul class="mt-3 space-y-1">${details}</ul>` : ''}
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8 gap-2">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-sea-700 uppercase tracking-wide">
            Tümünü Gör →
          </span>
          ${it.hours ? `<span class="text-[11px] text-ink-700/50">${esc(it.hours)}</span>` : ''}
        </div>
      </a>
    `;
  }

  // Google Maps kaynaklı (yeni keşfedilen) mekan kartı — direkt detay sayfasına link
  function googleMapsCard(it) {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const rating = it.rating
      ? `<span class="inline-flex items-center gap-1 bg-sun-50 text-sun-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-sun-200">⭐ ${it.rating}${it.reviewCount ? ` · ${it.reviewCount}` : ''}</span>`
      : '';
    const summary = it.summary || `Kalkan'da ${it.category || 'hizmet'}.`;
    return `
      <a href="/hizmet/${esc(it.id)}/" class="card block" style="background:white;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);text-decoration:none;color:inherit;transition:transform 0.2s ease,box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.2)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(7,33,54,0.08)';">
        <div class="flex items-start gap-3">
          <div class="text-3xl">🏪</div>
          <div class="flex-1 min-w-0">
            <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight">${esc(it.name)}</h3>
            <div class="text-[11px] text-ink-700/60 uppercase tracking-wide mt-0.5">${esc(it.category || '')}</div>
          </div>
          ${rating}
        </div>
        <p class="text-sm text-ink-700/70 mt-3 line-clamp-2">${esc(summary)}</p>
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8 gap-2">
          <span class="inline-flex items-center gap-1.5 text-[10px] font-semibold text-sea-600/70 uppercase tracking-wide">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
            Google'da keşfedildi
          </span>
          ${it.hours ? `<span class="text-[10px] text-ink-700/50">${esc(typeof it.hours === 'string' ? it.hours.split(' · ')[0] : '')}</span>` : ''}
        </div>
      </a>
    `;
  }

  // --- Items render ---
  // Ana view'da bireysel kuaför/berber kayıtları aggregate kart altında toplanır.
  // Sadece kategori filtresi veya arama yapıldığında bireysel kayıtlar görünür.
  // Ana view'da bireysel kayıtları aggregate kart altında toplayan kategoriler.
  const AGGREGATE_HIDE_CATS = new Set(['Erkek Kuaförü & Berber', 'Bayan Kuaförü', 'Saç & Güzellik (Unisex)', 'Su Sporları']);
  function renderItems() {
    const cat = catFilter ? catFilter.value : '';
    const q = document.getElementById('search-input') ? document.getElementById('search-input').value : '';
    let filtered = KalkanData.filterItems(allItems, { category: cat || undefined, q: q || undefined });
    if (!cat && !q) {
      filtered = filtered.filter(it => !AGGREGATE_HIDE_CATS.has(it.category) || it.listUrl);
    }
    const grid = document.getElementById('items-grid');
    const heading = document.getElementById('items-heading');
    if (heading) heading.textContent = filtered.length + ' Hizmet';
    if (grid) grid.innerHTML = filtered.map(it => {
      if (it.listUrl) return listUrlCard(it);
      return it.source === 'google_maps' ? googleMapsCard(it) : KalkanData.hizmetCard(it);
    }).join('');
  }

  // URL ?cat= parametresiyle kategori filtresi ön seçimi (listUrlCard linklerinden gelir)
  const urlCat = new URLSearchParams(location.search).get('cat');
  if (urlCat && catFilter) {
    catFilter.value = urlCat;
  }

  renderItems();
  if (catFilter) catFilter.addEventListener('change', renderItems);
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', renderItems);
})();
