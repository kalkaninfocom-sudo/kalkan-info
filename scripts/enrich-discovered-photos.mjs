#!/usr/bin/env node
/**
 * data/discovered/all-kalkan-*.json'daki işletmeler için Google Maps fotoğraflarını çeker,
 * sharp ile webp'e dönüştürür ve assets/img/business/<slug>/ altına kaydeder.
 *
 * Kullanım:
 *   SERPAPI_KEY=... node scripts/enrich-discovered-photos.mjs
 *   SERPAPI_KEY=... node scripts/enrich-discovered-photos.mjs --limit=10  (test için)
 *
 * Çıktı / işletme:
 *   assets/img/business/<slug>/hero.webp       1600x900 q82
 *   assets/img/business/<slug>/g-1.webp ... g-6 1280x720 q82
 *   assets/og/business/<slug>.webp             1200x630 q82 (hero cropped)
 *   data/business-photos/<slug>.json           manifest (7 gün TTL)
 *
 * NOT: Bu script discovered işletmeleri (place_id verisi olan) işler. Mevcut envanteri
 *      değiştirmez — sadece foto cache + dosya üretir. merge'den sonra ya da öncesinde
 *      çağrılabilir.
 */
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
if (!KEY) { console.error('!! SERPAPI_KEY yok'); process.exit(2); }

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.includes('=') ? a.slice(2).split('=') : [a.slice(2), true])
);
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const FORCE = !!args.force;

const PHOTOS_CACHE_DIR = join(ROOT, 'data', 'business-photos');
const IMG_DIR = join(ROOT, 'assets', 'img', 'business');
const OG_DIR = join(ROOT, 'assets', 'og', 'business');
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

await mkdir(PHOTOS_CACHE_DIR, { recursive: true });
await mkdir(IMG_DIR, { recursive: true });
await mkdir(OG_DIR, { recursive: true });

// ─── En son discovered dosyayı oku ───
const discDir = join(ROOT, 'data', 'discovered');
const allFiles = (await readdir(discDir)).filter(f => f.startsWith('all-kalkan-') && f.endsWith('.json')).sort();
if (!allFiles.length) { console.error('!! all-kalkan-*.json yok'); process.exit(2); }
const discovered = JSON.parse(await readFile(join(discDir, allFiles[allFiles.length - 1]), 'utf8'));

const items = (discovered.items || []).filter(i => i.place_id || i.data_id).slice(0, LIMIT);
console.log(`📷 ${items.length} işletme için foto çekilecek (cache TTL: 7 gün, force=${FORCE})`);

// ─── Yardımcılar ───
async function fetchJson(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchPhotosByPlace(placeId) {
  const param = /^ChIJ/.test(placeId) ? 'place_id' : 'data_id';
  const url = `https://serpapi.com/search.json?engine=google_maps_photos&${param}=${encodeURIComponent(placeId)}&hl=tr&api_key=${KEY}`;
  return fetchJson(url);
}

function maximizeUrl(url) {
  if (!url) return url;
  return url.replace(/=w\d+-h\d+(-[a-z-]+)*$/, '=w2400-h1800')
            .replace(/=s\d+(-[a-z-]+)*$/, '=s2400')
            .replace(/=w\d+-h\d+-k-no-?/, '=w2400-h1800-k-no');
}

function isImage(buf) {
  if (!buf || buf.length < 16) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;            // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50) return true;            // PNG
  if (buf[0] === 0x52 && buf[8] === 0x57) return true;            // WEBP
  return false;
}

async function downloadBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error('too small');
    if (!isImage(buf)) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('image/')) throw new Error(`not image (ct=${ct})`);
    }
    return buf;
  } finally { clearTimeout(timer); }
}

async function saveResized(buf, outPath, w, h, q = 82) {
  try {
    await sharp(buf, { failOn: 'none' })
      .resize(w, h, { fit: 'cover', position: 'attention' })
      .webp({ quality: q })
      .toFile(outPath);
    return true;
  } catch (e) {
    console.warn(`     resize fail ${outPath.split(/[\\/]/).pop()}: ${e.message.slice(0, 60)}`);
    return false;
  }
}

async function isFresh(p) {
  if (!existsSync(p) || FORCE) return false;
  try {
    const st = await stat(p);
    return Date.now() - st.mtimeMs < TTL_MS;
  } catch { return false; }
}

// ─── Main loop ───
let fetched = 0, cached = 0, failed = [];

for (const item of items) {
  const slug = item.slug;
  const placeId = item.place_id || item.data_id;
  const manifestPath = join(PHOTOS_CACHE_DIR, `${slug}.json`);
  const heroPath = join(IMG_DIR, slug, 'hero.webp');

  if (await isFresh(manifestPath) && existsSync(heroPath)) {
    cached++;
    continue;
  }

  process.stdout.write(`  • ${slug.padEnd(40)} `);
  try {
    const json = await fetchPhotosByPlace(placeId);
    const photos = (json.photos || []).map(p => maximizeUrl(p.image)).filter(Boolean);
    if (!photos.length) {
      // Fallback: thumbnail varsa kullan
      if (item.thumbnail) photos.push(maximizeUrl(item.thumbnail));
    }
    if (!photos.length) {
      failed.push({ slug, reason: 'no_photos' });
      console.log('— no photos');
      continue;
    }

    const slugDir = join(IMG_DIR, slug);
    await mkdir(slugDir, { recursive: true });

    let savedCount = 0;
    const manifest = { slug, place_id: placeId, fetched_at: new Date().toISOString(), photos: [] };

    for (let i = 0; i < Math.min(photos.length, 7); i++) {
      try {
        const buf = await downloadBuffer(photos[i]);
        const isHero = i === 0;
        const outName = isHero ? 'hero.webp' : `g-${i}.webp`;
        const outPath = join(slugDir, outName);
        const dims = isHero ? [1600, 900] : [1280, 720];
        const ok = await saveResized(buf, outPath, dims[0], dims[1], 82);
        if (ok) {
          manifest.photos.push({ name: outName, w: dims[0], h: dims[1] });
          savedCount++;
        }
        if (isHero) {
          await saveResized(buf, join(OG_DIR, `${slug}.webp`), 1200, 630, 82);
        }
      } catch (e) {
        // skip individual photo
      }
    }

    if (savedCount === 0) {
      failed.push({ slug, reason: 'all_downloads_failed' });
      console.log('— all dl failed');
      continue;
    }

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    fetched++;
    console.log(`✓ ${savedCount} foto`);
  } catch (e) {
    failed.push({ slug, reason: e.message.slice(0, 60) });
    console.log(`X ${e.message.slice(0, 50)}`);
  }
}

console.log(`\n✅ Tamamlandı: fetched=${fetched}, cached=${cached}, failed=${failed.length}`);
if (failed.length) {
  console.log(`\nBaşarısızlar (ilk 5):`);
  for (const f of failed.slice(0, 5)) console.log(`  · ${f.slug}: ${f.reason}`);
}
