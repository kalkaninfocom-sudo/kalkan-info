/**
 * build-harita-data.mjs — Dijital İkiz harita veri üreticisi
 *
 * data/discovered/all-kalkan-*.json (SerpApi: gerçek GPS + açık/kapalı + rating + web + thumbnail)
 * ile küratörlü katalogu (restoranlar.json / oteller.json: yerel galeri + IG + özet + detay sayfası)
 * isim/slug ile birleştirir → data/harita-mekanlar.json (3B harita bunu tüketir).
 *
 * Kullanım: node scripts/build-harita-data.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Kalkan merkezi (kamera başlangıç).
const CENTER = { lat: 36.2626, lng: 29.4143 };

// Kategori → marka içi renk + ikon (harita pini + panel).
const CATEGORY = {
  restaurant:  { label: 'Restoran',   color: '#e89812', icon: '🍽️' },
  cafe:        { label: 'Kafe',       color: '#0ea5a4', icon: '☕' },
  bar:         { label: 'Bar',        color: '#8b5cf6', icon: '🍸' },
  beach_club:  { label: 'Beach Club', color: '#3b82f6', icon: '🏖️' },
  barber:      { label: 'Berber',     color: '#ef4444', icon: '💈' },
  hotel:       { label: 'Otel',       color: '#d4327a', icon: '🏨' },
};
const catOf = (c) => CATEGORY[c] ? c : 'restaurant';

async function readJson(rel, fb) {
  try { return JSON.parse(await readFile(join(ROOT, rel), 'utf8')); } catch { return fb; }
}

// İsim normalize (eşleştirme için): TR küçük harf, noktalama/boşluk sadeleştir.
const norm = (s) => String(s || '')
  .toLocaleLowerCase('tr')
  .replace(/[’'"`.,&()/-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function catalogIndex(items, detailPrefix) {
  const bySlug = new Map(), byName = new Map();
  for (const v of items || []) {
    const enrich = {
      gallery: (v.gallery || []).filter(Boolean).slice(0, 8),
      image: v.image || (v.gallery || [])[0] || null,
      instagram: v.instagram || '',
      summary: v.summary || '',
      detailUrl: v.slug ? `${detailPrefix}/${v.slug}` : (v.id ? `${detailPrefix}/${v.id}` : null),
    };
    if (v.slug) bySlug.set(v.slug, enrich);
    if (v.id) bySlug.set(v.id, enrich);
    if (v.name) byName.set(norm(v.name), enrich);
  }
  return { bySlug, byName };
}

// ── discovered (geo kaynağı) ──
const discFile = readdirSync(join(ROOT, 'data', 'discovered'))
  .filter(n => n.startsWith('all-kalkan') && n.endsWith('.json')).sort().pop();
if (!discFile) { console.error('✗ data/discovered/all-kalkan-*.json yok'); process.exit(1); }
const disc = JSON.parse(await readFile(join(ROOT, 'data', 'discovered', discFile), 'utf8'));
const discItems = disc.items || disc.results || (Array.isArray(disc) ? disc : []);

// ── küratörlü kataloglar (galeri/IG/özet zenginleştirme) ──
const rest = await readJson('restoranlar.json', { items: [] });
const otel = await readJson('oteller.json', { items: [] });
const restIdx = catalogIndex(rest.items || [], '/restoran');
const otelIdx = catalogIndex(otel.items || [], '/otel');

const venues = [];
let enriched = 0;
for (const d of discItems) {
  const c = d.coordinates || {};
  const lat = c.latitude ?? c.lat, lng = c.longitude ?? c.lng;
  if (lat == null || lng == null) continue;

  const category = catOf(d.category);
  const idx = category === 'hotel' ? otelIdx : restIdx;
  const match = (d.slug && idx.bySlug.get(d.slug)) || (d.id && idx.bySlug.get(d.id)) || idx.byName.get(norm(d.name)) || null;
  if (match) enriched++;

  // Açık/kapalı + kapanış saatini normalize et.
  const openState = d.open_state || d.openState || '';
  const isOpen = /açık|open/i.test(openState);
  const closeMatch = openState.match(/(\d{1,2}:\d{2})/);

  venues.push({
    id: d.slug || d.id || d.place_id,
    name: d.name,
    category,
    catLabel: CATEGORY[category].label,
    color: CATEGORY[category].color,
    icon: CATEGORY[category].icon,
    lat: +(+lat).toFixed(6),
    lng: +(+lng).toFixed(6),
    rating: d.rating || null,
    reviewCount: d.reviewCount || d.reviews || null,
    priceLevel: d.priceLevel || d.price || null,
    website: d.website || (match && match.detailUrl) || null,
    detailUrl: match?.detailUrl || null,
    address: d.address || '',
    phone: d.phone || '',
    placeId: d.place_id || null,
    isOpen,
    closesAt: closeMatch ? closeMatch[1] : null,
    thumbnail: (match && match.image) || d.thumbnail || null,
    gallery: match?.gallery || (d.thumbnail ? [d.thumbnail] : []),
    instagram: match?.instagram || '',
    summary: match?.summary || '',
  });
}

const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    count: venues.length,
    enriched,
    center: CENTER,
    source: discFile,
    categories: CATEGORY,
    note: 'doluluk client-side heuristik olarak hesaplanır (occupancy.js)',
  },
  venues: venues.sort((a, b) => (b.rating || 0) - (a.rating || 0)),
};

await writeFile(join(ROOT, 'data', 'harita-mekanlar.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(`✓ data/harita-mekanlar.json — ${venues.length} mekan (${enriched} küratörlü eşleşme), kaynak ${discFile}`);
const byCat = {};
venues.forEach(v => { byCat[v.category] = (byCat[v.category] || 0) + 1; });
console.log('  kategoriler:', JSON.stringify(byCat));
