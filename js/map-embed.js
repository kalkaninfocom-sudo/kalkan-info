// Leaflet + OpenStreetMap embed — <div data-map data-lat data-lng data-zoom data-label></div>
// Lazy load Leaflet CSS+JS on first viewport intersection.
(function () {
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const TILES_URL   = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILES_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  let leafletLoaded = false;
  let leafletPromise = null;

  function loadLeaflet() {
    if (leafletLoaded) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
      const s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.async = true;
      s.onload = () => { leafletLoaded = true; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return leafletPromise;
  }

  function track(name, props) {
    if (window.plausible) window.plausible(name, props ? { props } : undefined);
  }

  function initMap(host) {
    const lat   = parseFloat(host.dataset.lat);
    const lng   = parseFloat(host.dataset.lng);
    const zoom  = parseInt(host.dataset.zoom || '14', 10);
    const label = host.dataset.label || '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      host.style.display = 'none';
      return;
    }
    host.style.height = host.style.height || '320px';
    host.style.borderRadius = host.style.borderRadius || '12px';
    host.style.overflow = 'hidden';
    const map = window.L.map(host, { scrollWheelZoom: false }).setView([lat, lng], zoom);
    window.L.tileLayer(TILES_URL, { attribution: TILES_ATTR, maxZoom: 19 }).addTo(map);
    const marker = window.L.marker([lat, lng]).addTo(map);
    if (label) marker.bindPopup(label).openPopup();
    host.addEventListener('click', () => track('map_interact', { label }), { once: true });
  }

  function observe() {
    const hosts = document.querySelectorAll('[data-map]:not([data-map-init])');
    if (!hosts.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        entry.target.setAttribute('data-map-init', '1');
        try {
          await loadLeaflet();
          initMap(entry.target);
        } catch (e) {
          console.error('[map-embed] Leaflet yüklenemedi:', e);
        }
      });
    }, { rootMargin: '200px' });
    hosts.forEach((h) => io.observe(h));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
