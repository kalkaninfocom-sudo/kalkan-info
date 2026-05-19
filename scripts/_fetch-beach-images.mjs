// One-off: fetch beach hero images from Pexels and update plajlar.json
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.PEXELS_KEY || process.env.PEXELS_API_KEY;
if (!KEY) { console.error('PEXELS_KEY missing'); process.exit(1); }

const ROOT = path.resolve(import.meta.dirname, '..');
const JSON_PATH = path.join(ROOT, 'data/plajlar.json');
const IMG_DIR = path.join(ROOT, 'assets/img');

// id -> Pexels search query (only update missing/placeholder ones)
const PLAN = {
  'incirli':       'kalkan harbour turkey marina',
  'kalamar':       'kalamar bay turkey sunset',
  'akcagerme':     'secret turquoise cove turkey',
  'begenti':       'snorkel rocky cove turkey',
  'indigo-beach':  'beach club turquoise mediterranean lounge',
  'yali-beach':    'luxury beach club mediterranean sundeck',
  'likya-beach':   'beach platform mediterranean lycian',
  'lures-beach':   'mediterranean hotel beach club umbrella',
  'kucuk-cakil':   'kas turkey pebble beach',
  'buyuk-cakil':   'kas turkey beach blue flag',
  'akyarlar':      'rocky beach kas turkey snorkel',
  'hidayet-koyu':  'cukurbag peninsula kas turkey',
  'limanagzi':     'limanagzi kas turkey beach'
};

async function pexelsSearch(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status} for ${query}`);
  const data = await res.json();
  if (!data.photos || !data.photos.length) return null;
  const p = data.photos[0];
  return { url: p.src.large2x || p.src.large, id: p.id, photographer: p.photographer, alt: p.alt };
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return buf.length;
}

const data = JSON.parse(await fs.readFile(JSON_PATH, 'utf8'));
const report = [];

for (const [id, query] of Object.entries(PLAN)) {
  const item = data.items.find(x => x.id === id);
  if (!item) { console.log(`skip: ${id} not in JSON`); continue; }
  try {
    const hit = await pexelsSearch(query);
    if (!hit) { console.log(`no result: ${id} (${query})`); continue; }
    const filename = `${id}-pexels.jpg`;
    const dest = path.join(IMG_DIR, filename);
    const size = await download(hit.url, dest);
    item.image = `/assets/img/${filename}`;
    item.gallery = [item.image, ...(item.gallery || []).filter(g => !g.startsWith('https://placehold'))];
    item.imageCredit = `Pexels — ${hit.photographer}`;
    report.push({ id, name: item.name, size, photographer: hit.photographer, alt: hit.alt });
    console.log(`OK ${id} — ${(size/1024).toFixed(0)}KB — ${hit.photographer}`);
  } catch (e) {
    console.log(`FAIL ${id}: ${e.message}`);
  }
}

await fs.writeFile(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`\nDone. Updated ${report.length}/${Object.keys(PLAN).length}.`);
