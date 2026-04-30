/**
 * weather.js — Open-Meteo hava durumu widget'ı (kompakt pill)
 * Sağ-üst köşede sabit; tıklayınca 3 günlük tahmin paneli açılır.
 */

const KALKAN_LAT = 36.2658;
const KALKAN_LNG = 29.4118;
const CACHE_KEY  = 'ki_weather_cache';
const CACHE_TTL  = 30 * 60 * 1000;

export function weatherCodeToIcon(code) {
  const map = {
    0:  { emoji: '☀️',  label: 'Açık' },
    1:  { emoji: '🌤️', label: 'Az bulutlu' },
    2:  { emoji: '⛅',  label: 'Parçalı bulutlu' },
    3:  { emoji: '☁️',  label: 'Kapalı' },
    45: { emoji: '🌫️', label: 'Sisli' },
    48: { emoji: '🌫️', label: 'Dondurucu sis' },
    51: { emoji: '🌦️', label: 'Hafif çisenti' },
    53: { emoji: '🌦️', label: 'Orta çisenti' },
    55: { emoji: '🌦️', label: 'Yoğun çisenti' },
    61: { emoji: '🌧️', label: 'Hafif yağmur' },
    63: { emoji: '🌧️', label: 'Orta yağmur' },
    65: { emoji: '🌧️', label: 'Şiddetli yağmur' },
    71: { emoji: '🌨️', label: 'Hafif kar' },
    73: { emoji: '🌨️', label: 'Orta kar' },
    75: { emoji: '❄️',  label: 'Yoğun kar' },
    77: { emoji: '🌨️', label: 'Kar taneleri' },
    80: { emoji: '🌦️', label: 'Hafif sağanak' },
    81: { emoji: '🌧️', label: 'Orta sağanak' },
    82: { emoji: '⛈️', label: 'Şiddetli sağanak' },
    85: { emoji: '🌨️', label: 'Kar sağanağı' },
    86: { emoji: '🌨️', label: 'Yoğun kar sağanağı' },
    95: { emoji: '⛈️', label: 'Gök gürültülü fırtına' },
    96: { emoji: '⛈️', label: 'Dolu ile fırtına' },
    99: { emoji: '⛈️', label: 'Yoğun dolu ile fırtına' },
  };
  return map[code] ?? { emoji: '🌡️', label: 'Bilinmiyor' };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export async function fetchWeather(lat = KALKAN_LAT, lng = KALKAN_LNG) {
  const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current_weather=true` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FIstanbul` +
    `&forecast_days=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    writeCache(data);
    return data;
  } catch {
    return readCache();
  }
}

function dayLabel(dateStr, idx) {
  if (idx === 0) return 'Bugün';
  if (idx === 1) return 'Yarın';
  const days = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const d = new Date(dateStr + 'T12:00:00');
  return days[d.getDay()];
}

function injectStylesOnce() {
  if (document.getElementById('ki-weather-styles')) return;
  const s = document.createElement('style');
  s.id = 'ki-weather-styles';
  s.textContent = `
    #ki-weather {
      position:fixed;top:140px;right:170px;z-index:60;
      font-family:'Inter',system-ui,sans-serif;
    }
    #ki-weather-pill {
      display:inline-flex;align-items:center;gap:10px;
      background:linear-gradient(135deg,rgba(10,46,76,0.95) 0%,rgba(26,94,147,0.92) 100%);
      color:#fff;
      padding:12px 18px;border-radius:18px;
      box-shadow:0 8px 24px -6px rgba(7,33,54,0.55),0 1px 3px rgba(7,33,54,0.2);
      border:1px solid rgba(255,255,255,0.14);
      backdrop-filter:blur(10px);
      cursor:pointer;
      font-size:15px;font-weight:600;
      transition:transform .18s ease, box-shadow .18s ease;
      user-select:none;
    }
    #ki-weather-pill:hover {
      transform:translateY(-1px);
      box-shadow:0 10px 28px -6px rgba(7,33,54,0.65),0 2px 4px rgba(7,33,54,0.25);
    }
    #ki-weather-pill .emoji { font-size:30px;line-height:1; }
    #ki-weather-pill .temp  {
      font-family:'Montserrat',system-ui,sans-serif;
      font-weight:800;font-size:24px;letter-spacing:-0.02em;line-height:1;
    }
    #ki-weather-pill .info  { display:flex;flex-direction:column;align-items:flex-start;gap:2px; }
    #ki-weather-pill .city  { opacity:0.7;font-size:10px;font-weight:600;letter-spacing:0.12em; }
    #ki-weather-panel {
      position:absolute;top:calc(100% + 8px);right:0;
      background:linear-gradient(135deg,rgba(10,46,76,0.96) 0%,rgba(26,94,147,0.92) 100%);
      color:#fff;border-radius:14px;padding:14px;
      min-width:240px;
      box-shadow:0 12px 36px -8px rgba(7,33,54,0.55);
      border:1px solid rgba(255,255,255,0.12);
      backdrop-filter:blur(10px);
      opacity:0;transform:translateY(-4px) scale(.98);
      pointer-events:none;
      transition:opacity .16s ease, transform .16s ease;
    }
    #ki-weather.open #ki-weather-panel {
      opacity:1;transform:translateY(0) scale(1);pointer-events:auto;
    }
    #ki-weather-panel .row { display:flex;gap:6px; }
    #ki-weather-panel .day {
      flex:1;text-align:center;padding:8px 6px;border-radius:10px;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.08);
    }
    #ki-weather-panel .day.today {
      background:rgba(244,181,61,0.18);
      border-color:rgba(244,181,61,0.35);
    }
    #ki-weather-panel .day .name { font-size:10px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;font-weight:700;margin-bottom:4px; }
    #ki-weather-panel .day .ico { font-size:20px;line-height:1;margin-bottom:4px; }
    #ki-weather-panel .day .max { color:#f4b53d;font-weight:700;font-size:13px; }
    #ki-weather-panel .day .min { opacity:0.55;font-size:12px;margin-left:4px; }
    #ki-weather-panel .meta {
      margin-top:10px;font-size:10px;opacity:0.5;text-align:right;letter-spacing:0.05em;
    }
    @media (max-width:768px) {
      #ki-weather { top:200px;right:10px; }
      #ki-weather-pill { padding:10px 14px;gap:8px; }
      #ki-weather-pill .emoji { font-size:24px; }
      #ki-weather-pill .temp { font-size:20px; }
    }
  `;
  document.head.appendChild(s);
}

function renderPill(data) {
  const { temperature, weathercode } = data.current_weather;
  const { emoji, label } = weatherCodeToIcon(weathercode);
  return `
    <div id="ki-weather-pill" role="button" aria-expanded="false" aria-label="Hava durumu — detay için tıkla">
      <span class="emoji">${emoji}</span>
      <span class="temp">${Math.round(temperature)}°</span>
      <span class="info">
        <span style="font-size:12px;font-weight:500;opacity:0.85;line-height:1;">${label}</span>
        <span class="city">KALKAN</span>
      </span>
    </div>
  `;
}

function renderPanel(data) {
  const daily = data.daily;
  const cards = (daily.time || []).map((dateStr, i) => {
    const { emoji, label } = weatherCodeToIcon(daily.weathercode[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    return `
      <div class="day ${i === 0 ? 'today' : ''}" title="${label}">
        <div class="name">${dayLabel(dateStr, i)}</div>
        <div class="ico">${emoji}</div>
        <div><span class="max">${max}°</span><span class="min">${min}°</span></div>
      </div>
    `;
  }).join('');
  return `
    <div id="ki-weather-panel" role="region" aria-label="3 günlük tahmin">
      <div class="row">${cards}</div>
      <div class="meta">Open-Meteo</div>
    </div>
  `;
}

function renderError() {
  return `
    <div id="ki-weather-pill" title="Hava durumu yüklenemedi">
      <span class="emoji">🌡️</span>
      <span class="temp">—</span>
      <span class="city">KALKAN</span>
    </div>
  `;
}

function ensureContainer() {
  let el = document.getElementById('ki-weather');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'ki-weather';
  document.body.appendChild(el);
  return el;
}

function bindToggle(container) {
  const pill = container.querySelector('#ki-weather-pill');
  if (!pill) return;
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    container.classList.toggle('open');
    pill.setAttribute('aria-expanded', container.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      container.classList.remove('open');
      pill.setAttribute('aria-expanded', 'false');
    }
  });
}

export async function mountWeatherWidget() {
  injectStylesOnce();
  const container = ensureContainer();

  // Eski büyük mount (#weather-mount) varsa içini boşalt — yeni widget body'de
  const legacy = document.getElementById('weather-mount');
  if (legacy) legacy.innerHTML = '';

  const cached = readCache();
  if (cached) {
    container.innerHTML = renderPill(cached) + renderPanel(cached);
    bindToggle(container);
  }

  const data = await fetchWeather();
  if (!data) {
    if (!cached) container.innerHTML = renderError();
    return;
  }
  container.innerHTML = renderPill(data) + renderPanel(data);
  bindToggle(container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountWeatherWidget());
} else {
  mountWeatherWidget();
}
