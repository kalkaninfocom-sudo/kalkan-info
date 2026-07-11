#!/usr/bin/env node
/**
 * scripts/agency/venue-signal.mjs
 * MEKAN SİNYAL / DOLULUK AJANI — Kalkan dijital ikizi için canlı mekan sinyalleri.
 *
 * Her mekan için:
 *   - Açık/kapalı durumu (harita-mekanlar.json'dan)
 *   - Doluluk tahmini (kategori + zaman heuristiği, saf deterministik)
 *   - Son Instagram gönderisi (ig-venue-intake.json'dan eşleşme)
 *
 * Çıktı: data/agency/venue-signals.json
 *
 * Kullanım: node scripts/agency/venue-signal.mjs
 * LLM YOK — tamamen deterministik, hızlı.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Ortam ──────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA = join(ROOT, 'data');

// Entry guard: doğrudan çalıştırıldığında ana fonksiyonu tetikle
const IS_MAIN = process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase().replace(/\\/g, '/') ===
  process.argv[1].toLowerCase().replace(/\\/g, '/');

// .env.local yükle (gerekli değil ama standart pattern)
try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

// ─── Kategori Zirve Saatleri ────────────────────────────────────────────────
const PEAK_HOURS = {
  restaurant:  [13, 20, 21],
  cafe:        [10, 11, 16],
  bar:         [22, 23,  0],
  beach_club:  [12, 13, 15],
  barber:      [11, 17, 18],
  hotel:       [14, 15, 16],
  default:     [20, 21],
};

/**
 * Saate göre zirveye mesafe (sirkular saatte minimum mesafe).
 * @param {number} hour - 0..23
 * @param {number[]} peaks - zirve saatleri listesi
 * @returns {number} - minimum mesafe (0 = tam zirve)
 */
function distToPeak(hour, peaks) {
  return Math.min(...peaks.map(p => {
    const d = Math.abs(hour - p);
    return Math.min(d, 24 - d); // sirkular mesafe
  }));
}

/**
 * Mekan için doluluk hesapla.
 * @param {{ category?: string, isOpen?: boolean, rating?: number, reviewCount?: number }} venue
 * @param {Date} [now]
 * @returns {{ pct: number, label: string, cls: string }}
 */
export function occupancyFor(venue, now = new Date()) {
  if (!venue.isOpen) {
    return { pct: 0, label: 'Kapalı', cls: 'low' };
  }

  const cat = (venue.category || 'default').toLowerCase();
  const peaks = PEAK_HOURS[cat] || PEAK_HOURS.default;
  const hour = now.getHours(); // yerel saat (Kalkan = UTC+3, sunucu ayarına göre)

  // Zirveye mesafe: 0 = zirve, 1 = 1 saat uzakta, vb.
  const dist = distToPeak(hour, peaks);

  // Taban doluluk: zirvedeyken ~80, 3 saat uzakta ~30
  const base = Math.max(20, 80 - dist * 17);

  // Puan nudges
  let nudge = 0;
  if ((venue.rating || 0) >= 4.6) nudge += 8;
  if ((venue.reviewCount || 0) > 400) nudge += 6;

  const pct = Math.min(97, Math.max(6, Math.round(base + nudge)));

  let label, cls;
  if (pct > 75)      { label = 'Çok yoğun'; cls = 'high'; }
  else if (pct > 52) { label = 'Yoğun';     cls = 'mid';  }
  else if (pct > 30) { label = 'Orta';       cls = 'low';  }
  else               { label = 'Sakin';      cls = 'low';  }

  return { pct, label, cls };
}

// ─── Instagram eşleştirme ───────────────────────────────────────────────────

/**
 * Bir IG kullanıcı adı veya URL'yi normalize et → küçük harf kullanıcı adı.
 * @param {string} raw
 * @returns {string}
 */
function normalizeHandle(raw) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?instagram\.com\//g, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .trim();
}

/**
 * Mekan adını arama için normalize et.
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9ğüşıöçğüşiöç]/g, '');
}

/**
 * ig-venue-intake.json öğelerinden mekana ait son gönderiyi bul.
 * @param {{ id: string, name: string, instagram?: string }} venue
 * @param {Array<{ username: string, venueName?: string, caption?: string, media_url?: string, permalink?: string, timestamp?: string }>} igItems
 * @returns {{ caption: string|null, thumbnail: string|null, permalink: string|null, ageHours: number|null }|null}
 */
export function matchLastPost(venue, igItems) {
  if (!igItems || igItems.length === 0) return null;

  const venueHandle = normalizeHandle(venue.instagram);
  const venueName   = normalizeName(venue.name);

  // En son öğeyi önce al (ig-venue-intake.json genellikle kronolojik sıralı)
  // Handle eşleşmesi öncelikli, sonra isim eşleşmesi
  let match = null;

  for (const item of igItems) {
    const itemHandle = normalizeHandle(item.username);
    const itemName   = normalizeName(item.venueName || '');

    const handleMatch = venueHandle && itemHandle && itemHandle === venueHandle;
    const nameMatch   = venueName.length > 3 && itemName.length > 3 && (
      itemName.includes(venueName) || venueName.includes(itemName)
    );

    if (handleMatch || nameMatch) {
      // İlk eşleşen en güncel kabul edilir (liste fetchedAt/timestamp sırası)
      match = item;
      break;
    }
  }

  if (!match) return null;

  let ageHours = null;
  if (match.timestamp) {
    const posted = new Date(match.timestamp);
    if (!isNaN(posted.getTime())) {
      ageHours = Math.round((Date.now() - posted.getTime()) / 3_600_000);
    }
  }

  return {
    caption:   match.caption   || null,
    thumbnail: match.media_url || null,
    permalink: match.permalink || null,
    ageHours,
  };
}

// ─── Ana yapı ───────────────────────────────────────────────────────────────

/**
 * Tüm mekanlar için sinyal dosyasını oluştur.
 * @param {{ write?: boolean }} [opts]
 * @returns {Promise<{ count: number, withPost: number }>}
 */
export async function buildSignals({ write = true } = {}) {
  // Mekan listesini yükle
  let venues = [];
  try {
    const raw = JSON.parse(readFileSync(join(DATA, 'harita-mekanlar.json'), 'utf8'));
    venues = raw.venues || [];
  } catch (err) {
    console.error('[venue-signal] harita-mekanlar.json okunamadı:', err.message);
  }

  // IG intake yükle (toleranslı)
  let igItems = [];
  try {
    const raw = JSON.parse(readFileSync(join(DATA, 'ig-venue-intake.json'), 'utf8'));
    igItems = raw.items || [];
  } catch {
    // dosya yok → boş liste, sorun değil
  }

  const now = new Date();

  const signals = venues.map(venue => {
    const occupancy = occupancyFor(venue, now);
    const lastPost  = matchLastPost(venue, igItems);

    return {
      id:        venue.id,
      name:      venue.name,
      isOpen:    venue.isOpen ?? false,
      closesAt:  venue.closesAt ?? null,
      occupancy,
      lastPost,
    };
  });

  const output = {
    generatedAt: now.toISOString(),
    count:       signals.length,
    signals,
  };

  if (write) {
    const outDir = join(DATA, 'agency');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'venue-signals.json'), JSON.stringify(output, null, 2), 'utf8');
  }

  const withPost = signals.filter(s => s.lastPost !== null).length;
  return { count: signals.length, withPost };
}

// ─── CLI giriş noktası ───────────────────────────────────────────────────────
if (IS_MAIN) {
  (async () => {
    console.log('[venue-signal] Mekan sinyalleri oluşturuluyor...');
    const { count, withPost } = await buildSignals({ write: true });

    // venue-signals.json'dan örnek oku
    const out = JSON.parse(readFileSync(join(DATA, 'agency', 'venue-signals.json'), 'utf8'));
    const openCount = out.signals.filter(s => s.isOpen).length;

    console.log(`\n✔ venue-signals.json yazıldı`);
    console.log(`  Toplam mekan  : ${count}`);
    console.log(`  Şu an açık    : ${openCount}`);
    console.log(`  IG gönderisi  : ${withPost}`);
    console.log(`\n─── 3 Örnek Sinyal ───`);
    out.signals.slice(0, 3).forEach(s => {
      console.log(`\n  [${s.id}]`);
      console.log(`  Açık    : ${s.isOpen} (kapanış: ${s.closesAt ?? 'bilinmiyor'})`);
      console.log(`  Doluluk : %${s.occupancy.pct} — ${s.occupancy.label} (${s.occupancy.cls})`);
      if (s.lastPost) {
        console.log(`  IG post : ${s.lastPost.ageHours != null ? s.lastPost.ageHours + ' saat önce' : 'tarih yok'}`);
        console.log(`  Altyazı : ${(s.lastPost.caption || '').slice(0, 60)}...`);
      } else {
        console.log(`  IG post : yok`);
      }
    });
  })();
}
