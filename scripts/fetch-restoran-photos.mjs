#!/usr/bin/env node
/**
 * Kalkan'in 27 restorani icin Google Maps Photos (SerpApi) uzerinden gercek restoran fotograflarini ceker,
 * sharp ile yeniden boyutlandirir ve assets/img/restoran/ + assets/og/restoran/ altina kaydeder.
 *
 * Kaynak: serpapi engine=google_maps_photos (Google Maps'te halka acik fotograflar).
 * Fallback: serpapi engine=google_images (google_maps_photos cevap vermez/yetersizse).
 * Maliyet: 1-2 cagri / restoran. 27 restoran ~ $0.54-$1.62 bir fetch.
 *
 * Kullanim:
 *   SERPAPI_KEY=... node scripts/fetch-restoran-photos.mjs
 *   SERPAPI_KEY=... node scripts/fetch-restoran-photos.mjs --force
 *   SERPAPI_KEY=... node scripts/fetch-restoran-photos.mjs --slug=aubergine,korsan-kalamar
 *
 * Cikti / restoran:
 *   assets/img/restoran/<slug>-hero.jpg     1920x1080 q82 mozjpeg
 *   assets/img/restoran/<slug>-1.jpg ... -8 1280x720 q82 mozjpeg
 *   assets/og/restoran/<slug>.jpg           1200x630 q82 mozjpeg (hero cropped)
 *   data/restoran-photos/<slug>.json        manifest (7 gun TTL)
 *
 * Onemli: Pool/global fallback YOK. Her restoran SADECE kendi fotograflari.
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env.local'i otomatik yukle (manuel set degilse)
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
const PHOTOS_CACHE_DIR = join(ROOT, 'data', 'restoran-photos');
const REVIEWS_DIR = join(ROOT, 'data', 'restoran-reviews');
const IMG_DIR = join(ROOT, 'assets', 'img', 'restoran');
const OG_DIR = join(ROOT, 'assets', 'og', 'restoran');
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gun

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const slugArg = args.find(a => a.startsWith('--slug='));
const slugFilter = slugArg ? slugArg.slice(7).split(',').filter(Boolean) : null;

if (!KEY) {
  console.error('!! SERPAPI_KEY env yok. .env.local\'a ekle: SERPAPI_KEY=...');
  process.exit(2);
}

const data = JSON.parse(await readFile(join(ROOT, 'data', 'restoranlar.json'), 'utf8'));
const items = (data.items || []).filter(it => !slugFilter || slugFilter.includes(it.id));

await mkdir(PHOTOS_CACHE_DIR, { recursive: true });
await mkdir(IMG_DIR, { recursive: true });
await mkdir(OG_DIR, { recursive: true });

async function isFresh(path) {
  if (!existsSync(path)) return false;
  if (FORCE) return false;
  try {
    const st = await stat(path);
    return Date.now() - st.mtimeMs < TTL_MS;
  } catch { return false; }
}

// SerpApi: place_id (ChIJ...) veya data_id (hex) ile google_maps_photos
async function fetchPhotos(id) {
  const param = /^ChIJ/.test(id) ? 'place_id' : 'data_id';
  const url = `https://serpapi.com/search.json?engine=google_maps_photos&${param}=${encodeURIComponent(id)}&hl=tr&api_key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi photos ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi photos: ${json.error}`);
  return json;
}

// Fallback: google_images sorgusu (restoran adi + Kalkan)
async function fetchGoogleImages(name) {
  const q = encodeURIComponent(`${name} restoran Kalkan`);
  const url = `https://serpapi.com/search.json?engine=google_images&q=${q}&hl=tr&api_key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi images ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi images: ${json.error}`);
  return (json.images_results || []).map(p => p.original || p.thumbnail).filter(Boolean);
}

// Google Maps thumbnail URL'lerinde =w<H>-h<W>-... param'larini buyuk boyuta cevir
function maximizeGoogleUrl(url) {
  if (!url) return url;
  return url.replace(/=w\d+-h\d+(-[a-z-]+)*$/, '=w2400-h1800')
            .replace(/=s\d+(-[a-z-]+)*$/, '=s2400')
            .replace(/=w\d+-h\d+-k-no-?/, '=w2400-h1800-k-no');
}

// Buffer'in bilinen bir image format'i olup olmadigini magic-byte ile dogrula
function isImageBuffer(buf) {
  if (!buf || buf.length < 16) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  return false;
}

// Bir URL'yi indir (image content dogrulamasi ile)
async function downloadBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length < 1024) throw new Error(`too small (${buf.length}B)`);
    if (!isImageBuffer(buf)) {
      if (ct.startsWith('image/')) return buf;
      throw new Error(`not an image (ct=${ct.slice(0,40)})`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

// Buffer -> resize -> JPEG (basarisizlikta false doner, throw etmez)
async function resizeAndSave(buf, outPath, w, h, q = 82) {
  try {
    await sharp(buf, { failOn: 'none' })
      .resize(w, h, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: q, mozjpeg: true })
      .toFile(outPath);
    return true;
  } catch (e) {
    console.warn(`    resize fail ${outPath.split(/[\\/]/).pop()}: ${e.message.slice(0,80)}`);
    return false;
  }
}

// Cache'den restoran place_id/data_id oku
async function loadPlaceId(slug) {
  const path = join(REVIEWS_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  try {
    const cache = JSON.parse(await readFile(path, 'utf8'));
    const place = cache?.place || {};
    return place.data_id || place.place_id || null;
  } catch { return null; }
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)}KB`;
  return `${(bytes/1024/1024).toFixed(2)}MB`;
}

let fetched = 0;
let cached = 0;
let failed = [];
let totalFiles = 0;
let totalBytes = 0;
let serpApiCalls = 0;

for (const r of items) {
  const slug = r.id;
  const manifestPath = join(PHOTOS_CACHE_DIR, `${slug}.json`);
  const heroPath = join(IMG_DIR, `${slug}-hero.jpg`);

  // Cache check
  if (await isFresh(manifestPath) && existsSync(heroPath)) {
    cached++;
    console.log(`  - ${slug}: cache hit (skip)`);
    continue;
  }

  const placeId = await loadPlaceId(slug);
  if (!placeId) {
    failed.push({ slug, reason: 'place_id/data_id yok (data/restoran-reviews/...)' });
    console.warn(`  X ${slug}: place_id yok`);
    continue;
  }

  console.log(`  ~ ${slug} (${r.name})`);
  let photoUrls = [];
  let source = 'google_maps_photos';

  try {
    const photos = await fetchPhotos(placeId);
    serpApiCalls++;
    photoUrls = (photos.photos || photos.images_results || []).map(p => {
      const raw = p.image || p.original || p.thumbnail || p.url;
      return raw ? maximizeGoogleUrl(raw) : null;
    }).filter(Boolean);
  } catch (e) {
    console.warn(`    google_maps_photos fail: ${e.message}`);
  }

  // Fallback: google_images
  if (photoUrls.length < 4) {
    try {
      console.warn(`    fallback -> google_images (current: ${photoUrls.length})`);
      const extra = await fetchGoogleImages(r.name);
      serpApiCalls++;
      const merged = [...photoUrls, ...extra].filter((u, i, a) => a.indexOf(u) === i);
      photoUrls = merged;
      source = photoUrls.length > 0 ? `${source}+google_images` : 'google_images';
    } catch (e) {
      console.warn(`    google_images fail: ${e.message}`);
    }
  }

  if (!photoUrls.length) {
    failed.push({ slug, reason: 'fotograf bulunamadi (her iki kaynaktan)' });
    console.warn(`  X ${slug}: hic fotograf yok`);
    continue;
  }

  // En iyi 9 fotograf
  const top = photoUrls.slice(0, 12);
  let downloaded = [];

  // Paralel indir (batch 5)
  for (let i = 0; i < top.length; i += 5) {
    const batch = top.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(u => downloadBuffer(u)));
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        downloaded.push({ url: batch[j], buf: results[j].value });
      }
    }
    if (downloaded.length >= 9) break;
  }

  if (downloaded.length < 1) {
    failed.push({ slug, reason: 'tum indirme denemeleri basarisiz' });
    console.warn(`  X ${slug}: indirme basarisiz`);
    continue;
  }

  // Hero: ilk gecerli buffer'i bul (sharp metadata ile dogrula)
  let heroIdx = -1;
  let heroBuf = null;
  for (let i = 0; i < downloaded.length; i++) {
    try {
      await sharp(downloaded[i].buf).metadata();
      heroBuf = downloaded[i].buf;
      heroIdx = i;
      break;
    } catch { /* sonrakini dene */ }
  }
  if (!heroBuf) {
    failed.push({ slug, reason: 'tum bufferlar sharp tarafindan reddedildi' });
    console.warn(`  X ${slug}: gecerli image yok`);
    continue;
  }

  // Hero 1920x1080
  const heroOk = await resizeAndSave(heroBuf, heroPath, 1920, 1080);
  if (!heroOk) {
    failed.push({ slug, reason: 'hero resize basarisiz' });
    continue;
  }

  // OG 1200x630 (hero crop)
  const ogPath = join(OG_DIR, `${slug}.jpg`);
  await resizeAndSave(heroBuf, ogPath, 1200, 630);

  // Galeri 1280x720 x 8 — pool YOK; sadece bu restoranin gercek bufferlari
  // Yetersizse hero'yu tekrar etmek yerine kart sayisini azalt.
  const galleryPool = downloaded.filter((_, i) => i !== heroIdx);
  const galleryFiles = [];
  let poolIdx = 0;
  for (let i = 0; i < 8; i++) {
    if (poolIdx >= galleryPool.length) break; // pool bittiyse dur, generic doldurma
    const p = join(IMG_DIR, `${slug}-${i+1}.jpg`);
    let success = false;
    while (poolIdx < galleryPool.length && !success) {
      success = await resizeAndSave(galleryPool[poolIdx].buf, p, 1280, 720);
      poolIdx++;
    }
    if (success) galleryFiles.push(`${slug}-${i+1}.jpg`);
  }

  // Stats
  const fileList = [`${slug}-hero.jpg`, ...galleryFiles];
  let bytesThisVenue = 0;
  for (const f of fileList) {
    try {
      const s = await stat(join(IMG_DIR, f));
      bytesThisVenue += s.size;
      totalBytes += s.size;
      totalFiles++;
    } catch {}
  }
  try {
    const s = await stat(ogPath);
    bytesThisVenue += s.size;
    totalBytes += s.size;
    totalFiles++;
  } catch {}

  // Manifest yaz
  const manifest = {
    _fetched: new Date().toISOString(),
    _source: source,
    slug,
    name: r.name,
    place_id_used: placeId,
    files: {
      hero: `/assets/img/restoran/${slug}-hero.jpg`,
      og: `/assets/og/restoran/${slug}.jpg`,
      gallery: galleryFiles.map(f => `/assets/img/restoran/${f}`),
    },
    source_urls: top.slice(0, 9),
    total_bytes: bytesThisVenue,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  fetched++;

  console.log(`  + ${slug}: ${galleryFiles.length + 1} foto + OG (${fmtSize(bytesThisVenue)}) [${source}]`);
}

console.log(`\n=== Restoran Photo Fetch Raporu ===`);
console.log(`Fetched: ${fetched} restoran`);
console.log(`Cache hit: ${cached} restoran`);
console.log(`Failed: ${failed.length}`);
console.log(`SerpApi cagrisi: ${serpApiCalls} (~$${(serpApiCalls * 0.02).toFixed(2)})`);
console.log(`Toplam dosya: ${totalFiles}`);
console.log(`Toplam boyut: ${fmtSize(totalBytes)} (ort ${totalFiles ? fmtSize(totalBytes/totalFiles) : '0'}/dosya)`);
if (failed.length) {
  console.log(`\nBasarisizlar:`);
  for (const f of failed) console.log(`  - ${f.slug}: ${f.reason}`);
}
