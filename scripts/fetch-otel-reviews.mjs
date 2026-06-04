#!/usr/bin/env node
/**
 * SerpApi uzerinden Kalkan'in 15 oteli icin Google Maps verisi + yorumlari ceker.
 * Cache: data/otel-reviews/<slug>.json (7 gun TTL)
 *
 * Kullanim:
 *   SERPAPI_KEY=... node scripts/fetch-otel-reviews.mjs              # cache > 7 gun ise fetch
 *   SERPAPI_KEY=... node scripts/fetch-otel-reviews.mjs --force      # tum cache'i bypass et
 *   SERPAPI_KEY=... node scripts/fetch-otel-reviews.mjs --slug=white-house-kalkan,sea-house-kalkan
 *
 * Maliyet: 1 search + 1 reviews = ~$0.04/otel. 15 otel = ~$0.60 bir fetch.
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const CACHE_DIR = join(ROOT, 'data', 'otel-reviews');
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gun

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const slugArg = args.find(a => a.startsWith('--slug='));
const slugFilter = slugArg ? slugArg.slice(7).split(',').filter(Boolean) : null;

if (!KEY) {
  console.error('!! SERPAPI_KEY env yok. .env.local\'a ekle: SERPAPI_KEY=...');
  process.exit(2);
}

const data = JSON.parse(await readFile(join(ROOT, 'data', 'oteller.json'), 'utf8'));
const items = (data.items || []).filter(it => !slugFilter || slugFilter.includes(it.id));

await mkdir(CACHE_DIR, { recursive: true });

async function isFresh(path) {
  if (!existsSync(path)) return false;
  if (FORCE) return false;
  const st = await stat(path);
  return Date.now() - st.mtimeMs < TTL_MS;
}

async function searchLocal(name) {
  const q = encodeURIComponent(`${name} otel Kalkan Antalya`);
  // google_maps engine ChIJ place_id + hex data_id dondurur (reviews API ile uyumlu).
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${q}&type=search&hl=tr&api_key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi maps ${res.status}`);
  return res.json();
}

async function fetchReviews(id) {
  const param = /^ChIJ/.test(id) ? 'place_id' : 'data_id';
  const url = `https://serpapi.com/search.json?engine=google_maps_reviews&${param}=${encodeURIComponent(id)}&hl=tr&sort_by=newestFirst&api_key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi reviews ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi reviews: ${json.error}`);
  return json;
}

function pickBestMatch(results, name) {
  if (results.place_results && results.place_results.place_id) {
    return results.place_results;
  }
  const list = results.local_results || results.places_results || [];
  if (!list.length) return null;
  const lower = name.toLowerCase();
  return list.find(r => (r.title || '').toLowerCase().includes(lower.slice(0, Math.max(4, lower.length / 2))))
      || list[0];
}

let fetched = 0;
let cached = 0;
let failed = [];

for (const r of items) {
  const out = join(CACHE_DIR, `${r.id}.json`);
  if (await isFresh(out)) {
    cached++;
    continue;
  }
  try {
    console.log(`  ~ ${r.name}`);
    const local = await searchLocal(r.name);
    const match = pickBestMatch(local, r.name);
    if (!match) {
      failed.push({ slug: r.id, reason: 'no match in local results' });
      continue;
    }
    const placeId = match.place_id || match.data_id;
    let reviews = null;
    if (placeId) {
      try {
        reviews = await fetchReviews(placeId);
      } catch (e) {
        console.warn(`    reviews failed for ${r.id}: ${e.message}`);
      }
    }
    const cache = {
      _fetched: new Date().toISOString(),
      _source: 'serpapi',
      slug: r.id,
      name: r.name,
      place: {
        title: match.title,
        place_id: placeId,
        rating: match.rating ?? null,
        reviews: match.reviews ?? null,
        price: match.price ?? null,
        type: match.type ?? match.category ?? null,
        address: match.address ?? null,
        phone: match.phone ?? null,
        website: match.website ?? null,
        gps: match.gps_coordinates ?? null,
        hours: match.hours ?? null,
        thumbnail: match.thumbnail ?? null,
        place_url: match.links?.directions || match.links?.website || null,
      },
      reviews: (reviews?.reviews || []).slice(0, 8).map(rv => ({
        user: rv.user?.name || rv.user || 'Anonim',
        avatar: rv.user?.thumbnail || null,
        rating: rv.rating ?? null,
        date: rv.date || rv.iso_date || null,
        snippet: rv.snippet || rv.text || '',
        likes: rv.likes ?? null,
        local_guide: rv.user?.local_guide ?? false,
      })),
    };
    await writeFile(out, JSON.stringify(cache, null, 2));
    fetched++;
  } catch (e) {
    console.warn(`  X ${r.name}: ${e.message}`);
    failed.push({ slug: r.id, reason: e.message });
  }
}

console.log(`\nSerpApi: ${fetched} fetched, ${cached} cache-hit, ${failed.length} failed (toplam ${items.length})`);
if (failed.length) {
  console.log('Failed:');
  for (const f of failed) console.log(`  - ${f.slug}: ${f.reason}`);
}
