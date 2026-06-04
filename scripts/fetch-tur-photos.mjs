#!/usr/bin/env node
/**
 * Kalkan turlari icin Google Images (SerpApi) uzerinden gercek tur fotograflarini ceker,
 * sharp ile yeniden boyutlandirir ve assets/img/tur/ + assets/og/tur/ altina kaydeder.
 *
 * NOT: Turlar Google Maps yer degil — bir hizmet/aktivite. Bu yuzden google_maps_photos
 * yerine kategori-bazli google_images sorgusu kullaniyoruz.
 *
 * Maliyet: 1 cagri / tur = ~$0.02. 10 tur = ~$0.20 bir fetch.
 *
 * Kullanim:
 *   SERPAPI_KEY=... node scripts/fetch-tur-photos.mjs
 *   SERPAPI_KEY=... node scripts/fetch-tur-photos.mjs --force
 *   SERPAPI_KEY=... node scripts/fetch-tur-photos.mjs --slug=gunluk-tekne,jeep-safari
 *
 * Cikti / tur:
 *   assets/img/tur/<slug>-hero.jpg     1920x1080 q82 mozjpeg
 *   assets/img/tur/<slug>-1.jpg ... -8 1280x720 q82 mozjpeg
 *   assets/og/tur/<slug>.jpg            1200x630 q82 mozjpeg (hero cropped)
 *   data/tur-photos/<slug>.json         manifest (7 gun TTL)
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env.local'i otomatik yukle
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
const PHOTOS_CACHE_DIR = join(ROOT, 'data', 'tur-photos');
const IMG_DIR = join(ROOT, 'assets', 'img', 'tur');
const OG_DIR = join(ROOT, 'assets', 'og', 'tur');
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const slugArg = args.find(a => a.startsWith('--slug='));
const slugFilter = slugArg ? slugArg.slice(7).split(',').filter(Boolean) : null;

if (!KEY) {
  console.error('!! SERPAPI_KEY env yok. .env.local\'a ekle: SERPAPI_KEY=...');
  process.exit(2);
}

const data = JSON.parse(await readFile(join(ROOT, 'data', 'turlar.json'), 'utf8'));
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

// Kategori-bazli arama hint (Berkay'in talimati)
function categoryQuery(name, category) {
  const hints = {
    'Tekne Turu': 'Kalkan tekne turu koy yüzme',
    'Safari': 'Kalkan jeep safari Toros dağları',
    'At Turu': 'Kalkan at binme orman',
    'Kano Turu': 'Kalkan kano sea kayak'
  };
  const hint = hints[category] || 'Kalkan Antalya';
  return `${name} ${hint}`;
}

// SerpApi google_images sorgusu
async function fetchGoogleImages(query) {
  const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&hl=tr&api_key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi images ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi images: ${json.error}`);
  return (json.images_results || []).map(p => p.original || p.thumbnail).filter(Boolean);
}

function isImageBuffer(buf) {
  if (!buf || buf.length < 16) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  return false;
}

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

  if (await isFresh(manifestPath) && existsSync(heroPath)) {
    cached++;
    console.log(`  - ${slug}: cache hit (skip)`);
    continue;
  }

  console.log(`  ~ ${slug} (${r.name})`);
  const q = categoryQuery(r.name, r.category);
  let photoUrls = [];

  try {
    photoUrls = await fetchGoogleImages(q);
    serpApiCalls++;
  } catch (e) {
    console.warn(`    google_images fail: ${e.message}`);
  }

  if (!photoUrls.length) {
    failed.push({ slug, reason: 'fotograf bulunamadi (google_images bos)' });
    console.warn(`  X ${slug}: hic fotograf yok`);
    continue;
  }

  const top = photoUrls.slice(0, 14); // buffer for failures
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

  // Hero: ilk gecerli buffer'i bul
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

  // OG 1200x630
  const ogPath = join(OG_DIR, `${slug}.jpg`);
  await resizeAndSave(heroBuf, ogPath, 1200, 630);

  // Galeri 1280x720 x 8
  const galleryPool = downloaded.filter((_, i) => i !== heroIdx);
  const galleryFiles = [];
  let poolIdx = 0;
  for (let i = 0; i < 8; i++) {
    const p = join(IMG_DIR, `${slug}-${i+1}.jpg`);
    let success = false;
    while (poolIdx < galleryPool.length && !success) {
      success = await resizeAndSave(galleryPool[poolIdx].buf, p, 1280, 720);
      poolIdx++;
    }
    if (!success) {
      success = await resizeAndSave(heroBuf, p, 1280, 720);
    }
    if (success) galleryFiles.push(`${slug}-${i+1}.jpg`);
  }

  // Stats
  const fileList = [`${slug}-hero.jpg`, ...galleryFiles];
  let bytesThisTur = 0;
  for (const f of fileList) {
    try {
      const s = await stat(join(IMG_DIR, f));
      bytesThisTur += s.size;
      totalBytes += s.size;
      totalFiles++;
    } catch {}
  }
  try {
    const s = await stat(ogPath);
    bytesThisTur += s.size;
    totalBytes += s.size;
    totalFiles++;
  } catch {}

  const manifest = {
    _fetched: new Date().toISOString(),
    _source: 'google_images',
    slug,
    name: r.name,
    category: r.category,
    query_used: q,
    files: {
      hero: `/assets/img/tur/${slug}-hero.jpg`,
      og: `/assets/og/tur/${slug}.jpg`,
      gallery: galleryFiles.map(f => `/assets/img/tur/${f}`),
    },
    source_urls: top.slice(0, 9),
    total_bytes: bytesThisTur,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  fetched++;

  console.log(`  + ${slug}: ${galleryFiles.length + 1} foto + OG (${fmtSize(bytesThisTur)})`);
}

console.log(`\n=== Tur Photo Fetch Raporu ===`);
console.log(`Fetched: ${fetched} tur`);
console.log(`Cache hit: ${cached} tur`);
console.log(`Failed: ${failed.length}`);
console.log(`SerpApi cagrisi: ${serpApiCalls} (~$${(serpApiCalls * 0.02).toFixed(2)})`);
console.log(`Toplam dosya: ${totalFiles}`);
console.log(`Toplam boyut: ${fmtSize(totalBytes)} (ort ${totalFiles ? fmtSize(totalBytes/totalFiles) : '0'}/dosya)`);
if (failed.length) {
  console.log(`\nBasarisizlar:`);
  for (const f of failed) console.log(`  - ${f.slug}: ${f.reason}`);
}
