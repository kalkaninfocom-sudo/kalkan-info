/**
 * Kalkan Stays — Kiralama İlan Listeleme (stays-browse.js)
 *
 * Supabase tablosu: stays (status='active' RLS ile public)
 * Filtreler (client-side): listing_type, capacity, price_range, location, date_range
 * Müsaitlik (browse): available_from/to sezon kontrolü (temel); detaylı kontrol M3'te.
 */

import { supabase } from './supabase-client.js';
import { isSupabaseConfigured } from './auth.js';

// ----------------------------------------------------------------------------
// Sabitler
// ----------------------------------------------------------------------------
const LISTING_TYPES = {
  room:           'Oda',
  apartment:      'Daire',
  villa:          'Villa',
  whole_building: 'Tüm Bina',
  couch:          'Kanepe / Couch',
};

const TYPE_COLORS = {
  room:           'bg-sky-100 text-sky-800',
  apartment:      'bg-amber-100 text-amber-800',
  villa:          'bg-emerald-100 text-emerald-800',
  whole_building: 'bg-purple-100 text-purple-800',
  couch:          'bg-rose-100 text-rose-800',
};

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------
let _allStays = [];
let _filters = {
  type:        'all',
  capacityMin: 1,
  priceMin:    0,
  priceMax:    Infinity,
  location:    '',
  checkIn:     '',
  checkOut:    '',
};

// ----------------------------------------------------------------------------
// Init
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  _bindFilters();
  _loadStays();
});

// ----------------------------------------------------------------------------
// Data
// ----------------------------------------------------------------------------
async function _loadStays() {
  _showLoading(true);

  if (!isSupabaseConfigured) {
    console.warn('[stays-browse] Supabase yapılandırılmamış, boş liste gösteriliyor.');
    _allStays = [];
    _render([]);
    _showLoading(false);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('stays')
      .select('id,slug,title,listing_type,capacity,bedrooms,location,price_per_night,currency,cleaning_fee,images,available_from,available_to,is_verified,view_count,published_at')
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(80);

    if (error) throw error;
    _allStays = data || [];
    _applyFiltersAndRender();
  } catch (err) {
    console.warn('[stays-browse] Yükleme hatası:', err.message);
    _allStays = [];
    _render([]);
  } finally {
    _showLoading(false);
  }
}

// ----------------------------------------------------------------------------
// Filters
// ----------------------------------------------------------------------------
function _bindFilters() {
  const byId = id => document.getElementById(id);

  byId('filter-type')?.addEventListener('change', e => {
    _filters.type = e.target.value;
    _applyFiltersAndRender();
  });

  byId('filter-capacity')?.addEventListener('input', e => {
    _filters.capacityMin = parseInt(e.target.value, 10) || 1;
    _applyFiltersAndRender();
  });

  byId('filter-price-min')?.addEventListener('input', e => {
    _filters.priceMin = parseInt(e.target.value, 10) || 0;
    _applyFiltersAndRender();
  });

  byId('filter-price-max')?.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    _filters.priceMax = v > 0 ? v : Infinity;
    _applyFiltersAndRender();
  });

  byId('filter-location')?.addEventListener('input', e => {
    _filters.location = e.target.value.trim().toLowerCase();
    _applyFiltersAndRender();
  });

  byId('filter-checkin')?.addEventListener('change', e => {
    _filters.checkIn = e.target.value;
    _applyFiltersAndRender();
  });

  byId('filter-checkout')?.addEventListener('change', e => {
    _filters.checkOut = e.target.value;
    _applyFiltersAndRender();
  });

  byId('clear-filters')?.addEventListener('click', () => {
    _filters = { type: 'all', capacityMin: 1, priceMin: 0, priceMax: Infinity, location: '', checkIn: '', checkOut: '' };
    // UI sıfırla
    const sel = v => v ? (v.value = '') : null;
    const def = v => v ? (v.value = v.dataset.default || '') : null;
    sel(byId('filter-location'));
    sel(byId('filter-checkin'));
    sel(byId('filter-checkout'));
    const typeEl = byId('filter-type'); if (typeEl) typeEl.value = 'all';
    const capEl  = byId('filter-capacity'); if (capEl) capEl.value = '1';
    const pMinEl = byId('filter-price-min'); if (pMinEl) pMinEl.value = '';
    const pMaxEl = byId('filter-price-max'); if (pMaxEl) pMaxEl.value = '';
    _applyFiltersAndRender();
  });
}

function _matchesFilters(stay) {
  const f = _filters;

  // listing_type
  if (f.type !== 'all' && stay.listing_type !== f.type) return false;

  // kapasite
  if ((stay.capacity || 1) < f.capacityMin) return false;

  // fiyat
  const price = Number(stay.price_per_night || 0);
  if (price < f.priceMin) return false;
  if (f.priceMax !== Infinity && price > f.priceMax) return false;

  // konum metin araması
  if (f.location) {
    const loc = (stay.location || '').toLowerCase();
    if (!loc.includes(f.location)) return false;
  }

  // tarih aralığı müsaitlik kontrolü (temel sezon kontrolü)
  if (f.checkIn && f.checkOut) {
    const ci = new Date(f.checkIn);
    const co = new Date(f.checkOut);
    if (co <= ci) return false; // geçersiz aralık — tüm ilanları göster

    if (stay.available_from) {
      const af = new Date(stay.available_from);
      if (ci < af) return false; // check-in sezon başından önce
    }
    if (stay.available_to) {
      const at = new Date(stay.available_to);
      if (co > at) return false; // check-out sezon sonundan sonra
    }
  }

  return true;
}

function _applyFiltersAndRender() {
  const filtered = _allStays.filter(_matchesFilters);
  _render(filtered);
}

// ----------------------------------------------------------------------------
// Render
// ----------------------------------------------------------------------------
function _render(items) {
  const grid  = document.getElementById('stays-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('result-count');

  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    if (count) count.textContent = '0 ilan bulundu';
    return;
  }

  empty?.classList.add('hidden');
  if (count) count.textContent = `${items.length} ilan bulundu`;

  grid.innerHTML = items.map(_renderCard).join('');

  // Kart tıklama
  grid.querySelectorAll('[data-slug]').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug;
      if (slug) window.location.href = `kirala-ilan.html?slug=${encodeURIComponent(slug)}`;
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

function _renderCard(stay) {
  const img = (stay.images && stay.images[0])
    ? _esc(stay.images[0])
    : 'https://placehold.co/600x400/0a2e4c/e8a020?text=Foto+Yok';

  const typeLabel = LISTING_TYPES[stay.listing_type] || stay.listing_type || '—';
  const typeClass = TYPE_COLORS[stay.listing_type] || 'bg-slate-100 text-slate-700';

  const price  = Number(stay.price_per_night || 0);
  const priceHtml = price > 0
    ? `<span class="font-bold text-sea-800">₺${price.toLocaleString('tr-TR')}</span><span class="text-sea-500 text-xs">/gece</span>`
    : `<span class="text-sea-500 text-sm">Fiyat sor</span>`;

  const cap  = stay.capacity  || 1;
  const beds = stay.bedrooms  != null ? stay.bedrooms : null;
  const loc  = stay.location  || '';

  const verifiedBadge = stay.is_verified
    ? `<span class="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        Doğrulandı
      </span>`
    : '';

  return `
    <article
      class="group relative bg-white rounded-2xl overflow-hidden cursor-pointer card-hover border border-sea-100 flex flex-col"
      data-slug="${_esc(stay.slug || stay.id)}"
      role="listitem"
      tabindex="0"
      aria-label="${_esc(stay.title)}"
    >
      <!-- Fotoğraf -->
      <div class="relative h-48 overflow-hidden">
        <img
          src="${img}"
          alt="${_esc(stay.title)}"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onerror="this.src='https://placehold.co/600x400/0a2e4c/e8a020?text=Foto+Yok'"
        >
        <!-- Gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        <!-- Tip badge -->
        <span class="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full ${typeClass} shadow-sm">
          ${_esc(typeLabel)}
        </span>
        ${verifiedBadge}
      </div>

      <!-- İçerik -->
      <div class="flex flex-col flex-1 p-4 gap-2">
        <h3 class="font-display font-bold text-sea-800 text-base leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
          ${_esc(stay.title)}
        </h3>

        <!-- Meta: kapasite + yatak odası + konum -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sea-600 text-xs">
          <span class="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${cap} kişi
          </span>
          ${beds != null ? `
          <span class="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M2 13v7"/><path d="M22 13v7"/><path d="M2 13h20"/><path d="M6 13v4"/><path d="M18 13v4"/></svg>
            ${beds} yatak odası
          </span>` : ''}
          ${loc ? `
          <span class="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            ${_esc(loc)}
          </span>` : ''}
        </div>

        <!-- Fiyat -->
        <div class="mt-auto pt-3 border-t border-sea-50 flex items-center justify-between">
          <div class="flex items-baseline gap-1">
            ${priceHtml}
          </div>
          <span class="text-xs text-sea-400 group-hover:text-amber-600 transition-colors font-medium flex items-center gap-1">
            Detay
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </div>
      </div>
    </article>
  `;
}

// ----------------------------------------------------------------------------
// UI helpers
// ----------------------------------------------------------------------------
function _showLoading(show) {
  const loader = document.getElementById('loading-state');
  const grid   = document.getElementById('stays-grid');
  if (show) {
    loader?.classList.remove('hidden');
    if (grid) grid.innerHTML = '';
  } else {
    loader?.classList.add('hidden');
  }
}

// ----------------------------------------------------------------------------
// Util
// ----------------------------------------------------------------------------
function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
