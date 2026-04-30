/**
 * map.js — Leaflet wrapper (ES module)
 * Anahtarsız: Leaflet 1.9.x + OpenStreetMap
 *
 * Public API:
 *   openMapModal({lat, lng, name, address, zoom=15}) — fullscreen modal açar
 *   injectMapButton(cardEl, {lat, lng, name, address}) — karta "Konumu Gör" butonu ekler
 *   findCardLocations() — DOM'da [data-lat][data-lng] tüm elementleri tarar, buton ekler
 *   enrichCardsFromData(jsonUrl, cardSelector) — JSON'dan lat/lng alır, kartlara data-attr yazar (opsiyonel, auto-call yok)
 */

import { googleMapsLink, directionsLink } from './directions.js';

// Kalkan merkez koordinatları
const KALKAN_LAT = 36.2658;
const KALKAN_LNG = 29.4118;

// Leaflet CDN kaynakları
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Yükleme durumu
let leafletReady = false;
let leafletLoading = false;
let leafletCallbacks = [];

/**
 * Leaflet CSS + JS'i head'e dinamik inject eder. Zaten yüklüyse atlar.
 * @returns {Promise<void>}
 */
function loadLeaflet() {
  if (leafletReady) return Promise.resolve();

  if (leafletLoading) {
    return new Promise((resolve) => leafletCallbacks.push(resolve));
  }

  leafletLoading = true;

  return new Promise((resolve, reject) => {
    leafletCallbacks.push(resolve);

    // CSS inject
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    // JS inject
    if (!document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.onload = () => {
        leafletReady = true;
        leafletLoading = false;
        leafletCallbacks.forEach((cb) => cb());
        leafletCallbacks = [];
      };
      script.onerror = () => {
        leafletLoading = false;
        reject(new Error('Leaflet yüklenemedi'));
      };
      document.head.appendChild(script);
    } else {
      // Script tag var ama yükleme bitmemiş olabilir — yoklamaya devam et
      const poll = setInterval(() => {
        if (window.L) {
          clearInterval(poll);
          leafletReady = true;
          leafletLoading = false;
          leafletCallbacks.forEach((cb) => cb());
          leafletCallbacks = [];
        }
      }, 80);
    }
  });
}

// Modal DOM referansı (singleton)
let modalEl = null;
let mapInstance = null;

/**
 * Modal HTML'i oluşturur ve body'e ekler (ilk çağrıda).
 */
function ensureModal() {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.id = 'ki-map-modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-label', 'Harita');
  modalEl.innerHTML = `
    <div id="ki-map-backdrop"></div>
    <div id="ki-map-panel">
      <div id="ki-map-header">
        <div id="ki-map-title-wrap">
          <span id="ki-map-icon">📍</span>
          <div>
            <div id="ki-map-name"></div>
            <div id="ki-map-address"></div>
          </div>
        </div>
        <button id="ki-map-close" aria-label="Kapat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div id="ki-map-container"></div>
      <div id="ki-map-footer">
        <a id="ki-map-directions" href="#" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          Yol Tarifi Al
        </a>
        <a id="ki-map-gmaps" href="#" target="_blank" rel="noopener">
          Google Maps'te Aç
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>
          </svg>
        </a>
      </div>
    </div>
  `;

  // Stiller
  const style = document.createElement('style');
  style.textContent = `
    #ki-map-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      align-items: center;
      justify-content: center;
    }
    #ki-map-modal.ki-open {
      display: flex;
    }
    #ki-map-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(7,33,54,0.72);
      backdrop-filter: blur(4px);
      cursor: pointer;
    }
    #ki-map-panel {
      position: relative;
      z-index: 1;
      width: min(92vw, 740px);
      max-height: 90vh;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      box-shadow: 0 8px 40px -8px rgba(7,33,54,0.5), 0 2px 8px rgba(7,33,54,0.15);
    }
    #ki-map-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(180deg,#0c3858 0%,#0a2e4c 100%);
      color: #fff;
      flex-shrink: 0;
    }
    #ki-map-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #ki-map-icon {
      font-size: 22px;
      line-height: 1;
    }
    #ki-map-name {
      font-family: 'Montserrat', system-ui, sans-serif;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.01em;
    }
    #ki-map-address {
      font-size: 12px;
      opacity: 0.7;
      margin-top: 2px;
    }
    #ki-map-close {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(255,255,255,0.12);
      border: none;
      color: #fff;
      cursor: pointer;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition: background 0.18s ease;
    }
    #ki-map-close:hover {
      background: rgba(255,255,255,0.22);
    }
    #ki-map-container {
      flex: 1;
      min-height: 340px;
      max-height: 480px;
    }
    #ki-map-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: #f0f6fb;
      border-top: 1px solid rgba(13,58,95,0.1);
      flex-shrink: 0;
    }
    #ki-map-directions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1a5e93;
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.18s ease;
    }
    #ki-map-directions:hover {
      background: #134c79;
    }
    #ki-map-gmaps {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #1a5e93;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      margin-left: auto;
      opacity: 0.8;
      transition: opacity 0.18s;
    }
    #ki-map-gmaps:hover {
      opacity: 1;
    }

    /* Harita butonları (kart üzerindeki küçük buton) */
    .ki-map-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      background: #eef4fb;
      border: 1px solid #c3d9ec;
      color: #1a5e93;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease;
      font-family: inherit;
    }
    .ki-map-btn:hover {
      background: #daeaf7;
      border-color: #1a5e93;
    }

    @media (max-width: 480px) {
      #ki-map-panel {
        width: 96vw;
        max-height: 95vh;
      }
      #ki-map-container {
        min-height: 260px;
      }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modalEl);

  // Kapatma event'leri
  document.getElementById('ki-map-backdrop').addEventListener('click', closeMapModal);
  document.getElementById('ki-map-close').addEventListener('click', closeMapModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMapModal();
  });
}

/**
 * Modalı kapatır ve haritayı temizler.
 */
function closeMapModal() {
  if (!modalEl) return;
  modalEl.classList.remove('ki-open');
  document.body.style.overflow = '';
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  const container = document.getElementById('ki-map-container');
  if (container) container.innerHTML = '';
}

/**
 * Fullscreen modal açar ve Leaflet haritasını render eder.
 * @param {object} opts
 * @param {number} opts.lat
 * @param {number} opts.lng
 * @param {string} [opts.name]
 * @param {string} [opts.address]
 * @param {number} [opts.zoom=15]
 */
export async function openMapModal({ lat, lng, name = 'Konum', address = '', zoom = 15 }) {
  ensureModal();

  // İçerikleri doldur
  document.getElementById('ki-map-name').textContent = name;
  document.getElementById('ki-map-address').textContent = address;

  const dirUrl = directionsLink(lat, lng, name);
  const gmapsUrl = googleMapsLink(lat, lng, name);
  document.getElementById('ki-map-directions').href = dirUrl;
  document.getElementById('ki-map-gmaps').href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Modalı aç
  modalEl.classList.add('ki-open');
  document.body.style.overflow = 'hidden';

  // Leaflet yükle
  try {
    await loadLeaflet();
  } catch {
    document.getElementById('ki-map-container').innerHTML =
      '<div style="display:grid;place-items:center;height:100%;color:#666;font-size:14px;">Harita yüklenemedi.</div>';
    return;
  }

  // Harita render
  const container = document.getElementById('ki-map-container');
  container.innerHTML = '';

  mapInstance = window.L.map(container, {
    center: [lat, lng],
    zoom,
    zoomControl: true,
    scrollWheelZoom: true,
  });

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapInstance);

  // Özel ikon (sea-500 renginde)
  const icon = window.L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:#1a5e93;border:3px solid #fff;
      box-shadow:0 2px 8px rgba(7,33,54,0.4);
      transform:rotate(-45deg);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });

  const marker = window.L.marker([lat, lng], { icon }).addTo(mapInstance);

  if (name) {
    const popupContent = `
      <div style="font-family:'Inter',system-ui,sans-serif;min-width:140px;">
        <div style="font-weight:700;color:#0a2e4c;font-size:14px;">${name}</div>
        ${address ? `<div style="color:#5d97c4;font-size:12px;margin-top:2px;">${address}</div>` : ''}
      </div>
    `;
    marker.bindPopup(popupContent, { maxWidth: 220 }).openPopup();
  }

  // Invalidate size (modal görünür olduktan sonra)
  setTimeout(() => mapInstance && mapInstance.invalidateSize(), 120);
}

/**
 * Bir kart elementinin sonuna küçük "Konumu Gör" butonu ekler.
 * @param {HTMLElement} cardEl
 * @param {object} opts - {lat, lng, name, address}
 */
export function injectMapButton(cardEl, { lat, lng, name = '', address = '' }) {
  if (!cardEl || cardEl.querySelector('.ki-map-btn')) return; // zaten var

  const btn = document.createElement('button');
  btn.className = 'ki-map-btn';
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
    Konumu Gör
  `;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMapModal({ lat: parseFloat(lat), lng: parseFloat(lng), name, address });
  });

  cardEl.appendChild(btn);
}

/**
 * DOM'da [data-lat][data-lng] attribute'u olan tüm elementleri tarar,
 * her birine harita butonu enjekte eder.
 */
export function findCardLocations() {
  const els = document.querySelectorAll('[data-lat][data-lng]');
  els.forEach((el) => {
    const lat = el.dataset.lat;
    const lng = el.dataset.lng;
    const name = el.dataset.mapName || el.querySelector('[data-name]')?.textContent || '';
    const address = el.dataset.mapAddress || '';
    injectMapButton(el, { lat, lng, name, address });
  });
}

/**
 * (Opsiyonel) JSON URL'inden lat/lng verisi çeker, cardSelector ile eşleştirerek
 * kart elementlerine data-lat/data-lng attribute yazar.
 *
 * JSON formatı beklentisi:
 *   { items: [{ id, location: { lat, lng } }, ...] }
 *
 * Her kartın data-id attribute'u JSON id'siyle eşleşmeli.
 *
 * Kullanım örneği (auto-call YOK, elle çağır):
 *   import { enrichCardsFromData } from './map.js';
 *   enrichCardsFromData('data/restoranlar.json', '.restoran-card');
 *
 * @param {string} jsonUrl
 * @param {string} cardSelector - CSS selector
 */
export async function enrichCardsFromData(jsonUrl, cardSelector) {
  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) return;
    const data = await res.json();
    const items = data.items || [];

    const locationMap = {};
    items.forEach((item) => {
      if (item.id && item.location?.lat && item.location?.lng) {
        locationMap[item.id] = item.location;
      }
    });

    document.querySelectorAll(cardSelector).forEach((card) => {
      const id = card.dataset.id;
      if (id && locationMap[id]) {
        card.dataset.lat = locationMap[id].lat;
        card.dataset.lng = locationMap[id].lng;
        if (locationMap[id].address) {
          card.dataset.mapAddress = locationMap[id].address;
        }
      }
    });

    // Attribute eklendikten sonra butonları enjekte et
    findCardLocations();
  } catch {
    // Silently degrade — harita butonları olmadan devam et
  }
}

// Auto-init: DOMContentLoaded'da [data-lat][data-lng] olan kartları tara
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findCardLocations);
} else {
  findCardLocations();
}

// Global erişim için window'a at (Console'dan test için)
window.openMapModal = openMapModal;
