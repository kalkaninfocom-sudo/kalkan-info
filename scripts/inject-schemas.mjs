#!/usr/bin/env node
/**
 * inject-schemas.mjs — 2026-05-22
 * Idempotent JSON-LD batch inject:
 *   1. restoranlar.html  -> ItemList of Restaurant (from data/restoranlar.json items[])
 *   2. villalar.html     -> ItemList of LodgingBusiness (from data/villalar.json items[])
 *   3. antik-kentler/*.html (10 cities) -> TouristAttraction
 *
 * Markers (data-schema attr) ensure existing blocks are replaced, not duplicated.
 *
 * Usage: node scripts/inject-schemas.mjs
 */
import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://kalkaninfo.com';

function absUrl(p) {
  if (!p) return undefined;
  if (/^https?:\/\//i.test(p)) return p;
  return `${SITE}/${String(p).replace(/^\//, '')}`;
}

function stripUndef(obj) {
  if (Array.isArray(obj)) return obj.map(stripUndef);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      out[k] = stripUndef(v);
    }
    return out;
  }
  return obj;
}

async function injectJsonLd(htmlRelPath, ldObject, idAttr) {
  const filePath = path.join(ROOT, htmlRelPath);
  const html = await readFile(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  // Remove existing schema block(s) with same marker so re-runs are idempotent
  $(`script[type="application/ld+json"][data-schema="${idAttr}"]`).remove();
  const json = JSON.stringify(stripUndef(ldObject), null, 2);
  $('head').append(
    `\n<script type="application/ld+json" data-schema="${idAttr}">${json}</script>\n`
  );
  await writeFile(filePath, $.html(), 'utf8');
  return { file: htmlRelPath, marker: idAttr, type: ldObject['@type'] };
}

// -------- 1. Restoranlar ItemList<Restaurant> --------
async function injectRestoranlar() {
  const data = JSON.parse(await readFile(path.join(ROOT, 'data/restoranlar.json'), 'utf8'));
  const items = (data.items || []).filter((r) => r && r.name);
  const itemListElement = items.map((r, i) => {
    const cuisine = r.cuisine || (Array.isArray(r.specialties) ? r.specialties[0] : undefined);
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Restaurant',
        name: r.name,
        image: absUrl(r.image),
        url: r.website || `${SITE}/restoranlar.html`,
        servesCuisine: cuisine,
        priceRange: r.priceRange,
        telephone: r.phone || undefined,
        address: {
          '@type': 'PostalAddress',
          addressLocality: r.location || 'Kalkan',
          addressRegion: 'Antalya',
          addressCountry: 'TR',
        },
      },
    };
  });
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Kalkan Restaurants & Bars',
    numberOfItems: itemListElement.length,
    itemListElement,
  };
  return injectJsonLd('restoranlar.html', ld, 'restaurant-list');
}

// -------- 2. Villalar ItemList<LodgingBusiness> --------
async function injectVillalar() {
  const data = JSON.parse(await readFile(path.join(ROOT, 'data/villalar.json'), 'utf8'));
  const items = (data.items || []).filter((v) => v && v.name);
  const itemListElement = items.map((v, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'LodgingBusiness',
      name: v.name,
      image: absUrl(v.image),
      url: v.referenceUrl || `${SITE}/villalar.html#${v.id || ''}`,
      numberOfRooms: v.bedrooms || undefined,
      description: v.summary || undefined,
      address: {
        '@type': 'PostalAddress',
        addressLocality: v.location || 'Kalkan',
        addressRegion: 'Antalya',
        addressCountry: 'TR',
      },
      amenityFeature: Array.isArray(v.features)
        ? v.features.slice(0, 8).map((f) => ({
            '@type': 'LocationFeatureSpecification',
            name: String(f),
          }))
        : undefined,
    },
  }));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Kalkan Info Villas',
    numberOfItems: itemListElement.length,
    itemListElement,
  };
  return injectJsonLd('villalar.html', ld, 'lodging-list');
}

// -------- 3. Antik Kentler TouristAttraction --------
const CITY_META = {
  patara: {
    name: 'Patara Antik Kenti',
    desc: 'UNESCO Dünya Mirası adayı, Likya Birliği başkenti, Apollo kahini, 18 km uzun plaj ve deniz kaplumbağası üreme alanı.',
    img: '/assets/img/patara-wm.webp',
  },
  xanthos: {
    name: 'Xanthos Antik Kenti',
    desc: 'UNESCO Dünya Mirası, Likya başkenti, özgürlük şehri ve Harpy Anıtı ile ünlü.',
    img: '/assets/img/xanthos.webp',
  },
  letoon: {
    name: 'Letoon Antik Kutsal Alanı',
    desc: 'UNESCO Dünya Mirası, Leto, Apollon ve Artemis tapınakları ile Likya federal dini merkezi.',
    img: '/assets/img/letoon.webp',
  },
  tlos: {
    name: 'Tlos Antik Kenti',
    desc: 'Bellerophon ve Pegasus efsanesinin geçtiği şehir, kaya mezarları ve Roma stadyumu ile.',
    img: '/assets/img/tlos.webp',
  },
  pinara: {
    name: 'Pinara Antik Kenti',
    desc: 'Sarp dağ yamacına oyulmuş Likya kaya mezarları ve geniş nekropolis.',
    img: '/assets/img/pinara.webp',
  },
  simena: {
    name: 'Simena (Kaleköy) Antik Kenti',
    desc: 'Kekova Körfezi sualtı şehri, ortaçağ kalesi ve Likya nekropolisi ile.',
    img: '/assets/img/simena.webp',
  },
  antiphellos: {
    name: 'Antiphellos (Kaş) Antik Kenti',
    desc: 'Likya liman kenti, Helenistik tiyatro ve Kral Mezarı ile bilinir.',
    img: '/assets/img/antiphellos.webp',
  },
  myra: {
    name: 'Myra Antik Kenti',
    desc: 'Aziz Nikolaos\'un şehri, kaya mezarları ve büyük Roma tiyatrosu ile Likya başkenti.',
    img: '/assets/img/myra.webp',
  },
  andriake: {
    name: 'Andriake Antik Kenti',
    desc: 'Myra\'nın limanı, Hadrian granaryumu ve Likya Medeniyetleri Müzesi ile Roma ticaret merkezi.',
    img: '/assets/img/andriake.webp',
  },
  aperlae: {
    name: 'Aperlae Antik Kenti',
    desc: 'Kekova bölgesinde sualtı kalıntıları olan Likya Birliği üyesi liman şehri.',
    img: '/assets/img/aperlae.webp',
  },
};

async function injectAntikKentler() {
  const results = [];
  for (const [slug, m] of Object.entries(CITY_META)) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'TouristAttraction',
      name: m.name,
      description: m.desc,
      image: `${SITE}${m.img}`,
      url: `${SITE}/antik-kentler/${slug}.html`,
      publicAccess: true,
      isAccessibleForFree: false,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Antalya',
        addressRegion: 'Antalya',
        addressCountry: 'TR',
      },
    };
    const r = await injectJsonLd(`antik-kentler/${slug}.html`, ld, 'tourist-attraction');
    results.push(r);
  }
  return results;
}

async function main() {
  const out = [];
  out.push(await injectRestoranlar());
  out.push(await injectVillalar());
  const cities = await injectAntikKentler();
  out.push(...cities);
  console.log('=== JSON-LD Schemas Injected ===');
  for (const r of out) {
    console.log(`  ${r.file} <- ${r.type} (marker=${r.marker})`);
  }
  console.log(`Total: ${out.length} pages updated`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
