/* page-antik-kentler.js — Antik Kentler sayfası render + harita + tüm kentler */

// 10 öncelikli kent — alt-sayfası /antik-kentler/<slug>.html üzerinden açılır
const SUBPAGE_SLUGS = new Set([
  'patara', 'xanthos', 'letoon', 'tlos', 'pinara',
  'simena', 'antiphellos', 'myra', 'andriake', 'aperlae'
]);

// ── Harita ────────────────────────────────────────────────────────────────────
(async function loadLikyaMap() {
  const likyaMapEl = document.getElementById('likya-map');
  if (!likyaMapEl) return;

  const likyaMap = L.map('likya-map', { scrollWheelZoom: false }).setView([36.35, 29.55], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(likyaMap);

  const categoryColors = {
    'UNESCO Mirası': '#e89812',
    'Likya': '#1a5e93',
    'Roma': '#1a5e93',
    'Denizden': '#10b981',
    'Kalede': '#1a5e93'
  };

  let cityData = null;
  try {
    cityData = await fetch('/data/antik-kentler.json').then(r => r.json());
  } catch(e) {
    console.warn('antik-kentler.json yüklenemedi', e);
  }

  window.cityMarkers = window.cityMarkers || [];
  window._likyaMap = likyaMap;

  if (cityData && cityData.items) {
    cityData.items.forEach(city => {
      if (!city.lat || !city.lng) return;
      const color = categoryColors[city.category] || '#1a5e93';
      const radius = city.featured ? 11 : 8;
      const marker = L.circleMarker([city.lat, city.lng], {
        radius: radius,
        fillColor: color,
        color: '#fff',
        weight: 2.5,
        fillOpacity: 0.92
      }).addTo(likyaMap);

      const shortSummary = (city.summary || '').substring(0, 140);
      const hasMore = (city.summary || '').length > 140;
      const featuredBadge = city.featured ? '<span style="display:inline-block;background:#10b981;color:white;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700;margin-left:6px;">★ Öne Çıkan</span>' : '';
      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:210px;padding:0;">
          <div style="font-family:'Montserrat',sans-serif;font-size:15px;font-weight:800;color:#0a2e4c;margin-bottom:3px;">${city.name}${featuredBadge}</div>
          <div style="font-size:11px;color:#1a5e93;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${city.category}</div>
          <div style="font-size:12px;color:#11304d;line-height:1.5;margin-bottom:8px;">${shortSummary}${hasMore ? '...' : ''}</div>
          <div style="font-size:11px;color:#666;margin-bottom:8px;">📍 ${city.distance || ''} &nbsp;·&nbsp; ⏱ ${city.duration || ''}</div>
          ${SUBPAGE_SLUGS.has(city.id)
            ? `<a href="antik-kentler/${city.id}.html" style="display:inline-block;padding:6px 14px;background:#e89812;color:#0a2e4c;border-radius:6px;font-weight:800;font-size:12px;text-decoration:none;font-family:'Montserrat',sans-serif;">Tam Sayfa →</a>`
            : `<button onclick="openDetail('${city.id}')" style="display:inline-block;padding:6px 14px;background:#e89812;color:#0a2e4c;border:none;border-radius:6px;font-weight:800;font-size:12px;cursor:pointer;font-family:'Montserrat',sans-serif;">Detayları Gör →</button>`}
        </div>
      `, { maxWidth: 260 });

      window.cityMarkers.push({ marker, city });
    });
  }

  window.filterLikyaMap = function(category) {
    if (!window.cityMarkers) return;
    window.cityMarkers.forEach(({ marker, city }) => {
      const match = !category || city.category === category;
      if (match) {
        if (!likyaMap.hasLayer(marker)) marker.addTo(likyaMap);
      } else {
        if (likyaMap.hasLayer(marker)) likyaMap.removeLayer(marker);
      }
    });
  };

  const lycianWayCoords = [
    [36.5530, 29.1308],[36.5436, 29.1333],[36.5180, 29.1520],[36.4800, 29.1800],
    [36.4108, 29.2253],[36.4847, 29.2607],[36.3556, 29.3203],[36.3303, 29.3079],
    [36.2640, 29.3147],[36.2658, 29.4118],[36.2683, 29.6917],[36.2014, 29.6394],
    [36.1800, 29.7300],[36.1980, 29.7950],[36.1600, 29.7660],[36.1900, 29.8625],
    [36.2433, 29.8550],[36.2580, 29.9854],[36.2233, 29.9433],[36.2800, 30.1500],
    [36.3200, 30.2800],[36.3980, 30.4700],[36.5236, 30.5550]
  ];

  L.polyline(lycianWayCoords, {
    color: '#e74c3c',
    weight: 3,
    opacity: 0.85,
    dashArray: '7, 7'
  }).addTo(likyaMap).bindPopup(`
    <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:14px;color:#0a2e4c;">Likya Yolu</div>
    <div style="font-size:12px;color:#444;margin-top:4px;">540 km · 19 etap<br>Fethiye → Antalya</div>
  `);

  likyaMap.fitBounds([[36.15, 29.10], [36.60, 30.20]], { padding: [20, 20] });

  let stagesData = null;
  try {
    const res = await fetch('/data/likya-yolu.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    stagesData = await res.json();
  } catch(e) {
    console.warn('likya-yolu.json yüklenemedi', e);
  }

  if (!stagesData || !stagesData.stages) {
    const sc = document.getElementById('lycian-stages');
    if (sc) sc.innerHTML = '<div class="col-span-full text-center py-8 text-sea-700/50 text-sm">Etap verisi yüklenemedi.</div>';
    const tb = document.getElementById('all-stages-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-sea-700/50">Veri yüklenemedi.</td></tr>';
  }

  if (stagesData && stagesData.stages) {
    const kalkanStages = stagesData.stages.filter(s => {
      const text = (s.from + ' ' + s.to + ' ' + (s.highlights || []).join(' ')).toLowerCase();
      return /kalkan|kaş|patara|xanthos|letoon|phellos|kekova|simena|üçağız|apollonia|bezirgan|antiphellos/.test(text);
    }).slice(0, 6);

    const stagesContainer = document.getElementById('lycian-stages');
    if (stagesContainer) {
      if (kalkanStages.length === 0) {
        stagesContainer.innerHTML = '<div class="col-span-full text-center py-8 text-sea-700/50 text-sm">Etap verisi bulunamadı.</div>';
      } else {
        const difficultyColor = {
          'Kolay': 'bg-sun-50 text-sun-700',
          'Kolay-Orta': 'bg-sky-50 text-sky-700',
          'Orta': 'bg-blue-50 text-blue-700',
          'Orta-Zor': 'bg-orange-50 text-orange-700',
          'Zor': 'bg-red-50 text-red-700'
        };
        stagesContainer.innerHTML = kalkanStages.map(s => `
          <div class="bg-white rounded-xl p-5 border border-sea-100 hover:shadow-[0_4px_20px_-4px_rgba(13,58,95,0.2)] transition-shadow">
            <div class="flex items-center justify-between mb-3">
              <div class="text-xs font-bold text-sun-500 tracking-wider uppercase font-display">Etap ${s.id}</div>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${difficultyColor[s.difficulty] || 'bg-sea-50 text-sea-700'}">${s.difficulty}</span>
            </div>
            <h4 class="font-display font-extrabold text-sea-800 leading-tight text-base">${s.from} → ${s.to}</h4>
            <div class="flex items-center gap-3 text-xs text-sea-700/70 mt-2 mb-3">
              <span>📏 ${s.distance}</span>
              <span>⏱ ${s.duration}</span>
            </div>
            <ul class="space-y-1">
              ${(s.highlights || []).slice(0, 3).map(h => `<li class="text-xs text-sea-700/80 flex gap-1.5 items-start"><span class="text-sun-500 mt-0.5 flex-shrink-0">•</span><span>${h}</span></li>`).join('')}
            </ul>
          </div>
        `).join('');
      }
    }

    const tbody = document.getElementById('all-stages-tbody');
    if (tbody) {
      const diffBadge = {
        'Kolay': 'background:#dcfce7;color:#15803d',
        'Kolay-Orta': 'background:#e0f2fe;color:#0369a1',
        'Orta': 'background:#dbeafe;color:#1d4ed8',
        'Orta-Zor': 'background:#ffedd5;color:#c2410c',
        'Zor': 'background:#fee2e2;color:#b91c1c'
      };
      const isKalkanRegion = id => id >= 7 && id <= 14;
      tbody.innerHTML = stagesData.stages.map(s => `
        <tr class="${isKalkanRegion(s.id) ? 'bg-sun-400/5' : ''} border-b border-sea-50 hover:bg-sea-50/50 transition-colors">
          <td class="px-4 py-3 font-display font-extrabold text-sea-800 text-sm">${s.id}</td>
          <td class="px-4 py-3 text-sea-800 font-medium text-sm">${s.from}</td>
          <td class="px-4 py-3 text-sea-800 font-medium text-sm">${s.to}${isKalkanRegion(s.id) ? ' <span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:10px;font-weight:700;margin-left:4px;">Kalkan Bölgesi</span>' : ''}</td>
          <td class="px-4 py-3 text-sea-700 text-sm">${s.distance}</td>
          <td class="px-4 py-3 text-sea-700 text-sm">${s.duration}</td>
          <td class="px-4 py-3"><span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;${diffBadge[s.difficulty] || 'background:#e2e8f0;color:#334155'}">${s.difficulty}</span></td>
        </tr>
      `).join('');
    }
  }
})();

// ── Kart render + filtre + arama + detay modal ────────────────────────────────

let allItems = [], currentFilter = '';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function categoryBadgeStyle(cat) {
  if (cat === 'UNESCO Mirası') return 'background:#e89812;color:#0a2e4c;';
  if (cat === 'Denizden')      return 'background:#10b981;color:#fff;';
  return 'background:#1a5e93;color:#fff;';
}

function antikCard(city) {
  const tags = (city.tags || []).slice(0, 3).map(t =>
    `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sea-600/10 text-sea-600">${esc(t)}</span>`
  ).join('');

  const featuredRibbon = city.featured
    ? `<span class="absolute top-3 right-3 bg-sun-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow z-10">★ Öne Çıkan</span>`
    : '';

  const imgSrc = city.image || '';
  const imgHtml = imgSrc
    ? `<img src="${esc(imgSrc)}" alt="${esc(city.name)}" class="w-full h-full object-cover" loading="lazy" decoding="async" onerror="this.style.display='none'">`
    : `<div class="w-full h-full grid place-items-center text-4xl" style="background:linear-gradient(135deg,#0a2e4c 0%,#1a5e93 100%);color:#f4b53d;">🏛️</div>`;

  const entryFee = city.entryFee
    ? `<span class="text-[11px] text-sea-700/70">🎫 ${esc(city.entryFee)}</span>`
    : '';
  const hours = city.hours
    ? `<span class="text-[11px] text-sea-700/70">🕐 ${esc(city.hours)}</span>`
    : '';

  return `
    <article class="bg-white rounded-2xl overflow-hidden border border-sea-100 shadow-sm hover:shadow-[0_4px_24px_-4px_rgba(13,58,95,0.22)] transition-shadow cursor-pointer group" onclick="openDetail('${esc(city.id)}')">
      <div class="relative aspect-[16/10] overflow-hidden">
        ${imgHtml}
        ${featuredRibbon}
        <div class="absolute inset-0 bg-gradient-to-t from-sea-900/60 to-transparent"></div>
        <div class="absolute bottom-3 left-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="${categoryBadgeStyle(city.category)}">${esc(city.category)}</span>
        </div>
        ${city.rating ? `<div class="absolute bottom-3 right-3"><span class="bg-white/95 text-sun-500 text-xs font-bold px-2 py-0.5 rounded-full">★ ${Number(city.rating).toFixed(1)}</span></div>` : ''}
      </div>
      <div class="p-4">
        <h3 class="font-display font-extrabold text-sea-800 text-base leading-tight group-hover:text-sun-600 transition-colors">${esc(city.name)}</h3>
        <div class="text-xs text-sea-700/60 mt-1">${esc(city.distance || '')}${city.drive ? ` · ${esc(city.drive)}` : ''}</div>
        <p class="text-sm text-sea-700/80 mt-2 line-clamp-2">${esc(city.summary || '')}</p>
        <div class="flex flex-wrap gap-1 mt-3">${tags}</div>
        <div class="mt-3 flex flex-wrap gap-2">
          ${entryFee}
          ${hours}
        </div>
        ${SUBPAGE_SLUGS.has(city.id)
          ? `<a href="antik-kentler/${esc(city.id)}.html" onclick="event.stopPropagation()" class="mt-3 w-full block text-center text-xs font-bold text-white bg-sea-800 hover:bg-sea-700 py-2 rounded-lg transition">Tam Sayfa Detay →</a>`
          : `<button onclick="event.stopPropagation();openDetail('${esc(city.id)}')" class="mt-3 w-full text-center text-xs font-bold text-sea-600 border border-sea-200 hover:bg-sea-50 py-1.5 rounded-lg transition">Detayı Gör →</button>`}
      </div>
    </article>
  `;
}

function renderCards(items) {
  const grid = document.getElementById('card-grid');
  if (!grid) return;
  if (!items || items.length === 0) {
    grid.innerHTML = '<div class="col-span-full text-center py-12 text-sea-700/50">Eşleşen kent bulunamadı.</div>';
    return;
  }
  grid.innerHTML = items.map(antikCard).join('');
}

function renderAllKents(items) {
  const grid = document.getElementById('all-kents-grid');
  if (!grid) return;
  grid.innerHTML = items.map(antikCard).join('');
}

function renderGuideTable(items) {
  const tbody = document.getElementById('guide-tbody');
  if (!tbody) return;

  // Zorluk/ulaşım sınıflandırması — JSON'daki drive alanına göre
  function accessLevel(city) {
    const d = (city.drive || '').toLowerCase();
    if (d.includes('tekne') || d.includes('yürüyüş'))  return { label: 'Zor', cls: 'background:#fee2e2;color:#b91c1c' };
    if (d.includes('1 saat') || d.includes('tırmanış')) return { label: 'Orta', cls: 'background:#dbeafe;color:#1d4ed8' };
    return { label: 'Kolay', cls: 'background:#dcfce7;color:#15803d' };
  }

  function duration(city) {
    return city.duration || '—';
  }

  function bestFor(city) {
    const tags = (city.tags || []).join(' ').toLowerCase();
    const cat  = (city.category || '').toLowerCase();
    if (cat.includes('deniz') || tags.includes('tekne')) return 'Tekne turu sevenler';
    if (tags.includes('yürüyüş') || tags.includes('dağ')) return 'Doğa yürüyüşçüleri';
    if (cat.includes('unesco'))                           return 'Tarih meraklıları';
    if (tags.includes('tenha') || tags.includes('otantik')) return 'Keşif arayanlar';
    return 'Genel ziyaretçi';
  }

  const sorted = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  tbody.innerHTML = sorted.map(city => {
    const acc = accessLevel(city);
    return `
      <tr class="border-b border-sea-50 hover:bg-sea-50/40 transition-colors">
        <td class="px-4 py-3">
          <button onclick="openDetail('${esc(city.id)}')" class="font-display font-bold text-sea-800 text-sm hover:text-sun-600 transition-colors text-left">${esc(city.name)}</button>
        </td>
        <td class="px-4 py-3 text-sm text-sea-700">${esc(city.distance || '—')}</td>
        <td class="px-4 py-3 text-sm text-sea-700">${esc(duration(city))}</td>
        <td class="px-4 py-3"><span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;${acc.cls}">${acc.label}</span></td>
        <td class="px-4 py-3 text-xs text-sea-700/80">${esc(bestFor(city))}</td>
        <td class="px-4 py-3 text-xs text-sea-700/70">${esc(city.entryFee || 'Ücretsiz')}</td>
      </tr>
    `;
  }).join('');
}

function bindFilters() {
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active', 'bg-[#0a2e4c]', 'text-white', 'border-[#0a2e4c]'));
      btn.classList.add('active', 'bg-[#0a2e4c]', 'text-white', 'border-[#0a2e4c]');
      currentFilter = btn.dataset.filter;
      const filtered = currentFilter
        ? allItems.filter(i => i.category === currentFilter)
        : allItems;
      const q = document.getElementById('search-input')?.value?.trim() || '';
      const final = q ? filtered.filter(i => JSON.stringify(i).toLowerCase().includes(q.toLowerCase())) : filtered;
      renderCards(final);
      if (window.filterLikyaMap) window.filterLikyaMap(currentFilter);
    });
  });
}

function bindSearch() {
  const inp = document.getElementById('search-input');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    const base = currentFilter ? allItems.filter(i => i.category === currentFilter) : allItems;
    const filtered = q ? base.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : base;
    renderCards(filtered);
  });
}

// ── Detay Modal ───────────────────────────────────────────────────────────────

window.openDetail = function(id) {
  const city = allItems.find(c => c.id === id);
  if (!city) return;
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');
  if (!modal || !content) return;

  const galleryImgs = (city.gallery || [city.image]).filter(Boolean);
  const galleryHtml = galleryImgs.length > 0
    ? `<div class="relative aspect-[16/8] overflow-hidden bg-sea-900">
        <img src="${esc(galleryImgs[0])}" alt="${esc(city.name)}" class="w-full h-full object-cover" onerror="this.style.opacity='0'">
        <div class="absolute inset-0 bg-gradient-to-t from-sea-900/70 to-transparent"></div>
        <div class="absolute bottom-5 left-6 text-white">
          <div class="text-xs uppercase tracking-widest opacity-70 font-semibold">${esc(city.category)}</div>
          <div class="font-display font-extrabold text-3xl mt-1">${esc(city.name)}</div>
          ${city.rating ? `<div class="text-sun-400 font-bold mt-1">★ ${Number(city.rating).toFixed(1)}</div>` : ''}
        </div>
        <button onclick="closeDetail()" class="absolute top-4 right-4 w-9 h-9 grid place-items-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/35 transition" aria-label="Kapat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`
    : `<div class="flex items-center justify-between p-5 border-b border-sea-100">
        <h2 class="font-display font-extrabold text-sea-800 text-2xl">${esc(city.name)}</h2>
        <button onclick="closeDetail()" class="w-9 h-9 grid place-items-center rounded-full border border-sea-100 hover:bg-sea-50 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`;

  const highlights = (city.highlights || []).map(h =>
    `<li class="flex gap-2 items-start text-sm text-sea-700"><span class="text-sun-500 font-bold mt-0.5">•</span><span>${esc(h)}</span></li>`
  ).join('');

  const tags = (city.tags || []).map(t =>
    `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sea-600/10 text-sea-600">${esc(t)}</span>`
  ).join('');

  content.innerHTML = `
    ${galleryHtml}
    <div class="p-6 md:p-8">
      <div class="grid md:grid-cols-3 gap-4 mb-6">
        <div class="bg-sea-50 rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-widest text-sea-500 font-bold mb-1">Mesafe</div>
          <div class="font-display font-extrabold text-sea-800 text-sm">${esc(city.distance || '—')}</div>
          <div class="text-xs text-sea-700/60 mt-0.5">${esc(city.drive || '')}</div>
        </div>
        <div class="bg-sea-50 rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-widest text-sea-500 font-bold mb-1">Giriş</div>
          <div class="font-display font-extrabold text-sea-800 text-sm">${esc(city.entryFee || 'Ücretsiz')}</div>
          <div class="text-xs text-sea-700/60 mt-0.5">${esc(city.hours || '')}</div>
        </div>
        <div class="bg-sea-50 rounded-xl p-4">
          <div class="text-[10px] uppercase tracking-widest text-sea-500 font-bold mb-1">Ziyaret Süresi</div>
          <div class="font-display font-extrabold text-sea-800 text-sm">${esc(city.duration || '—')}</div>
        </div>
      </div>

      ${city.summary ? `<p class="text-sea-700 leading-relaxed mb-6">${esc(city.summary)}</p>` : ''}

      ${city.history ? `
        <div class="mb-6">
          <h3 class="font-display font-extrabold text-sea-800 text-lg mb-2">Tarihçe</h3>
          <p class="text-sea-700/80 text-sm leading-relaxed">${esc(city.history)}</p>
        </div>
      ` : ''}

      ${highlights ? `
        <div class="mb-6">
          <h3 class="font-display font-extrabold text-sea-800 text-lg mb-3">Öne Çıkan Noktalar</h3>
          <ul class="space-y-2">${highlights}</ul>
        </div>
      ` : ''}

      ${city.tips ? `
        <div class="bg-sun-400/8 border border-sun-400/30 rounded-xl p-4 mb-6">
          <div class="text-xs uppercase tracking-widest text-sun-600 font-bold mb-1">Ziyaretçi Tüyoları</div>
          <p class="text-sm text-sea-700 leading-relaxed">${esc(city.tips)}</p>
        </div>
      ` : ''}

      ${city.transport ? `
        <div class="mb-6">
          <h3 class="font-display font-extrabold text-sea-800 text-sm mb-1">Ulaşım</h3>
          <p class="text-sm text-sea-700/80">${esc(city.transport)}</p>
        </div>
      ` : ''}

      ${tags ? `<div class="flex flex-wrap gap-1.5 mb-6">${tags}</div>` : ''}

      ${SUBPAGE_SLUGS.has(city.id) ? `
        <a href="antik-kentler/${esc(city.id)}.html" class="block w-full text-center bg-sun-500 hover:bg-sun-400 text-sea-900 font-display font-extrabold text-sm uppercase tracking-wider rounded-xl py-3 mb-3 transition">
          Tam Sayfa Rehberi Aç →
        </a>
      ` : ''}

      <div class="flex gap-3">
        ${city.lat && city.lng ? `
          <a href="https://www.google.com/maps/dir/?api=1&destination=${city.lat},${city.lng}" target="_blank" rel="noopener"
             class="flex-1 flex items-center justify-center gap-2 bg-sea-800 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-sea-700 transition">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Yol Tarifi
          </a>
        ` : ''}
        <button onclick="closeDetail()" class="flex-1 border border-sea-200 text-sea-700 text-sm font-bold py-2.5 rounded-xl hover:bg-sea-50 transition">
          Kapat
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeDetail = function() {
  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.closeDetail();
});

// ── Ana init ──────────────────────────────────────────────────────────────────

(async () => {
  const data = await KalkanData.load('antik-kentler');
  allItems = data.items || [];
  renderCards(allItems);
  renderAllKents(allItems);
  renderGuideTable(allItems);
  bindFilters();
  bindSearch();
})();
