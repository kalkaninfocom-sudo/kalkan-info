/**
 * sources.mjs — Kalkan Today gazetesi gerçek veri kaynağı
 *
 * Generator'ı demo veriden kurtarır. Her alan canlı kaynaktan dolar,
 * kaynak yoksa/çevrimdışıysa demo değere düşer (graceful fallback).
 *
 * Kaynaklar:
 *   - Hava/deniz/UV/rüzgar/gün doğ-bat → Open-Meteo (weather.js ile aynı koordinat)
 *   - Manşet + 3 sütun                  → data/haberler.json (canlı RSS akışı)
 *   - Şefin Önerisi + reklam slotu       → data/restoranlar.json
 *   - Nöbetçi eczane                     → data/eczane.json (her gün 06:00 otomatik)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eventsForDate } from '../../scripts/events-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const DATA = join(REPO, 'data');

// ─── ROTASYON GEÇMİŞİ (tekrarı kır) ───
// Berkay: "her gün Kaptan restoran öneriliyor, magazin hep aynı mekan". Seçim deterministik + geçmişsizdi.
// Bu dosya son önerilen mekan/hero id'lerini tutar; seçim son N günde kullanılmayanı önceler.
const HISTORY_FILE = join(DATA, 'gazete-history.json');
async function loadHistory() {
  try { return JSON.parse(await readFile(HISTORY_FILE, 'utf8')); } catch { return {}; }
}
async function recordHistory(key, id, iso, keep = 25) {
  if (id == null) return;
  const h = await loadHistory();
  const arr = Array.isArray(h[key]) ? h[key] : [];
  const filtered = arr.filter(e => !(e.id === id && e.date === iso)); // aynı gün 2. build idempotent
  filtered.push({ id, date: iso });
  h[key] = filtered.slice(-keep);
  try { await writeFile(HISTORY_FILE, JSON.stringify(h, null, 2)); } catch {}
}
function recentIds(history, key, days, iso) {
  const arr = Array.isArray(history[key]) ? history[key] : [];
  const cutoff = new Date(iso + 'T00:00:00'); cutoff.setDate(cutoff.getDate() - days);
  return new Set(arr.filter(e => new Date(e.date + 'T00:00:00') >= cutoff).map(e => e.id));
}
// Son N günde kullanılmayan adaylardan, gün-tabanlı deterministik offset ile seç (stabil ama her gün farklı).
function pickRotated(candidates, history, key, iso, days = 6) {
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;
  const recent = recentIds(history, key, days, iso);
  const fresh = list.filter(c => !recent.has(c.id));
  const pool = fresh.length ? fresh : list;             // hepsi tükendiyse tüm havuza dön
  const offset = Number(issueOf(iso)) % pool.length;    // gün numarası → deterministik dönüş
  return pool[offset];
}

const KALKAN_LAT = 36.2658;
const KALKAN_LNG = 29.4118;

const DAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function formatDateLong(iso) {
  const d = new Date(iso + 'T08:00:00');
  return `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}`;
}
export function dayOf(iso) {
  return DAY_TR[new Date(iso + 'T08:00:00').getDay()];
}
export function issueOf(iso) {
  const start = new Date('2026-06-01T00:00:00');
  const d = new Date(iso + 'T00:00:00');
  return String(Math.max(1, Math.round((d - start) / 86400000) + 1)).padStart(3, '0');
}

// ─── Yardımcılar ───
async function readJson(name) {
  try {
    return JSON.parse(await readFile(join(DATA, name), 'utf8'));
  } catch {
    return null;
  }
}

function windCompassTR(deg) {
  if (deg == null) return '';
  const dirs = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
  return dirs[Math.round(deg / 45) % 8];
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Düz metni 1-2 paragrafa böl (manşet gövdesi için)
function toParagraphs(text, maxParas = 2, maxChars = 620) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, maxChars + 120);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const paras = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > maxChars / maxParas && buf) {
      paras.push(buf.trim());
      buf = '';
      if (paras.length >= maxParas) break;
    }
    buf += s + ' ';
  }
  if (buf.trim() && paras.length < maxParas) paras.push(buf.trim());
  return paras.map(p => `<p>${esc(p)}</p>`).join('\n');
}

function trimWords(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  // Cümle sınırında kesmeyi dene (maxChars'ın %55'inden sonra nokta varsa)
  const lastDot = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastDot > maxChars * 0.55) return slice.slice(0, lastDot + 1);
  return slice.replace(/\s+\S*$/, '') + '…';
}

// ─── 1) HAVA DURUMU (Open-Meteo) ───
export async function getWeather() {
  const out = {};
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${KALKAN_LAT}&longitude=${KALKAN_LNG}` +
      `&current_weather=true&daily=uv_index_max,sunrise,sunset&timezone=Europe%2FIstanbul&forecast_days=1`;
    const res = await fetch(url);
    if (res.ok) {
      const d = await res.json();
      const cw = d.current_weather || {};
      out.weather_air = Math.round(cw.temperature) ? String(Math.round(cw.temperature)) : undefined;
      const dir = windCompassTR(cw.winddirection);
      const spd = cw.windspeed != null ? `${Math.round(cw.windspeed)} km/h` : '';
      out.weather_wind = [dir, spd].filter(Boolean).join(' ') || undefined;
      if (d.daily) {
        if (d.daily.uv_index_max?.[0] != null) out.weather_uv = String(Math.round(d.daily.uv_index_max[0]));
        if (d.daily.sunrise?.[0]) out.sunrise = d.daily.sunrise[0].slice(11, 16);
        if (d.daily.sunset?.[0]) out.sunset = d.daily.sunset[0].slice(11, 16);
      }
    }
  } catch { /* fallback */ }

  // Deniz suyu sıcaklığı — Open-Meteo Marine API
  try {
    const murl = `https://marine-api.open-meteo.com/v1/marine?latitude=${KALKAN_LAT}&longitude=${KALKAN_LNG}` +
      `&current=sea_surface_temperature&timezone=Europe%2FIstanbul`;
    const res = await fetch(murl);
    if (res.ok) {
      const d = await res.json();
      const sst = d.current?.sea_surface_temperature;
      if (sst != null) {
        out.weather_sea = String(Math.round(sst));
        out.water_temp = String(Math.round(sst));
      }
    }
  } catch { /* fallback */ }

  return out;
}

// ─── 2) HABERLER (manşet + 2 haber sütunu) ───
// Kalkan-yerel skorlama: tatilci gazetesine ulusal/dünya politikası sızmasın.
// ÇEKİRDEK yer adları (Kalkan/Kaş/Patara ekseni). 'antalya' KASITLI yok — il-geneli haber
// çekirdek yer geçmiyorsa ön sayfayı basmasın (Berkay: "haber Antalya merkezli, Kalkan değil").
const CORE_RX = [
  /\bkalkan\b/i, /\bkaş\b/i, /\bpatara\b/i, /\bkaputaş\b/i, /\bletoon\b/i,
  /\bksanthos\b/i, /\bxanthos\b/i, /\blik[iy]a\b/i, /\bsaklıkent\b/i,
  /\bislamlar\b/i, /\bbezirgan\b/i, /\bçukurbağ\b/i, /\bkalamar\b/i, /\bkutso\b/i, /\bdemre\b/i,
];
const TOURIST_CATS = { Turizm: 2, Plaj: 2, Etkinlik: 2, Kültür: 2, Belediye: 0, Gündem: 0, Hava: 1, Asayiş: -3 };

function newsScore(it) {
  const txt = `${it.title || ''} ${it.summary || ''} ${(it.tags || []).join(' ')}`;
  let s = 0;
  const hasCore = CORE_RX.some(rx => rx.test(txt));
  if (hasCore) s += 3;                                   // Kalkan/Kaş/Patara ekseni → güçlü
  else if (/\bantalya\b/i.test(txt)) s -= 4;             // yalnız Antalya (çekirdek yok) → tatilci gazetesine girmesin
  if (/\bkalkan\b/i.test(txt)) s += 2;                   // Kalkan'ın kendisi ekstra
  // Kaynak güveni: yerel > bölgesel > ulusal
  const src = it.source || '';
  if (/kalkan/i.test(src)) s += 3;
  else if (/körfez|antalya/i.test(src)) s += 1;
  else s -= 5; // Anadolu Ajansı vb. ulusal/dünya
  // Tatilci kategorisi
  s += TOURIST_CATS[it.category] ?? 0;
  if (it.featured) s += 1;
  return s;
}

export async function getNews() {
  // ── EDİTÖRYAL KATMAN (Faz 1: ajans↔gazete) ── agent-yazımı bugünün dosyası varsa ÖNCE onu kullan.
  // scripts/agency/gazete-editorial.mjs üretir. Yoksa/eskiyse ham RSS'e fallback (aşağısı).
  try {
    const ed = await readJson('gazete-today.json');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    if (ed && ed.date === today && ed.lead_headline) {
      const { magazine_lead_headline, magazine_lead_body, date, generated_at, provider, source_ids, ...front } = ed;
      return front; // getNews ile aynı alan adları (lead_*/col1_*/col3_*)
    }
  } catch {}

  const data = await readJson('haberler.json');
  if (!data?.items?.length) return {};
  // Skor + tarih ile sırala
  const ranked = [...data.items]
    .map(it => ({ it, score: newsScore(it) }))
    .sort((a, b) => b.score - a.score || (b.it.date || '').localeCompare(a.it.date || ''));

  const used = new Set();
  const take = (filter) => {
    const hit = ranked.find(r => !used.has(r.it.id) && r.score > -3 && filter(r.it));
    if (hit) used.add(hit.it.id);
    return hit?.it;
  };

  // Manşet: en yüksek skorlu (tatilciye uygun + yerel)
  const lead = take(() => true) || ranked[0]?.it;
  if (lead) used.add(lead.id);
  // col1 "Bugün Kalkan'da": Etkinlik/Kültür/Belediye
  const c1 = take(it => ['Etkinlik', 'Kültür', 'Belediye', 'Gündem'].includes(it.category)) || take(() => true);
  // col3 "Plaj & Antik": Plaj/Turizm/Hava
  const c3 = take(it => ['Plaj', 'Turizm', 'Hava'].includes(it.category)) || take(() => true);

  const out = {};
  if (lead) {
    out.lead_headline = lead.title;
    out.lead_deck = trimWords(lead.summary, 180);
    out.lead_byline = `${lead.source || 'Kalkan Today'} · ${formatDateLong(lead.date)}`;
    out.lead_body = toParagraphs(lead.content || lead.summary);
    if (lead.image) out.lead_image = lead.image;
    out.lead_caption = `Foto: ${lead.source || 'Kalkan Today arşivi'} · ${lead.category || ''}`.trim();
  }
  if (c1) {
    out.col1_title = c1.title;
    out.col1_byline = `Bülten · ${c1.category || ''}`;
    out.col1_body = trimWords(c1.summary || c1.content, 240);
  }
  if (c3) {
    out.col3_title = c3.title;
    out.col3_byline = `Sahil · ${c3.category || ''}`;
    out.col3_body = trimWords(c3.summary || c3.content, 240);
  }
  return out;
}

// ─── 3) RESTORAN (Şefin Önerisi col2 + reklam slotu) ───
export async function getRestaurant(iso, opts = {}) {
  const data = await readJson('restoranlar.json');
  if (!data?.items?.length) return {};
  const items = data.items;
  const history = await loadHistory();
  const day = iso || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  const detailUrl = (r) => {
    if (r.customSiteUrl) return r.customSiteUrl;
    if (r.detailPath) return `https://kalkaninfo.com/${r.detailPath.replace(/^\//, '')}`;
    if (r.website) return r.website;
    return 'https://kalkaninfo.com/restoranlar/';
  };

  const out = {};

  // ── Reklam slotu: ücretli sponsor (source=client) ROTASYON DIŞI (parası ödenmiş, hep göster).
  //    Sponsor yoksa: yüksek puanlı detay-sayfalı mekanlardan ROTASYONLA (son 6 gün tekrarı önle).
  let ad = items.find(r => r.source === 'client' && (r.phone || r.reservation));
  if (!ad) {
    const ratedPool = items
      .filter(r => r.rating && r.reviewCount >= 30 && (r.detailPath || r.customSiteUrl))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 12); // üst havuz — kaliteyi koru, içinden döndür
    ad = pickRotated(ratedPool, history, 'ad', day);
  }
  if (ad) {
    out.ad_title = `${ad.name}${ad.location ? ' — ' + ad.location : ''}`;
    const sum = trimWords(ad.summary || (ad.specialties || []).join(', '), 150);
    out.ad_body = `${sum}${ad.phone ? ' · Rezervasyon: ' + ad.phone : ''}`.trim();
    out.ad_cta = ad.reservation ? 'Hemen Rezervasyon' : 'Mekanı Keşfet';
    out.ad_qr_url = detailUrl(ad);
    if (ad.source !== 'client') await recordHistory('ad', ad.id, day); // sponsoru geçmişe yazma (rotasyon dışı)
  }

  // ── col2 "Şefin Önerisi": yüksek puanlı YEMEK mekanı GENİŞ havuzundan ROTASYONLA (ad ile aynı olmasın).
  //    summary ŞART DEĞİL (yalnız 7 mekanda var → rotasyon çökerdi); yoksa gövde kategori/uzmanlıktan üretilir.
  const chefAll = items
    .filter(r => r.rating && (r.reviewCount || 0) >= 25 && r.id !== ad?.id)
    .sort((a, b) => b.rating - a.rating);
  const chefFood = chefAll.filter(r => !/\b(bar|pub|club|gece kul|fast\s?food|pastane|tatlı|çay bah)/i.test(`${r.category || ''} ${r.name || ''}`));
  const chefPool = (chefFood.length ? chefFood : chefAll).slice(0, 40);
  const chef = pickRotated(chefPool, history, 'chef', day, 8); // 8 gün dedup — geniş havuzla gerçek çeşitlilik
  if (chef) {
    const blurb = chef.summary
      ? trimWords(chef.summary, 230)
      : trimWords(`${chef.category || 'Restoran'}${chef.location ? ' · ' + chef.location : ''}. ${(chef.specialties || []).slice(0, 3).join(', ')}`.replace(/\.\s*$/, '') +
          (chef.reviewCount ? ` · ${chef.reviewCount}+ değerlendirme` : ''), 230);
    out._chef = {
      title: `Şefin Önerisi · ${chef.name}`,
      byline: `Restoran · ${chef.category || ''} · ⭐${chef.rating}`,
      body: blurb,
    };
    await recordHistory('chef', chef.id, day);
  }
  return out;
}

// ─── 3b) ETKİNLİK TAKVİMİ ("Bugün Kalkan'da") ───
export async function getEventsColumn(iso) {
  let evs = [];
  try { evs = await eventsForDate(iso); } catch { return {}; }
  if (!evs.length) return {};
  const parts = evs.slice(0, 4).map(e =>
    `<strong>${esc(e.time)}</strong> ${esc(e.type)} · ${esc(e.venueName)}${e.area ? ' (' + esc(e.area) + ')' : ''}`
  );
  const draft = evs.some(e => !e.verified);
  return {
    col1_title: `Bugün Kalkan'da · ${evs.length} Etkinlik`,
    col1_byline: `Gece programı${draft ? ' · taslak' : ''}`,
    col1_body: parts.join(' &nbsp;·&nbsp; '),
  };
}

// ─── 3c) REKLAM (İLAN slotları — data/ads.json) ───
// newspaper_ads şemasını yansıtan yerel envanter. QR /q/<slug> statik redirect'e gider.
export async function getAds(iso) {
  const data = await readJson('ads.json');
  const ads = data?.ads || [];
  const active = ads.filter(a =>
    a.status === 'active' &&
    (!a.starts_at || iso >= a.starts_at) &&
    (!a.ends_at || iso <= a.ends_at));
  const qr = slug => `https://kalkaninfo.com/q/${slug}`;
  const out = {};

  // Sabah manşet sponsoru: lead_sponsor / advertorial, edition morning|both
  const lead = active.find(a =>
    ['lead_sponsor', 'advertorial'].includes(a.slot_type) &&
    ['morning', 'both'].includes(a.edition));
  if (lead) {
    out.ad_title = lead.title;
    out.ad_body = lead.body;
    out.ad_cta = lead.cta_label || 'Detay';
    out.ad_qr_url = qr(lead.slug);
  }

  // Magazin sponsoru: magazine_sponsor / edition magazine|both
  const mag = active.find(a =>
    a.slot_type === 'magazine_sponsor' ||
    (['magazine', 'both'].includes(a.edition) && a.slot_type === 'advertorial'));
  if (mag) out._magSponsor = { slug: mag.slug, venue: mag.venue };

  return out;
}

// ─── 4) NÖBETÇİ ECZANE ───
export async function getPharmacy() {
  const data = await readJson('eczane.json');
  const t = data?.today;
  if (!t?.name) return {};
  return {
    pharmacy_name: t.name,
    pharmacy_addr: trimWords(t.address, 40),
    pharmacy_phone: t.phone || t.phoneRaw || '',
  };
}

// ─── ANA BİRLEŞTİRİCİ ───
export async function buildData(iso, demo) {
  const base = {
    date: iso,
    date_long: formatDateLong(iso),
    day: dayOf(iso),
    issue: issueOf(iso),
    vol: '1',
  };

  // Paralel çek
  const [weather, news, resto, pharmacy, eventsCol, ads] = await Promise.all([
    getWeather(), getNews(), getRestaurant(iso), getPharmacy(), getEventsColumn(iso), getAds(iso),
  ]);
  delete ads._magSponsor; // magazin-özel alan, sabahta kullanılmaz

  // col2 "Mekan & Yaşam": her zaman Şefin Önerisi (restoran) — on-brand, daima yerel
  const chef = resto._chef;
  delete resto._chef;

  const chefOverlay = chef ? {
    col2_title: chef.title,
    col2_byline: chef.byline,
    col2_body: chef.body,
  } : {};

  // Autobüs sabit (saat tablosu henüz veri kaynağı yok)
  const staticBus = { bus_next: '08:15 → Kaş', bus_route: 'Kalkan Otogar · saat başı' };

  // Demo fallback değerleri (her alan için)
  const fallback = demo;

  // undefined alanları demo'dan tamamla
  // col1 önceliği: bugünün etkinlik takvimi > haber
  // ads en sonda (restoran reklam slotunu ezer — ücretli İLAN önceliklidir)
  const merged = { ...fallback, ...base, ...staticBus, ...clean(weather), ...clean(news), ...clean(eventsCol), ...clean(resto), ...clean(chefOverlay), ...clean(pharmacy), ...clean(ads) };
  return merged;
}

// ══════════════════════════════════════════════════════════════
//  MAGAZİN ARKA YÜZ (gece hayatı eki)
// ══════════════════════════════════════════════════════════════
function absPhoto(p) {
  if (!p) return null;
  if (/^https?:/i.test(p)) return p;
  // Yerel /assets yolunu PDF render için file:// olarak çöz (ağdan bağımsız)
  const rel = String(p).replace(/^\//, '');
  const local = join(REPO, rel);
  if (existsSync(local)) return pathToFileURL(local).href;
  return `https://kalkaninfo.com/${rel}`;
}
function venuePhoto(v) {
  return absPhoto(v.image || (v.gallery && v.gallery[0]) || null);
}

// Manşet havuzları — kategori/etkinlik tipine göre (deterministik, index ile seçilir)
const HEADLINES = {
  dj: ['{v} dün geceyi salladı', '{v}’ta sabaha kadar dans', '{v} gecesi alev aldı', '{v}’ta ritim hiç durmadı'],
  muzik: ['{v}’ta canlı müzik coşkusu', 'Notalar {v} terasında yükseldi', '{v} sahnesi doldu taştı', '{v}’ta unutulmaz bir akşam'],
  lounge: ['{v}’ta mavi saat keyfi', '{v} terasında gün batımı şöleni', '{v}’ta zarif bir gece'],
  turk: ['{v}’ta Türk gecesi şöleni', '{v}’ta fasıl coşkusu'],
  default: ['{v}’ta hareketli bir akşam', '{v} hafta sonuna hazır', '{v}’ta keyifli kalabalık'],
};
function headlineFor(v, ev, idx, seed = 0) {
  const cat = `${v?.category || ''} ${ev?.type || ''}`.toLowerCase();
  let pool = HEADLINES.default;
  if (/dj|parti|gece kul|club|night/.test(cat)) pool = HEADLINES.dj;
  else if (/türk/.test(cat)) pool = HEADLINES.turk;
  else if (/müzik|muzik|akustik|canlı|live|karaoke/.test(cat)) pool = HEADLINES.muzik;
  else if (/lounge|bar|pub|teras|beach|plaj/.test(cat)) pool = HEADLINES.lounge;
  const name = v?.name || ev?.venueName || 'Kalkan';
  // seed = gün numarası → aynı mekan farklı günlerde farklı manşetle çıkar (konserve tekrarı kırar)
  return pool[(idx + seed) % pool.length].replace('{v}', name);
}
function deckFor(v, ev) {
  if (ev) {
    return `${ev.day || ''} akşamı ${ev.type?.toLowerCase() || 'program'}${ev.time ? ' · ' + ev.time : ''}. ` +
      trimWords(v?.summary || `${v?.name || ev.venueName} gece hayatının nabzını tutuyor.`, 140);
  }
  return trimWords(v?.summary || `${v?.name || 'Mekan'} Kalkan gece hayatının gözdesi.`, 150);
}

export async function buildMagazineData(iso, demo) {
  const base = {
    date: iso, date_long: formatDateLong(iso), day: dayOf(iso), issue: issueOf(iso), vol: '1',
  };
  const data = await readJson('restoranlar.json');
  const items = data?.items || [];

  // Gece hayatı mekanları — fotoğraflı olanlar öne
  const night = items.filter(v =>
    /gece kul|bar & pub|pub|lounge|beach|plaj kul|club/i.test(`${v.category} ${v.name}`));
  const withPhoto = night.filter(venuePhoto);
  const ranked = [...withPhoto, ...night.filter(v => !venuePhoto(v))];

  // Ücretli magazin sponsoru (İLAN) — data/ads.json
  const adsData = await getAds(iso);
  const magSponsor = adsData._magSponsor || null;

  // Bu akşamın etkinlikleri (program + manşet eşleştirme)
  let todays = [];
  try { todays = await eventsForDate(iso); } catch { /* yok say */ }
  const evByVenue = new Map();
  for (const e of todays) if (e.venueName) evByVenue.set(e.venueName.toLowerCase(), e);
  const evFor = (v) => evByVenue.get((v.name || '').toLowerCase()) || null;

  // Hero: (1) bugün ETKİNLİĞİ olan gece mekanı öncelik → gerçek program bağlantısı, (2) ROTASYON.
  const history = await loadHistory();
  const daySeed = Number(issueOf(iso));
  const eventVenues = ranked.filter(v => evFor(v));                 // bugün programı olanlar
  const heroBase = eventVenues.length ? eventVenues : ranked;
  const heroWithPhoto = heroBase.filter(venuePhoto);
  const heroPool = heroWithPhoto.length ? heroWithPhoto : heroBase;
  const heroVenue = pickRotated(heroPool, history, 'mag_hero', iso) || ranked[0];
  if (heroVenue) await recordHistory('mag_hero', heroVenue.id, iso);
  const out = { ...base };

  if (heroVenue) {
    const ev = evFor(heroVenue);
    const photo = venuePhoto(heroVenue);
    out.hero_venue = `${heroVenue.name}${heroVenue.location ? ' · ' + heroVenue.location : ' · Kalkan'}`;
    out.hero_headline = headlineFor(heroVenue, ev, 0, daySeed);
    out.hero_deck = deckFor(heroVenue, ev);
    out.hero_kicker = ev ? `Gece · ${ev.type}` : 'Gece Hayatı';
    out.hero_img_tag = photo ? `<img src="${esc(photo)}" alt="${esc(heroVenue.name)}" onerror="this.style.display='none'">` : '';
    out.hero_noimg = photo ? '' : 'noimg';
    // Ücretli İLAN sponsoru öncelikli; yoksa hero mekan client ise sponsor etiketi
    out.hero_sponsor = magSponsor
      ? '<div class="sponsor">Sponsor İçerik · İLAN</div>'
      : (heroVenue.source === 'client' ? '<div class="sponsor">Sponsor İçerik · İLAN</div>' : '');
  }

  // 3 kart: hero dışı gece mekanları — son 3 günde kullanılmayanlar önce (kart tekrarını da kır).
  const recentCards = recentIds(history, 'mag_card', 3, iso);
  const cardBase = ranked.filter(v => v.id !== heroVenue?.id);
  const cardVenues = [...cardBase.filter(v => !recentCards.has(v.id)), ...cardBase.filter(v => recentCards.has(v.id))].slice(0, 3);
  for (const cv of cardVenues) await recordHistory('mag_card', cv.id, iso);
  out.cards = cardVenues.map((v, i) => {
    const ev = evFor(v);
    const photo = venuePhoto(v);
    const ph = photo
      ? `<div class="ph"><img src="${esc(photo)}" alt="${esc(v.name)}" onerror="this.style.display='none'"><span class="badge">${esc(ev?.type || v.category || 'Gece')}</span></div>`
      : `<div class="ph noimg"><span class="badge">${esc(ev?.type || v.category || 'Gece')}</span></div>`;
    return `<article class="card">
      ${ph}
      <div class="body">
        <div class="meta">${esc(v.location || 'Kalkan')}${ev ? ' · ' + esc(ev.time) : ''}</div>
        <h3>${esc(headlineFor(v, ev, i + 1, daySeed))}</h3>
        <p>${esc(trimWords(v.summary || deckFor(v, ev), 95))}</p>
      </div>
    </article>`;
  }).join('\n');

  // Bu akşam program tablosu
  if (todays.length) {
    out.program_rows = todays.slice(0, 6).map(e =>
      `<tr><td class="time">${esc(e.time || '')}</td><td class="type">${esc(e.type || '')}</td>` +
      `<td><span class="venue">${esc(e.venueName)}</span> <span class="area">${esc(e.area || '')}</span></td></tr>`
    ).join('\n');
    out.program_count = String(todays.length);
  } else {
    out.program_rows = '<tr><td class="empty" colspan="3">Bu akşam için yayınlanmış program yok — kalkaninfo.com/etkinlikler</td></tr>';
    out.program_count = '0';
  }

  return { ...demo, ...clean(out) };
}

// undefined/boş alanları ele (fallback ezilmesin)
function clean(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') o[k] = v;
  }
  return o;
}
