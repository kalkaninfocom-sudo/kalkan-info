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
    cityData = await fetch('data/antik-kentler.json').then(r => r.json());
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
          <button onclick="openDetail('${city.id}')" style="display:inline-block;padding:6px 14px;background:#e89812;color:#0a2e4c;border:none;border-radius:6px;font-weight:800;font-size:12px;cursor:pointer;font-family:'Montserrat',sans-serif;">Detayları Gör →</button>
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
    stagesData = await fetch('data/likya-yolu.json').then(r => r.json());
  } catch(e) {
    console.warn('likya-yolu.json yüklenemedi', e);
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

let allItems = [], currentFilter = '';

(async () => {
  const data = await KalkanData.load('antik-kentler');
  allItems = data.items || [];
  renderCards(allItems);
  bindFilters();
  bindSearch();
})();
