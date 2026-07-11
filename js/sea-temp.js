/* Kalkan Info — Canlı Deniz Suyu Sıcaklığı (plaj kartları)
   Kaynak: Open-Meteo Marine API (ücretsiz, key yok, Copernicus Marine model verisi — onaylı).
   Tek istekte tüm plaj koordinatları → her kartın 🌊 çipini doldurur.
   1 saat localStorage cache. Sessiz fallback (başarısızsa çip gizli kalır).
   ⚠️ MutationObserver DEBOUNCE + GUARD'lı — i18n sonsuz-döngü hatasını tekrarlama (memory dersi).
*/
(function () {
  'use strict';
  const CACHE_KEY = 'ki_sea_temp_v1';
  const TTL = 60 * 60 * 1000; // 1 saat
  const ENDPOINT = 'https://marine-api.open-meteo.com/v1/marine';

  const chips = () => Array.from(document.querySelectorAll('[data-sea-temp]'));
  const unfilled = () => chips().filter((e) => !e.dataset.filled);

  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.t < TTL && c.map) return c.map;
    } catch (e) { /* yok say */ }
    return null;
  }

  async function fetchMap(els) {
    const byId = {};
    els.forEach((e) => { byId[e.dataset.seaTemp] = { lat: e.dataset.lat, lng: e.dataset.lng }; });
    const ids = Object.keys(byId);
    if (!ids.length) return null;
    const lat = ids.map((id) => byId[id].lat).join(',');
    const lng = ids.map((id) => byId[id].lng).join(',');
    const url = `${ENDPOINT}?latitude=${lat}&longitude=${lng}&current=sea_surface_temperature&timezone=Europe%2FIstanbul`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('marine ' + res.status);
    const j = await res.json();
    const arr = Array.isArray(j) ? j : [j]; // çoklu konum → dizi; tek konum → nesne
    const map = {};
    ids.forEach((id, i) => {
      const v = arr[i] && arr[i].current && arr[i].current.sea_surface_temperature;
      if (v != null) map[id] = v;
    });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), map })); } catch (e) { /* yok say */ }
    return map;
  }

  function apply(map) {
    if (!map) return;
    chips().forEach((e) => {
      if (e.dataset.filled) return;
      const v = map[e.dataset.seaTemp];
      if (v == null) return;
      const val = e.querySelector('.st-val');
      if (val) val.textContent = Math.round(v) + '°C';
      e.style.opacity = '1';
      e.dataset.filled = '1'; // idempotent — bir daha dokunma (döngü kırıcı)
    });
  }

  let inflight = false;
  async function run() {
    if (inflight) return;
    const els = unfilled();
    if (!els.length) return; // GUARD: doldurulacak çip yoksa hiçbir şey yapma (mutation üretme)
    let map = readCache();
    if (!map) {
      inflight = true;
      try { map = await fetchMap(els); }
      catch (e) { inflight = false; return; } // sessiz — çip gizli kalır
      inflight = false;
    }
    apply(map);
  }

  // Debounce — mutation fırtınasını topla
  let deb = null;
  const schedule = () => { clearTimeout(deb); deb = setTimeout(run, 120); };

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);

  // Geç/yeniden render edilen kartlar (filtre/arama) — GUARD'lı observer, döngü yok
  const mo = new MutationObserver(() => { if (unfilled().length) schedule(); });
  mo.observe(document.body, { childList: true, subtree: true });

  // Emniyet: ağ/gecikme için birkaç deneme
  setTimeout(run, 900);
  setTimeout(run, 2500);
})();
