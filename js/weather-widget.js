// Open-Meteo hava durumu widget — <div data-weather data-lat data-lng data-label></div>
// Default: Kalkan (36.2651, 29.4131). Cache: localStorage 1 saat.
(function () {
  const DEFAULT = { lat: 36.2651, lng: 29.4131, label: 'Kalkan' };
  const CACHE_KEY = 'kalkan_weather_v1';
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  const LANG_COPY = {
    tr: { now: 'Şimdi', feels: 'Hissedilen', wind: 'Rüzgar', humidity: 'Nem' },
    en: { now: 'Now',   feels: 'Feels like', wind: 'Wind', humidity: 'Humidity' },
    de: { now: 'Jetzt', feels: 'Gefühlt',    wind: 'Wind', humidity: 'Feuchte'   },
    ru: { now: 'Сейчас', feels: 'По ощущению', wind: 'Ветер', humidity: 'Влажность' },
    fr: { now: 'Maintenant', feels: 'Ressenti', wind: 'Vent', humidity: 'Humidité' },
  };

  // WMO weather code → emoji + TR label
  const WMO = {
    0:  ['☀️', 'Açık'],
    1:  ['🌤️', 'Çoğunlukla açık'],
    2:  ['⛅', 'Parçalı bulutlu'],
    3:  ['☁️', 'Kapalı'],
    45: ['🌫️', 'Sisli'],
    48: ['🌫️', 'Donmuş sis'],
    51: ['🌦️', 'Hafif çisenti'],
    53: ['🌦️', 'Çisenti'],
    55: ['🌧️', 'Yoğun çisenti'],
    61: ['🌧️', 'Hafif yağmur'],
    63: ['🌧️', 'Yağmur'],
    65: ['🌧️', 'Sağanak'],
    71: ['🌨️', 'Hafif kar'],
    73: ['🌨️', 'Kar'],
    75: ['❄️', 'Yoğun kar'],
    80: ['🌧️', 'Sağanak'],
    81: ['🌧️', 'Şiddetli sağanak'],
    82: ['⛈️', 'Çok şiddetli sağanak'],
    95: ['⛈️', 'Fırtına'],
    96: ['⛈️', 'Dolu fırtınası'],
    99: ['⛈️', 'Şiddetli fırtına'],
  };

  function getLang() {
    try {
      return (localStorage.getItem('lang') || document.documentElement.lang || 'tr').slice(0, 2);
    } catch (_) { return 'tr'; }
  }

  function injectStyles() {
    if (document.getElementById('ww-styles')) return;
    const s = document.createElement('style');
    s.id = 'ww-styles';
    s.textContent = [
      '.ww-card{background:#fff;border:1px solid #cfdfee;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(7,33,54,0.06),0 6px 18px -8px rgba(7,33,54,0.14);font-family:"Inter",system-ui,sans-serif;color:#0a2e4c;}',
      '.ww-icon{font-size:36px;line-height:1;flex-shrink:0;}',
      '.ww-main{flex:1;min-width:0;}',
      '.ww-temp{font-family:"Montserrat",system-ui,sans-serif;font-weight:800;font-size:24px;line-height:1;letter-spacing:-0.02em;}',
      '.ww-temp small{font-size:14px;color:#5d97c4;font-weight:600;margin-left:4px;}',
      '.ww-label{font-size:12px;color:#5d97c4;margin-top:3px;}',
      '.ww-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#5d97c4;margin-top:6px;}',
      '.ww-meta span{display:inline-flex;align-items:center;gap:3px;}',
    ].join('\n');
    document.head.appendChild(s);
  }

  async function fetchWeather(lat, lng) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather fetch failed');
    return res.json();
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY}:${key}`);
      if (!raw) return null;
      const { t, data } = JSON.parse(raw);
      if (Date.now() - t > CACHE_TTL_MS) return null;
      return data;
    } catch (_) { return null; }
  }

  function writeCache(key, data) {
    try { localStorage.setItem(`${CACHE_KEY}:${key}`, JSON.stringify({ t: Date.now(), data })); } catch (_) {}
  }

  function render(host, data, label, lang) {
    const c = LANG_COPY[lang] || LANG_COPY.tr;
    const cur = data.current || {};
    const code = cur.weather_code ?? 0;
    const [emoji] = WMO[code] || ['🌤️', '—'];
    host.innerHTML = `
      <div class="ww-card">
        <div class="ww-icon" aria-hidden="true">${emoji}</div>
        <div class="ww-main">
          <div class="ww-temp">${Math.round(cur.temperature_2m ?? 0)}<small>°C</small></div>
          <div class="ww-label">${label} · ${c.now}</div>
          <div class="ww-meta">
            <span>${c.feels} ${Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0)}°</span>
            <span>${c.wind} ${Math.round(cur.wind_speed_10m ?? 0)} km/h</span>
            <span>${c.humidity} ${Math.round(cur.relative_humidity_2m ?? 0)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  async function init() {
    const hosts = document.querySelectorAll('[data-weather]:not([data-weather-init])');
    if (!hosts.length) return;
    injectStyles();
    const lang = getLang();
    for (const host of hosts) {
      host.setAttribute('data-weather-init', '1');
      const lat = parseFloat(host.dataset.lat) || DEFAULT.lat;
      const lng = parseFloat(host.dataset.lng) || DEFAULT.lng;
      const label = host.dataset.label || DEFAULT.label;
      const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
      try {
        let data = readCache(cacheKey);
        if (!data) {
          data = await fetchWeather(lat, lng);
          writeCache(cacheKey, data);
        }
        render(host, data, label, lang);
      } catch (e) {
        host.style.display = 'none';
        console.warn('[weather]', e.message);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
