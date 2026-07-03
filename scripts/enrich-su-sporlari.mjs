#!/usr/bin/env node
/**
 * enrich-su-sporlari.mjs — 5 su sporları işletmesini SerpApi ile enrich eder + fotolarını indirir.
 * ------------------------------------------------------------------------------------------------
 * SerpApi engine=google_maps (search) → place detayları (rating/review/adres/tel/website/hours/gps/data_id).
 * SerpApi engine=google_maps_photos → gerçek fotolar → sharp ile boyutlandır → assets/img/hizmet/<slug>-{hero,1..6}.jpg
 * Çıktı: data/su-sporlari.json (5 item, restoran item modeline yakın + coordinates + place_id).
 *
 * Kullanım: SERPAPI_KEY=... node scripts/enrich-su-sporlari.mjs [--force]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FORCE = process.argv.includes('--force');

// .env.local yükle
if (!process.env.SERPAPI_KEY) {
  try {
    for (const line of (await readFile(join(ROOT, '.env.local'), 'utf8')).split(/\r?\n/)) {
      const m = line.match(/^\s*SERPAPI_KEY\s*=\s*(.+?)\s*$/);
      if (m) { process.env.SERPAPI_KEY = m[1].replace(/^["']|["']$/g, ''); break; }
    }
  } catch {}
}
const KEY = process.env.SERPAPI_KEY;
if (!KEY) { console.error('!! SERPAPI_KEY yok (.env.local)'); process.exit(1); }

const IMG_DIR = join(ROOT, 'assets', 'img', 'hizmet');
await mkdir(IMG_DIR, { recursive: true });

// 5 işletme — slug, arama sorgusu, ll (koordinat).
const BUSINESSES = [
  { id: 'seapro-watersports-kalkan', q: 'SEAPRO Watersports Kalkan', ll: '@36.2533291,29.4094251,15z' },
  { id: 'kalamar-watersports', q: 'Kalamar Watersports Kalkan', ll: '@36.257205,29.392216,15z' },
  { id: 'kalkan-dive-centre', q: 'Kalkan Dive Centre', ll: '@36.2615287,29.3961245,16z' },
  { id: 'pro-fishing-tours-kalkan', q: 'Pro Fishing Tours Kalkan', ll: '@36.2578125,29.3882966,15z' },
  { id: 'aristos-water-sports-kalkan', q: 'Aristos Water Sports Kalkan', ll: '@36.2578125,29.3882966,15z' },
];

async function serp(params) {
  const url = `https://serpapi.com/search.json?${params}&api_key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`SerpApi: ${j.error}`);
  return j;
}

async function findPlace(b) {
  const j = await serp(`engine=google_maps&type=search&q=${encodeURIComponent(b.q)}&ll=${encodeURIComponent(b.ll)}&hl=tr`);
  const p = j.place_results || (j.local_results && j.local_results[0]);
  return p || null;
}

function maximize(url) {
  if (!url) return url;
  return url.replace(/=w\d+-h\d+(-[a-z-]+)*$/, '=w2400-h1800')
            .replace(/=s\d+(-[a-z-]+)*$/, '=s2400')
            .replace(/=w\d+-h\d+-k-no-?/, '=w2400-h1800-k-no');
}
function isImg(buf) {
  if (!buf || buf.length < 16) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50) return true;
  if (buf[0] === 0x52 && buf[8] === 0x57 && buf[9] === 0x45) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49) return true;
  return false;
}
async function dl(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow', signal: c.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024 || !isImg(buf)) return null;
    return buf;
  } catch { return null; } finally { clearTimeout(t); }
}
async function save(buf, out, w, h) {
  try { await sharp(buf, { failOn: 'none' }).resize(w, h, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toFile(out); return true; }
  catch { return false; }
}

async function fetchPhotos(placeId, dataId) {
  // google_maps_photos data_id ister (place_id/ChIJ → 400). data_id'yi önceler.
  const id = dataId || placeId;
  const param = /^0x[0-9a-f]+:/i.test(id) ? 'data_id' : 'place_id';
  const j = await serp(`engine=google_maps_photos&${param}=${encodeURIComponent(id)}&hl=tr`);
  return (j.photos || []).map(p => p.image).filter(Boolean);
}

const out = { _meta: { generated: 'enrich-su-sporlari', category: 'Su Sporları' }, items: [] };

for (const b of BUSINESSES) {
  console.log(`\n── ${b.q} ──`);
  let place;
  try { place = await findPlace(b); } catch (e) { console.warn('  place hata:', e.message); }
  if (!place) { console.warn('  ⚠ bulunamadı, atlanıyor'); continue; }

  const gps = place.gps_coordinates || {};
  const item = {
    id: b.id,
    name: place.title || b.q,
    category: 'Su Sporları',
    categoryKey: 'watersports',
    type: place.type || (place.types && place.types[0]) || '',
    rating: place.rating || null,
    reviewCount: place.reviews || null,
    location: place.address || '',
    phone: place.phone || '',
    website: place.website || '',
    hours: place.hours || (place.operating_hours ? Object.values(place.operating_hours)[0] : '') || '',
    coordinates: { latitude: gps.latitude, longitude: gps.longitude },
    source: 'google_maps',
    verified: false,
    place_id: place.place_id || null,
    data_id: place.data_id || null,
    image: '',
    gallery: [],
  };
  console.log(`  ✓ ${item.name} | ${item.rating || '-'}★×${item.reviewCount || 0} | ${item.type}`);

  // Fotolar
  let urls = [];
  try { urls = await fetchPhotos(item.place_id, item.data_id); } catch (e) { console.warn('  foto hata:', e.message); }
  urls = urls.slice(0, 8);
  let n = 0;
  for (let i = 0; i < urls.length && n < 6; i++) {
    const buf = await dl(maximize(urls[i]));
    if (!buf) continue;
    if (n === 0) {
      if (await save(buf, join(IMG_DIR, `${b.id}-hero.jpg`), 1920, 1080)) item.image = `/assets/img/hizmet/${b.id}-hero.jpg`;
    }
    if (await save(buf, join(IMG_DIR, `${b.id}-${n + 1}.jpg`), 1280, 720)) item.gallery.push(`/assets/img/hizmet/${b.id}-${n + 1}.jpg`);
    n++;
  }
  console.log(`  ✓ ${n} foto indirildi`);
  out.items.push(item);
}

await writeFile(join(ROOT, 'data', 'su-sporlari.json'), JSON.stringify(out, null, 2));
console.log(`\n✅ data/su-sporlari.json yazıldı (${out.items.length} işletme).`);
