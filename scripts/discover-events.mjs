#!/usr/bin/env node
/**
 * discover-events.mjs — Kalkan/Kaş etkinlik keşif scripti
 *
 * Kaynak A: SerpApi google_events — "Kalkan etkinlik", "Kaş concert" vb.
 * Kaynak B: extractEventFromText(text) — Claude Haiku ile serbest metin çıkarımı
 *           (IG caption / duyuru besler, ileride IG scraper bağlanır)
 *
 * Kullanım:
 *   node scripts/discover-events.mjs
 *   node scripts/discover-events.mjs --dry-run
 *
 * Çıktı: data/etkinlik-takvimi.json → oneoff[] kısmına ekler
 *   (recurring[], _meta dokunulmaz — id ile dedup yapılır)
 *
 * Hatalar:
 *   SerpApi quota dolu → net mesaj, script devam eder (0 serpapi sonuç)
 *   Anthropic key geçersiz → extractEventFromText null döner, uyarı basar
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { cheapJSON } from '../lib/cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const DATA     = join(ROOT, 'data');

// ─── Env yükle (.env.local) ───────────────────────────────────────────────
async function loadEnv() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, '');
  }
}
await loadEnv();

// ─── Argümanlar ────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('ℹ  --dry-run aktif, dosya yazılmayacak\n');

// ─── Sabitler ──────────────────────────────────────────────────────────────
const SERPAPI_KEY    = process.env.SERPAPI_KEY;

const VALID_TYPES = [
  'Canlı Müzik', 'DJ', 'Akustik', 'Karaoke',
  'Quiz Gecesi', 'Happy Hour', 'Türk Gecesi', 'Parti', 'Festival',
];

const SERPAPI_QUERIES = [
  'Kalkan etkinlik',
  'Kaş concert',
  'Kalkan DJ',
  'Kalkan live music',
  'Kaş festival',
];

// ─── Yardımcı: JSON oku ────────────────────────────────────────────────────
async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

// ─── Mekan indeksi ─────────────────────────────────────────────────────────
let _venues = null;
async function venueIndex() {
  if (_venues) return _venues;
  const r = await readJson(join(DATA, 'restoranlar.json'), { items: [] });
  const byId   = new Map();
  const byName = new Map();
  for (const v of r.items || []) {
    if (v.id)   byId.set(v.id, v);
    if (v.name) byName.set(v.name.toLowerCase().trim(), v);
  }
  _venues = { byId, byName, items: r.items || [] };
  return _venues;
}

/**
 * Mekan adını restoranlar.json'a eşleştirir.
 * Tam eşleşme → önce. Sonra "içerir" kontrolü.
 * @returns {{ venueId: string|null, area: string }}
 */
async function matchVenue(rawName) {
  if (!rawName) return { venueId: null, area: 'Kalkan' };
  const { byName, items } = await venueIndex();
  const q = rawName.toLowerCase().trim();

  // Tam eşleşme
  const exact = byName.get(q);
  if (exact) return { venueId: exact.id || null, area: exact.area || guessArea(rawName) };

  // Kısmi eşleşme (venue adı sorgu içeriyorsa veya tam tersi)
  for (const v of items) {
    const vn = (v.name || '').toLowerCase();
    if (vn.includes(q) || q.includes(vn)) {
      return { venueId: v.id || null, area: v.area || guessArea(rawName) };
    }
  }
  return { venueId: null, area: guessArea(rawName) };
}

function guessArea(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('kaş') || n.includes('kas')) return 'Kaş';
  return 'Kalkan';
}

// ─── ID üret ──────────────────────────────────────────────────────────────
function makeId(date, venueName, title) {
  const slug = `${date}-${venueName}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  const hash = createHash('md5').update(slug).digest('hex').slice(0, 6);
  return `oneoff-${hash}`;
}

// ─── Tip eşleştir (metin içinde type ara) ─────────────────────────────────
function guessType(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('dj') || t.includes('party') || t.includes('parti')) return 'DJ';
  if (t.includes('akustik') || t.includes('acoustic'))                  return 'Akustik';
  if (t.includes('karaoke'))                                             return 'Karaoke';
  if (t.includes('quiz'))                                                return 'Quiz Gecesi';
  if (t.includes('happy hour'))                                          return 'Happy Hour';
  if (t.includes('türk') || t.includes('fasıl'))                        return 'Türk Gecesi';
  if (t.includes('festival'))                                            return 'Festival';
  if (t.includes('canlı') || t.includes('live') || t.includes('music') || t.includes('müzik')) return 'Canlı Müzik';
  return 'Canlı Müzik';
}

// ─── Kaynak A: SerpApi google_events ──────────────────────────────────────
async function fetchSerpEvents(query) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_events');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'tr');
  url.searchParams.set('gl', 'tr');
  url.searchParams.set('api_key', SERPAPI_KEY);

  let res;
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
  } catch (err) {
    console.warn(`  [SerpApi] Ağ hatası ("${query}"): ${err.message}`);
    return [];
  }

  const data = await res.json().catch(() => ({}));

  // Quota dolu / hata kontrolü
  if (data.error) {
    const msg = String(data.error);
    if (msg.toLowerCase().includes('run out') || msg.toLowerCase().includes('quota')) {
      console.warn(`  [SerpApi] Quota dolu — "${query}" atlandı. Aylık reset sonrası tekrar dene.`);
    } else {
      console.warn(`  [SerpApi] Hata ("${query}"): ${msg}`);
    }
    return [];
  }

  const rawEvents = data.events_results || [];
  console.log(`  [SerpApi] "${query}" → ${rawEvents.length} sonuç`);
  return rawEvents;
}

/**
 * SerpApi google_events sonucunu normalize eder → oneoff item
 */
async function normalizeSerpEvent(raw) {
  // SerpApi event yapısı: { title, date:{start_date,when}, address[], link, venue:{name} }
  const title     = raw.title || '';
  const venueName = raw.venue?.name || (raw.address || [])[0] || '';
  const address   = (raw.address || []).join(', ');

  // Tarih ayrıştır
  let date = null;
  const dateStr = raw.date?.start_date || raw.date?.when || '';
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    date = isoMatch[0];
  } else {
    // "28 Haziran 2026" gibi Türkçe tarih
    const trMonths = {
      ocak:'01', şubat:'02', mart:'03', nisan:'04', mayıs:'05', haziran:'06',
      temmuz:'07', ağustos:'08', eylül:'09', ekim:'10', kasım:'11', aralık:'12',
    };
    const m = dateStr.toLowerCase().match(/(\d{1,2})\s+([a-züşğıçö]+)\s+(\d{4})/);
    if (m) {
      const mon = trMonths[m[2]] || '01';
      date = `${m[3]}-${mon}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  if (!date) return null; // tarihi çözemezsek atla

  // Saat
  const timeMatch = (raw.date?.when || '').match(/(\d{1,2}:\d{2})/);
  const time = timeMatch ? timeMatch[1] : '21:00';

  const { venueId, area } = await matchVenue(venueName);

  return {
    id:         makeId(date, venueName, title),
    venueId,
    venueName:  venueName || 'Bilinmiyor',
    area,
    type:       guessType(title + ' ' + (raw.description || '')),
    date,
    time,
    endTime:    null,
    title:      title.slice(0, 120),
    source:     'serpapi',
    confidence: 0.8,
    verified:   false,
  };
}

// ─── Kaynak B: Claude Haiku serbest metin çıkarımı ─────────────────────────
/**
 * extractEventFromText(text) → oneoff item | null
 *
 * IG caption / duyuru metninden etkinlik bilgisi çıkarır.
 * Anthropic key yoksa veya hata dönerse null döner.
 */
export async function extractEventFromText(text, { mockMode = false } = {}) {
  if (mockMode) {
    return _mockExtract(text);
  }
  return _cheapExtract(text);
}

// Basit regex tabanlı mock (Anthropic olmadan test edilebilir)
function _mockExtract(text) {
  const t = text || '';
  const TR_MONTHS = {
    ocak:'01', şubat:'02', mart:'03', nisan:'04', mayıs:'05', haziran:'06',
    temmuz:'07', ağustos:'08', eylül:'09', ekim:'10', kasım:'11', aralık:'12',
  };

  // Gün/tarih çıkar — önce explicit tarih ("15 Temmuz 2026"), sonra relatif gün
  const today = new Date();
  let date = today.toISOString().slice(0, 10);
  const explicitDate = t.toLowerCase().match(/(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{4})/);
  if (explicitDate) {
    const mon = TR_MONTHS[explicitDate[2]];
    date = `${explicitDate[3]}-${mon}-${String(explicitDate[1]).padStart(2, '0')}`;
  } else {
    const cumartesiM = t.match(/(?:bu\s+)?cumartesi/i);
    const cumaM      = t.match(/(?:bu\s+)?cuma/i);
    if (cumartesiM || cumaM) {
      const d = new Date();
      const dow = d.getDay(); // 0=Paz
      const targetDow = cumartesiM ? 6 : 5;
      let diff = (targetDow - dow + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      date = d.toISOString().slice(0, 10);
    }
  }

  // Saat
  const timeM = t.match(/(\d{1,2})[:.:](\d{2})/);
  const time  = timeM ? `${timeM[1].padStart(2,'0')}:${timeM[2]}` : '22:00';

  // Mekan (büyük harf blokları veya bilinen mekan isimleri)
  const knownVenues = ['Chocolate Club', 'Vibes Lounge', 'Shade Lounge', 'Mezzanine Bar',
                       'Black Gold', 'Fountain Terrace', 'Ehl-i Keyf', 'Noema'];
  let venueName = '';
  for (const v of knownVenues) {
    if (t.toLowerCase().includes(v.toLowerCase())) { venueName = v; break; }
  }
  if (!venueName) {
    const m = t.match(/(?:at|@|'da|'de|da|de)\s+([A-ZÇŞĞÜÖİ][a-zA-ZçşğüöıİÇŞĞÜÖ\s&']+?)(?:\.|!|,|$)/);
    venueName = m ? m[1].trim() : 'Bilinmiyor';
  }

  const type = guessType(t);

  // Başlık: ilk anlamlı cümle
  const title = t.split(/[.\n!]/)[0].trim().slice(0, 80) || 'Etkinlik';

  return {
    id:         makeId(date, venueName, title),
    venueId:    null, // matchVenue async, caller resolve edebilir
    venueName,
    area:       guessArea(venueName) || 'Kalkan',
    type,
    date,
    time,
    endTime:    null,
    title,
    source:     'instagram',
    confidence: 0.5,
    verified:   false,
  };
}

// cheap-llm router ile etkinlik çıkarımı (nvidia → gemini → ollama → claude)
async function _cheapExtract(text) {
  const today = new Date().toISOString().slice(0, 10);
  const system = `Bir Kalkan/Kaş etkinlik duyurusundan etkinlik bilgilerini JSON olarak çıkar. Bugün: ${today}.
Şu alanları döndür (bilinmiyorsa null): type (${VALID_TYPES.join(' / ')}), date (YYYY-MM-DD, relatif→bugüne göre), time (HH:MM), endTime (HH:MM veya null), venueName.
Sadece JSON döndür. Örnek: {"type":"DJ","date":"2026-07-05","time":"23:00","endTime":"04:00","venueName":"Chocolate Club"}`;

  let parsed;
  try {
    const { data, provider, model } = await cheapJSON(text, { system, maxTokens: 256 });
    console.log(`  [cheap-llm] extractEventFromText ✓ ${provider}/${model}`);
    parsed = data;
  } catch (err) {
    console.warn(`  [cheap-llm] Hata: ${err.message} — mock'a düşüldü`);
    return _mockExtract(text);
  }

  const venueName = parsed.venueName || '';
  const { venueId, area } = await matchVenue(venueName);
  const title = text.split(/[.\n!]/)[0].trim().slice(0, 80) || 'Etkinlik';
  const date  = parsed.date || new Date().toISOString().slice(0, 10);

  return {
    id:         makeId(date, venueName, title),
    venueId,
    venueName:  venueName || 'Bilinmiyor',
    area,
    type:       VALID_TYPES.includes(parsed.type) ? parsed.type : guessType(text),
    date,
    time:       parsed.time || '21:00',
    endTime:    parsed.endTime || null,
    title,
    source:     'instagram',
    confidence: 0.5,
    verified:   false,
  };
}

// ─── Ana akış ─────────────────────────────────────────────────────────────
async function main() {
  // Mevcut takvimi yükle
  const takvimPath = join(DATA, 'etkinlik-takvimi.json');
  const takvim = await readJson(takvimPath, { _meta: {}, recurring: [], oneoff: [] });
  const existingIds = new Set((takvim.oneoff || []).map(e => e.id));

  const newEvents = [];

  // ── Kaynak A: SerpApi ──────────────────────────────────────────────────
  if (!SERPAPI_KEY) {
    console.warn('[SerpApi] SERPAPI_KEY yok — SerpApi atlandı.\n');
  } else {
    console.log('── Kaynak A: SerpApi google_events ──');
    for (const q of SERPAPI_QUERIES) {
      const rawList = await fetchSerpEvents(q);
      for (const raw of rawList) {
        const ev = await normalizeSerpEvent(raw).catch(err => {
          console.warn(`  [SerpApi] Normalize hatası: ${err.message}`);
          return null;
        });
        if (!ev) continue;
        if (existingIds.has(ev.id)) continue;
        existingIds.add(ev.id);
        newEvents.push(ev);
        console.log(`  + ${ev.date} ${ev.time}  ${ev.type.padEnd(12)} ${ev.venueName}`);
      }
    }
    console.log(`  Toplam yeni (SerpApi): ${newEvents.length}\n`);
  }

  // ── Kaynak B: extractEventFromText — demo/test ─────────────────────────
  console.log('── Kaynak B: extractEventFromText (mock test) ──');
  const testTexts = [
    'Bu cumartesi 23:00 Chocolate Club\'da DJ gecesi! Hazır mısınız? 🎶 #kalkan #dj',
    'Cuma gecesi 21:30\'da Shade Lounge\'da akustik performans. Masa rezervasyon için DM.',
    'Kaş Müzik Festivali 15 Temmuz 2026 — açık hava sahnesi, 3 gün 3 gece festival.',
  ];

  for (const txt of testTexts) {
    const ev = await extractEventFromText(txt);
    if (!ev) { console.log(`  [skip] null döndü`); continue; }
    console.log(`  metin: "${txt.slice(0, 50)}..."`);
    console.log(`  → type:${ev.type}  date:${ev.date}  time:${ev.time}  venue:${ev.venueName}\n`);

    // Venüyü async resolve et (mock'ta venueId null gelir)
    const { venueId, area } = await matchVenue(ev.venueName);
    ev.venueId = ev.venueId ?? venueId;
    ev.area    = area;

    if (!existingIds.has(ev.id)) {
      existingIds.add(ev.id);
      newEvents.push(ev);
    }
  }

  console.log(`\n── Özet ──`);
  console.log(`Mevcut oneoff sayısı : ${(takvim.oneoff || []).length}`);
  console.log(`Yeni eklenecek       : ${newEvents.length}`);

  if (newEvents.length === 0) {
    console.log('Eklenecek yeni etkinlik yok.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Eklenecek etkinlikler:');
    console.log(JSON.stringify(newEvents, null, 2));
    return;
  }

  // Kayıt
  takvim.oneoff = [...(takvim.oneoff || []), ...newEvents];
  takvim._meta.updated = new Date().toISOString().slice(0, 10);
  await writeFile(takvimPath, JSON.stringify(takvim, null, 2), 'utf8');
  console.log(`\n✓ ${newEvents.length} etkinlik eklendi → data/etkinlik-takvimi.json`);
}

main().catch(err => {
  console.error('Kritik hata:', err);
  process.exit(1);
});
