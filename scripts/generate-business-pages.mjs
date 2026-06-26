#!/usr/bin/env node
/**
 * data/restoranlar.json + data/hizmetler.json içindeki source="google_maps" işletmeler için
 * restoran/<slug>/index.html veya hizmet/<slug>/index.html üretir.
 *
 * Template: restoran/_template-gm/index.html  (ortak, ufak farklarla restoran + hizmet)
 *
 * Kullanım:
 *   node scripts/generate-business-pages.mjs
 *   node scripts/generate-business-pages.mjs --dry-run    # üretmez, sadece sayar
 *   node scripts/generate-business-pages.mjs --force      # mevcut sayfaları override eder
 *
 * Mevcut sponsor (source=client) sayfaları DOKUNULMAZ.
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.includes('=') ? a.slice(2).split('=') : [a.slice(2), true])
);
const DRY = !!args['dry-run'];
const FORCE = !!args.force;

const TEMPLATE = await readFile(join(ROOT, 'restoran', '_template-gm', 'index.html'), 'utf8');

// ─── Helpers ───
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function defaultSummary(item) {
  const cat = item.category || 'mekan';
  const r = item.rating ? `Google'da ⭐${item.rating} puan` : '';
  const c = item.reviewCount ? ` (${item.reviewCount} yorum)` : '';
  const loc = item.location ? ` ${item.location.split(',')[0]} konumunda.` : '';
  return `${item.name} — Kalkan'da ${cat}. ${r}${c}.${loc}`.trim();
}

function ratingHtml(item) {
  if (!item.rating) return '';
  const stars = '★'.repeat(Math.round(item.rating));
  return `<span class="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-semibold">
    <span class="text-sun-500">${stars}</span>
    <span>${item.rating}</span>
    ${item.reviewCount ? `<span class="opacity-75">· ${item.reviewCount} yorum</span>` : ''}
  </span>`;
}

function priceHtml(item) {
  const p = item.priceRange || item.priceLevel;
  if (!p) return '';
  return `<span class="text-white/70 text-xs">${escapeHtml(p)}</span>`;
}

function infoRow(label, value, href = null) {
  if (!value) return '';
  const v = href
    ? `<a href="${href}" class="text-sea-700 hover:text-sun-600 underline-offset-2 hover:underline">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `<div class="flex gap-3"><dt class="font-medium text-sea-900/70 min-w-[90px]">${label}</dt><dd class="text-sea-900">${v}</dd></div>`;
}

function infoRows(item) {
  const rows = [];
  if (item.phone) {
    const tel = item.phone.replace(/[^+0-9]/g, '');
    rows.push(infoRow('Telefon', item.phone, `tel:${tel}`));
  }
  if (item.location) rows.push(infoRow('Adres', item.location));
  if (item.website) rows.push(infoRow('Web Sitesi', item.website.replace(/^https?:\/\//, ''), item.website));
  if (item.instagram) rows.push(infoRow('Instagram', '@' + item.instagram.split('/').filter(Boolean).pop(), item.instagram));
  if (item.category) rows.push(infoRow('Kategori', item.category));
  return rows.join('\n') || '<dd class="text-sea-900/60 text-sm">Detaylı bilgi yakında.</dd>';
}

function hoursBlock(item) {
  if (!item.hours) return '';
  return `<div class="bg-white rounded-2xl p-6 border border-sea-900/10">
    <h2 class="display text-xl font-bold text-sea-900 mb-3">Çalışma Saatleri</h2>
    <p class="text-sm text-sea-900/80">${escapeHtml(item.hours)}</p>
  </div>`;
}

function actionButtons(item) {
  const btns = [];
  if (item.phone) {
    const tel = item.phone.replace(/[^+0-9]/g, '');
    btns.push(`<a href="tel:${tel}" class="inline-flex items-center gap-2 bg-sun-500 hover:bg-sun-600 text-sea-900 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors">📞 Ara</a>`);
  }
  const q = encodeURIComponent(item.name + ' ' + (item.location || 'Kalkan'));
  btns.push(`<a href="https://www.google.com/maps/dir/?api=1&destination=${q}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-4 py-2.5 rounded-lg backdrop-blur transition-colors">🧭 Yol Tarifi</a>`);
  if (item.website) {
    btns.push(`<a href="${escapeHtml(item.website)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-4 py-2.5 rounded-lg backdrop-blur transition-colors">🌐 Web Sitesi</a>`);
  }
  return btns.join('\n      ');
}

function schemaJson(item, kind) {
  const types = kind === 'restoran' ? 'Restaurant' : 'LocalBusiness';
  const obj = {
    '@context': 'https://schema.org',
    '@type': types,
    name: item.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: item.location || '',
      addressLocality: 'Kalkan',
      addressRegion: 'Antalya',
      addressCountry: 'TR',
    },
    telephone: item.phone || undefined,
    url: item.website || `https://kalkaninfo.com/${kind}/${item.id}/`,
    image: item.image || undefined,
  };
  if (item.rating && item.reviewCount) {
    obj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: item.rating,
      reviewCount: item.reviewCount,
    };
  }
  if (item.coordinates) {
    obj.geo = {
      '@type': 'GeoCoordinates',
      latitude: item.coordinates.latitude,
      longitude: item.coordinates.longitude,
    };
  }
  return JSON.stringify(obj, null, 2);
}

function fallbackHero(category) {
  // Generic Kalkan stok foto (Unsplash CDN, kategoriye göre)
  const heroMap = {
    Restoran: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80',
    Kafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&q=80',
    'Bar & Pub': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&q=80',
    'Plaj Kulübü': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
    'Berber & Kuaför': 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1600&q=80',
    'Market & Manav': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80',
    'Eczane': 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80',
    'Fırın & Pastane': 'https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=1600&q=80',
    'ATM': 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=1600&q=80',
    'Çamaşırhane': 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?w=1600&q=80',
    'Dalış Merkezi': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80',
    'Tekne Turu': 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1600&q=80',
  };
  return heroMap[category] || 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1600&q=80';
}

// ─── Render single page ───
function renderPage(item, kind) {
  const canonicalPath = `/${kind}/${item.id}/`;
  const slugDir = `assets/img/business/${item.id}`;

  // Foto: önce kendi cache, yoksa kategori fallback
  let hero = `/${slugDir}/hero.webp`;
  if (!existsSync(join(ROOT, slugDir, 'hero.webp'))) {
    hero = fallbackHero(item.category);
  }
  const og = hero;

  const summary = item.summary || defaultSummary(item);

  const map = {
    NAME: escapeHtml(item.name),
    SLUG: item.id,
    CATEGORY: escapeHtml(item.category || ''),
    SUMMARY: escapeHtml(summary),
    CANONICAL_PATH: canonicalPath,
    AREA_LABEL: 'Kalkan',
    HERO_IMAGE: hero,
    OG_IMAGE: og,
    GEO_LAT: item.coordinates?.latitude || 36.265,
    GEO_LNG: item.coordinates?.longitude || 29.412,
    RATING_HTML: ratingHtml(item),
    PRICE_HTML: priceHtml(item),
    ACTION_BUTTONS: actionButtons(item),
    INFO_ROWS: infoRows(item),
    HOURS_BLOCK: hoursBlock(item),
    MAPS_QUERY: encodeURIComponent(item.name + ' ' + (item.location || 'Kalkan')),
    SCHEMA_JSON: schemaJson(item, kind),
  };

  return TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] !== undefined ? String(map[k]) : '');
}

// ─── Main ───
const sources = [
  { file: 'restoranlar.json', kind: 'restoran' },
  { file: 'hizmetler.json',   kind: 'hizmet'   },
];

let generated = 0, skipped = 0, sponsored = 0;
const newSlugs = [];

for (const { file, kind } of sources) {
  const data = JSON.parse(await readFile(join(ROOT, 'data', file), 'utf8'));
  const items = (data.items || []).filter(i => i.source === 'google_maps');

  console.log(`\n📄 ${file} → ${kind}/ (${items.length} google_maps mekan)`);

  for (const item of items) {
    const outDir = join(ROOT, kind, item.id);
    const outPath = join(outDir, 'index.html');

    if (!FORCE && existsSync(outPath)) {
      skipped++;
      continue;
    }

    if (DRY) {
      generated++;
      continue;
    }

    await mkdir(outDir, { recursive: true });
    const html = renderPage(item, kind);
    await writeFile(outPath, html, 'utf8');
    generated++;
    newSlugs.push(`/${kind}/${item.id}/`);
  }

  // Sponsor sayma (raporlama)
  sponsored += (data.items || []).filter(i => i.source === 'client').length;
}

console.log(`\n✅ Üretildi: ${generated}, atlandı (var): ${skipped}, sponsor dokunulmadı: ${sponsored}`);
if (!DRY && newSlugs.length) {
  const sample = newSlugs.slice(0, 5).join(', ') + (newSlugs.length > 5 ? '...' : '');
  console.log(`   Örnek URL'ler: ${sample}`);
}
