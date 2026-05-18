/**
 * activities.js — Bölgesel Aktiviteler sayfası modülü
 * Bağımlılıklar: js/i18n.js, js/map.js
 */

const DATA_URL = 'data/aktiviteler.json';

let allActivities = [];
let currentLang = 'tr';
let calendarVisible = false;

const filterState = {
  season: '',
  tag: '',
  difficulty: '',
  priceRange: '',
  bookingRequired: ''
};

// ── i18n ─────────────────────────────────────────────────────────────────────

function getLang() {
  try {
    return localStorage.getItem('kalkan-lang') || 'tr';
  } catch {
    return 'tr';
  }
}

function t(item, field) {
  if (!item[field]) return '';
  if (typeof item[field] === 'string') return item[field];
  const ml = item[field];
  return ml[currentLang] || ml['tr'] || ml['en'] || Object.values(ml)[0] || '';
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function loadActivities() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allActivities = (data.items || []).filter(a => a.status === 'published');
    return allActivities;
  } catch (err) {
    console.error('[activities] Veri yüklenemedi:', err);
    return [];
  }
}

// ── XSS helper ───────────────────────────────────────────────────────────────

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

// ── Filters ──────────────────────────────────────────────────────────────────

function applyFilters({ season, tag, difficulty, priceRange, bookingRequired } = {}) {
  return allActivities.filter(a => {
    if (season && a.season !== season && !(season === 'year-round' && a.season === 'year-round')) {
      if (a.season !== season) return false;
    }
    if (tag && !(a.tags || []).includes(tag)) return false;
    if (difficulty && a.difficulty !== difficulty) return false;
    if (priceRange && a.priceRange !== priceRange) return false;
    if (bookingRequired === 'true' && !a.bookingRequired) return false;
    if (bookingRequired === 'false' && a.bookingRequired) return false;
    return true;
  });
}

// ── Card render ──────────────────────────────────────────────────────────────

const PRICE_LABELS = {
  'ücretsiz': { tr: 'Ücretsiz', en: 'Free', ru: 'Бесплатно', ja: '無料', ar: 'مجاني' },
  '$':        { tr: 'Uygun', en: 'Budget', ru: 'Бюджетно', ja: 'お手頃', ar: 'ميسور' },
  '$$':       { tr: 'Orta', en: 'Mid-range', ru: 'Средний', ja: '中程度', ar: 'متوسط' },
  '$$$':      { tr: 'Premium', en: 'Premium', ru: 'Премиум', ja: 'プレミアム', ar: 'مميز' }
};

const SEASON_LABELS = {
  summer:      { tr: '☀ Yaz', en: '☀ Summer', ru: '☀ Лето', ja: '☀ 夏', ar: '☀ صيف' },
  spring:      { tr: '🌸 İlkbahar', en: '🌸 Spring', ru: '🌸 Весна', ja: '🌸 春', ar: '🌸 ربيع' },
  autumn:      { tr: '🍂 Sonbahar', en: '🍂 Autumn', ru: '🍂 Осень', ja: '🍂 秋', ar: '🍂 خريف' },
  winter:      { tr: '❄ Kış', en: '❄ Winter', ru: '❄ Зима', ja: '❄ 冬', ar: '❄ شتاء' },
  'year-round':{ tr: '🌊 Yıl Boyu', en: '🌊 Year-round', ru: '🌊 Круглый год', ja: '🌊 通年', ar: '🌊 طوال العام' }
};

function seasonLabel(season) {
  const map = SEASON_LABELS[season] || {};
  return map[currentLang] || map['tr'] || season;
}

function priceLabel(pr) {
  const map = PRICE_LABELS[pr] || {};
  return map[currentLang] || map['tr'] || pr;
}

function cardHTML(a) {
  const img = (a.images && a.images[0]) ? a.images[0] : 'https://placehold.co/400x240?text=Aktivite';
  const title = t(a, 'titleML') || a.title;
  const desc = t(a, 'descriptionML');
  const tags = (a.tags || []).slice(0, 3).map(tag =>
    `<span class="inline-block bg-sea-50 text-sea-600 text-[10px] font-semibold px-2 py-0.5 rounded">${esc(tag)}</span>`
  ).join('');

  const bookingBadge = a.bookingRequired
    ? `<span class="text-[10px] bg-sun-400/15 text-sun-600 font-semibold px-2 py-0.5 rounded">Rezervasyon</span>`
    : '';

  return `
    <article class="card-base card-hover rounded-2xl overflow-hidden flex flex-col cursor-pointer"
      data-id="${a.id}"
      data-lat="${a.location?.lat || ''}"
      data-lng="${a.location?.lng || ''}"
      onclick="openActivityModal('${a.id}')">
      <div class="relative overflow-hidden aspect-[4/3] photo-treatment">
        <img src="${img}" alt="${title}" loading="lazy"
          class="w-full h-full object-cover"
          onerror="this.src='https://placehold.co/400x300?text=${encodeURIComponent(title)}'">
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        <div class="absolute top-3 left-3">
          <span class="text-[11px] font-bold text-white bg-sea-800/80 backdrop-blur px-2.5 py-1 rounded-full">${seasonLabel(a.season)}</span>
        </div>
        <div class="absolute bottom-3 right-3">
          <span class="price-badge text-sm text-sun-400 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">${priceLabel(a.priceRange)}</span>
        </div>
      </div>
      <div class="p-4 flex flex-col flex-1">
        <h3 class="font-display font-bold text-sea-800 text-base leading-tight mb-1">${esc(title)}</h3>
        <p class="text-sm text-sea-600/80 leading-relaxed line-clamp-2 flex-1">${esc(desc)}</p>
        <div class="mt-3 flex flex-wrap gap-1">${tags}</div>
        <div class="mt-3 flex items-center justify-between pt-3 border-t border-sea-100">
          <div class="flex items-center gap-3 text-xs text-sea-500">
            <span>⏱ ${a.duration || '—'}</span>
            ${bookingBadge}
          </div>
          <button
            class="text-xs font-semibold text-sea-500 hover:text-sea-800 flex items-center gap-1 transition"
            onclick="event.stopPropagation(); openActivityModal('${a.id}')">
            Detay
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderActivities(items) {
  const grid = document.getElementById('activity-grid');
  const empty = document.getElementById('activity-empty');
  if (!grid) return;

  if (!items || items.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  grid.innerHTML = items.map(cardHTML).join('');
}

// ── Modal ────────────────────────────────────────────────────────────────────

function openActivityModal(id) {
  const a = allActivities.find(x => x.id === id);
  if (!a) return;

  const title = t(a, 'titleML') || a.title;
  const desc = t(a, 'descriptionML');
  const img = (a.images && a.images[0]) ? a.images[0] : 'https://placehold.co/800x400?text=Aktivite';
  const tags = (a.tags || []).map(tag =>
    `<span class="inline-block bg-sea-50 text-sea-700 text-xs font-semibold px-3 py-1 rounded-full border border-sea-100">${esc(tag)}</span>`
  ).join('');

  const mapBtn = (a.location?.lat && a.location?.lng)
    ? `<button onclick="window.__kalkanOpenMap && window.__kalkanOpenMap({lat:${a.location.lat},lng:${a.location.lng},name:'${title.replace(/'/g,"\\'")}',address:'${(a.location.address||'').replace(/'/g,"\\'")}'})"
        class="flex items-center gap-2 px-4 py-2 bg-sea-100 hover:bg-sea-200 text-sea-800 rounded-lg text-sm font-semibold transition">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Haritada Gör
      </button>`
    : '';

  const dirBtn = (a.location?.lat && a.location?.lng)
    ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${a.location.lat},${a.location.lng}"
        target="_blank" rel="noopener"
        class="flex items-center gap-2 px-4 py-2 bg-sun-400 hover:bg-sun-500 text-sea-900 rounded-lg text-sm font-bold transition">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Yol Tarifi
      </a>`
    : '';

  const modal = document.getElementById('activity-modal');
  const modalContent = document.getElementById('activity-modal-content');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="relative">
      <img src="${img}" alt="${title}" class="w-full h-56 md:h-72 object-cover rounded-t-2xl"
        onerror="this.src='https://placehold.co/800x400?text=${encodeURIComponent(title)}'">
      <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-t-2xl"></div>
      <button onclick="closeActivityModal()" class="absolute top-3 right-3 w-9 h-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition" aria-label="Kapat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div class="absolute bottom-4 left-4">
        <span class="text-xs font-bold text-white bg-sea-800/80 backdrop-blur px-2.5 py-1 rounded-full">${seasonLabel(a.season)}</span>
      </div>
    </div>
    <div class="p-5 md:p-6">
      <h2 class="font-display font-extrabold text-sea-800 text-xl md:text-2xl leading-tight">${esc(title)}</h2>
      ${a.location?.address ? `<p class="text-xs text-sea-400 mt-1">📍 ${esc(a.location.address)}</p>` : ''}
      <p class="mt-4 text-sea-700 leading-relaxed text-sm md:text-base">${esc(desc)}</p>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="bg-sea-50 rounded-lg p-3">
          <div class="text-xs text-sea-400 font-semibold uppercase tracking-wide mb-1">Süre</div>
          <div class="font-bold text-sea-800">⏱ ${esc(a.duration || '—')}</div>
        </div>
        <div class="bg-sea-50 rounded-lg p-3">
          <div class="text-xs text-sea-400 font-semibold uppercase tracking-wide mb-1">Fiyat</div>
          <div class="font-bold text-sea-800">💰 ${esc(priceLabel(a.priceRange))}</div>
        </div>
        <div class="bg-sea-50 rounded-lg p-3">
          <div class="text-xs text-sea-400 font-semibold uppercase tracking-wide mb-1">Zorluk</div>
          <div class="font-bold text-sea-800">${esc(a.difficulty || '—')}</div>
        </div>
        <div class="bg-sea-50 rounded-lg p-3">
          <div class="text-xs text-sea-400 font-semibold uppercase tracking-wide mb-1">Yaş</div>
          <div class="font-bold text-sea-800">${esc(a.ageRange || 'Tüm yaşlar')}</div>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">${tags}</div>
      <div class="mt-5 flex flex-wrap gap-3">
        ${mapBtn}
        ${dirBtn}
      </div>
    </div>`;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeActivityModal() {
  const modal = document.getElementById('activity-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
}

// ── Calendar ─────────────────────────────────────────────────────────────────

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthName(idx) {
  return currentLang === 'en' ? MONTHS_EN[idx] : MONTHS_TR[idx];
}

function activitiesForMonth(monthIdx) {
  const monthStr = String(monthIdx + 1).padStart(2, '0');
  return allActivities.filter(a => {
    if (a.season === 'year-round') return true;
    if (a.dateStart) {
      const startMonth = a.dateStart.slice(0, 2);
      const endMonth   = a.dateEnd ? a.dateEnd.slice(0, 2) : startMonth;
      return monthStr >= startMonth && monthStr <= endMonth;
    }
    const seasonMonths = {
      spring: ['03','04','05'],
      summer: ['06','07','08','09'],
      autumn: ['09','10','11'],
      winter: ['12','01','02']
    };
    return (seasonMonths[a.season] || []).includes(monthStr);
  });
}

function mountCalendarView() {
  const calEl = document.getElementById('calendar-view');
  if (!calEl) return;

  let html = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">';
  for (let m = 0; m < 12; m++) {
    const acts = activitiesForMonth(m);
    const dots = acts.slice(0, 5).map(a =>
      `<div class="flex items-center gap-1.5 cursor-pointer hover:text-sea-800 transition" onclick="openActivityModal('${esc(a.id)}')">
        <span class="w-1.5 h-1.5 rounded-full bg-sea-400 flex-shrink-0"></span>
        <span class="truncate text-xs">${esc(t(a,'titleML') || a.title)}</span>
      </div>`
    ).join('');
    const more = acts.length > 5 ? `<div class="text-[10px] text-sea-400 mt-1">+${acts.length - 5} daha</div>` : '';
    html += `
      <div class="bg-white rounded-xl p-4 card-base">
        <div class="font-display font-bold text-sea-700 text-sm mb-2 pb-2 border-b border-sea-100">${monthName(m)}</div>
        <div class="space-y-1 text-sea-600">${dots || '<span class="text-xs text-sea-300">—</span>'}${more}</div>
      </div>`;
  }
  html += '</div>';
  calEl.innerHTML = html;
}

// ── Filter UI ─────────────────────────────────────────────────────────────────

function collectTags() {
  const tags = new Set();
  allActivities.forEach(a => (a.tags || []).forEach(t => tags.add(t)));
  return [...tags].sort();
}

function populateTagFilter() {
  const sel = document.getElementById('filter-tag');
  if (!sel) return;
  const tags = collectTags();
  tags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    sel.appendChild(opt);
  });
}

function refreshGrid() {
  const filtered = applyFilters(filterState);
  renderActivities(filtered);
}

function bindFilters() {
  const ids = ['filter-season','filter-tag','filter-difficulty','filter-price','filter-booking'];
  const keys = ['season','tag','difficulty','priceRange','bookingRequired'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      filterState[keys[i]] = el.value;
      refreshGrid();
    });
  });

  // Season big buttons
  document.querySelectorAll('[data-season-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.seasonBtn;
      filterState.season = filterState.season === val ? '' : val;
      document.querySelectorAll('[data-season-btn]').forEach(b => {
        b.classList.toggle('bg-sea-700', b.dataset.seasonBtn === filterState.season);
        b.classList.toggle('text-white', b.dataset.seasonBtn === filterState.season);
        b.classList.toggle('bg-white', b.dataset.seasonBtn !== filterState.season);
        b.classList.toggle('text-sea-700', b.dataset.seasonBtn !== filterState.season);
      });
      const sel = document.getElementById('filter-season');
      if (sel) sel.value = filterState.season;
      refreshGrid();
    });
  });

  // Clear filter btn
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      Object.keys(filterState).forEach(k => filterState[k] = '');
      ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      document.querySelectorAll('[data-season-btn]').forEach(b => {
        b.classList.remove('bg-sea-700','text-white');
        b.classList.add('bg-white','text-sea-700');
      });
      refreshGrid();
    });
  }
}

// ── Calendar toggle ───────────────────────────────────────────────────────────

function bindCalendarToggle() {
  const btn = document.getElementById('btn-calendar-toggle');
  const gridView = document.getElementById('grid-view');
  const calView = document.getElementById('calendar-view');
  if (!btn || !gridView || !calView) return;

  btn.addEventListener('click', () => {
    calendarVisible = !calendarVisible;
    if (calendarVisible) {
      gridView.classList.add('hidden');
      calView.classList.remove('hidden');
      mountCalendarView();
      btn.textContent = '☷ Liste';
    } else {
      gridView.classList.remove('hidden');
      calView.classList.add('hidden');
      btn.textContent = '📅 Takvim';
    }
  });
}

// ── Map bridge ────────────────────────────────────────────────────────────────

function bridgeMapModule() {
  // map.js openMapModal'ı dışarı açmak için global köprü
  import('./map.js').then(mod => {
    window.__kalkanOpenMap = (opts) => {
      if (typeof mod.openMapModal === 'function') {
        mod.openMapModal(opts);
      }
    };
  }).catch(() => {});
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  currentLang = getLang();

  await loadActivities();
  populateTagFilter();
  renderActivities(allActivities);
  bindFilters();
  bindCalendarToggle();
  bridgeMapModule();

  // Update count badge
  const badge = document.getElementById('activity-count');
  if (badge) badge.textContent = allActivities.length;

  // Listen for lang changes from i18n.js
  document.addEventListener('kalkan-lang-change', (e) => {
    currentLang = e.detail?.lang || getLang();
    refreshGrid();
    if (calendarVisible) mountCalendarView();
  });

  // Close modal on backdrop click
  const modal = document.getElementById('activity-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeActivityModal();
    });
  }

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeActivityModal();
  });
}

// Export for HTML inline usage
window.openActivityModal  = openActivityModal;
window.closeActivityModal = closeActivityModal;

document.addEventListener('DOMContentLoaded', init);
