#!/usr/bin/env node
/**
 * Kalkan / Kaş bölgesinde Google Maps'te kayıtlı işletmeleri SerpApi ile keşfeder.
 *
 * Kullanım:
 *   SERPAPI_KEY=... node scripts/discover-businesses.mjs --category=restaurant --limit=10
 *   SERPAPI_KEY=... node scripts/discover-businesses.mjs --category=restaurant --limit=80 --area=kalkan,kas
 *
 * Çıktı:
 *   data/discovered/<category>-<area>-<timestamp>.json
 *
 * Maliyet: 1 SerpApi sorgu / 20 sonuç (sayfa başı). 80 restoran ≈ 4 sorgu ≈ $0.06.
 *
 * NOT: Bu script SADECE keşif yapar. Mevcut envanteri (data/restoranlar.json) değiştirmez.
 * Berkay onayı sonrası enrich.mjs + merge.mjs ile gerçek envantere eklenir.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env.local'den SERPAPI_KEY yükle
if (!process.env.SERPAPI_KEY) {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    const env = await readFile(envPath, 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*SERPAPI_KEY\s*=\s*(.+?)\s*$/);
      if (m) { process.env.SERPAPI_KEY = m[1].replace(/^["']|["']$/g, ''); break; }
    }
  }
}

const KEY = process.env.SERPAPI_KEY;
if (!KEY) {
  console.error('!! SERPAPI_KEY yok. .env.local\'a ekle.');
  process.exit(2);
}

// ─── Argümanlar ───
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);
const CATEGORY = args.category || 'restaurant';
const LIMIT = parseInt(args.limit || '10', 10);
const AREAS = (args.area || 'kalkan').split(',').map(s => s.trim().toLowerCase());

// ─── Kategori → Google Maps arama sorgusu ───
const CATEGORY_QUERIES = {
  restaurant: ['restaurants', 'restoran'],
  cafe:       ['cafes', 'kafe'],
  bar:        ['bars pubs nightclubs', 'bar pub'],
  hotel:      ['hotels', 'otel'],
  villa:      ['villa rentals'],
  barber:     ['barbers hairdressers', 'berber kuaför'],
  market:     ['supermarkets grocery', 'market manav'],
  pharmacy:   ['pharmacies', 'eczane'],
  atm:        ['ATM banks'],
  taxi:       ['taxi', 'taksi'],
  laundry:    ['laundry dry cleaning', 'çamaşırhane'],
  bakery:     ['bakery', 'fırın pastane'],
  mechanic:   ['auto repair', 'oto tamirci'],
  beach_club: ['beach clubs'],
  diving:     ['diving centers', 'dalış merkezi'],
  boat_tour:  ['boat tours', 'tekne turu'],
};

const AREA_GEO = {
  kalkan:  { ll: '@36.2651,29.4112,14z', label: 'Kalkan'  },
  kas:     { ll: '@36.1985,29.6411,14z', label: 'Kaş'     },
  patara:  { ll: '@36.2598,29.3198,14z', label: 'Patara'  },
  islamlar:{ ll: '@36.3071,29.4185,14z', label: 'İslamlar'},
};

if (!CATEGORY_QUERIES[CATEGORY]) {
  console.error(`!! Bilinmeyen kategori: ${CATEGORY}. Geçerli: ${Object.keys(CATEGORY_QUERIES).join(', ')}`);
  process.exit(2);
}

// ─── SerpApi Google Maps Search (retry'lı) ───
async function fetchWithRetry(url, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const delay = 1500 * Math.pow(2, i); // 1.5s, 3s, 6s
        console.warn(`  ↻ retry ${i + 1}/${attempts - 1} after ${delay}ms (${e.message})`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

async function search(query, ll, start = 0) {
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&ll=${encodeURIComponent(ll)}&type=search&hl=tr&start=${start}&api_key=${KEY}`;
  const json = await fetchWithRetry(url);
  if (json.error) throw new Error(`SerpApi: ${json.error}`);
  return json.local_results || [];
}

// ─── Tek bir bölge × kategori için sayfa sayfa çek ───
async function harvest(category, area) {
  const queries = CATEGORY_QUERIES[category];
  const geo = AREA_GEO[area];
  if (!geo) {
    console.warn(`?? Bilinmeyen bölge: ${area}, atlandı`);
    return [];
  }

  const seen = new Map(); // place_id → item

  for (const q of queries) {
    let start = 0;
    let page = 0;
    while (seen.size < LIMIT && page < 5) {
      const results = await search(q, geo.ll, start);
      if (!results.length) break;
      for (const r of results) {
        const id = r.place_id || r.data_id;
        if (!id || seen.has(id)) continue;
        seen.set(id, normalize(r, area, category));
        if (seen.size >= LIMIT) break;
      }
      page++;
      start += 20;
    }
  }

  return [...seen.values()].slice(0, LIMIT);
}

// ─── Google Maps result → bizim envanter formatı ───
function normalize(r, area, category) {
  const slug = slugify(r.title || 'unknown');
  return {
    place_id:      r.place_id || null,
    data_id:       r.data_id || null,
    source:        'google_maps',
    verified:      false,
    discovered_at: new Date().toISOString(),

    slug,
    id:            slug,
    name:          r.title || '',
    category,
    area:          area,

    rating:        r.rating ?? null,
    reviewCount:   r.reviews ?? null,
    priceLevel:    r.price ?? null,           // "$", "$$", "$$$", "$$$$"
    types:         r.type ? [r.type] : (r.types || []),

    address:       r.address || '',
    phone:         r.phone || '',
    website:       r.website || '',

    coordinates:   r.gps_coordinates || null, // { latitude, longitude }
    plus_code:     r.plus_code || null,
    hours:         r.hours || null,
    open_state:    r.open_state || null,
    service_options: r.service_options || null,

    thumbnail:     r.thumbnail || null,
  };
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ─── Main ───
const all = [];
for (const area of AREAS) {
  console.log(`\n🔎 Aranıyor: ${CATEGORY} @ ${area} (limit=${LIMIT})...`);
  const items = await harvest(CATEGORY, area);
  console.log(`  ✓ ${items.length} işletme bulundu`);
  all.push(...items);
}

// Çift kayıt temizleme (place_id bazında)
const dedup = new Map();
for (const item of all) {
  if (!dedup.has(item.place_id || item.slug)) {
    dedup.set(item.place_id || item.slug, item);
  }
}
const final = [...dedup.values()];

const outDir = join(ROOT, 'data', 'discovered');
await mkdir(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = join(outDir, `${CATEGORY}-${AREAS.join('+')}-${ts}.json`);
await writeFile(outPath, JSON.stringify({
  meta: {
    category: CATEGORY,
    areas: AREAS,
    limit: LIMIT,
    total: final.length,
    timestamp: new Date().toISOString(),
  },
  items: final,
}, null, 2), 'utf8');

console.log(`\n✓ Toplam ${final.length} işletme → ${outPath}`);
console.log(`\nİlk 5 örnek:`);
for (const item of final.slice(0, 5)) {
  const r = item.rating ? `⭐${item.rating} · ${item.reviewCount} yorum` : '(puan yok)';
  console.log(`  · ${item.name} — ${r}`);
  console.log(`      ${item.address || '(adres yok)'} ${item.phone ? '· ' + item.phone : ''}`);
}
