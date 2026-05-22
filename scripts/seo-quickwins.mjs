/**
 * SEO Quick Wins — 2026-05-19
 * 1. og:locale:alternate (4 dil) eklenir, mevcutsa atlanır
 * 2. hreflang (tr/en/de/ru/fr/x-default) `?lang=xx` query param ile eklenir
 * 3. Google Fonts &display=swap kontrolü
 * 4. index.html LocalBusiness JSON-LD eklenir
 */
import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, stat } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://kalkaninfo.com';

const SEO_PAGES = [
  'index.html',
  'plajlar.html',
  'restoranlar.html',
  'villalar.html',
  'turlar.html',
  'hizmetler.html',
  'haberler.html',
  'aktiviteler.html',
  'antik-kentler.html',
  'ilan-ver.html',
  'ilanlar.html',
  'hakkimizda.html',
  'tatil-asistani.html',
  'kvkk.html',
  'privacy.html',
  'terms.html',
  'data-deletion.html',
  'hizmet-ekle.html',
  'login.html',
  'register.html',
  'profil.html',
  '404.html',
  'antik-kentler/patara.html',
  'antik-kentler/xanthos.html',
  'antik-kentler/letoon.html',
  'antik-kentler/tlos.html',
  'antik-kentler/pinara.html',
  'antik-kentler/simena.html',
  'antik-kentler/antiphellos.html',
  'antik-kentler/myra.html',
  'antik-kentler/andriake.html',
  'antik-kentler/aperlae.html',
];

const OG_LOCALE_BLOCK = [
  '<meta property="og:locale:alternate" content="en_US">',
  '<meta property="og:locale:alternate" content="de_DE">',
  '<meta property="og:locale:alternate" content="ru_RU">',
  '<meta property="og:locale:alternate" content="fr_FR">',
].join('\n');

function buildHreflangBlock(relPath) {
  // relPath like "villalar.html" or "antik-kentler/patara.html"
  // TR is default (no prefix). EN/DE/RU/FR use subdirectory pattern.
  const trUrl = relPath === 'index.html' ? `${SITE}/` : `${SITE}/${relPath}`;
  return [
    `<link rel="alternate" hreflang="tr" href="${trUrl}">`,
    `<link rel="alternate" hreflang="en" href="${SITE}/en/${relPath}">`,
    `<link rel="alternate" hreflang="de" href="${SITE}/de/${relPath}">`,
    `<link rel="alternate" hreflang="ru" href="${SITE}/ru/${relPath}">`,
    `<link rel="alternate" hreflang="fr" href="${SITE}/fr/${relPath}">`,
    `<link rel="alternate" hreflang="x-default" href="${trUrl}">`,
  ].join('\n');
}

const HOMEPAGE_LOCAL_BIZ_JSONLD = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  'name': 'Kalkan Info',
  'image': `${SITE}/icons/icon-512.png`,
  'url': SITE,
  '@id': `${SITE}/#localbusiness`,
  'description': 'Kalkan, Kaş ve Patara için yerel hizmet rehberi ve kurumsal concierge servisi.',
  'address': {
    '@type': 'PostalAddress',
    'streetAddress': 'Atatürk Cad.',
    'addressLocality': 'Kalkan',
    'addressRegion': 'Antalya',
    'postalCode': '07580',
    'addressCountry': 'TR'
  },
  'geo': {
    '@type': 'GeoCoordinates',
    'latitude': 36.2655,
    'longitude': 29.4138
  },
  'telephone': '+90-242-CONCIERGE',
  'openingHoursSpecification': [{
    '@type': 'OpeningHoursSpecification',
    'dayOfWeek': ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    'opens': '09:00',
    'closes': '22:00'
  }],
  'priceRange': '₺₺-₺₺₺',
  'areaServed': ['Kalkan','Kaş','Patara','Antalya']
})}</script>`;

function pickHrefForPath(relPath) {
  // index.html -> https://kalkaninfo.com/ ; subpages -> full path
  if (relPath === 'index.html') return SITE + '/';
  return `${SITE}/${relPath}`;
}

function buildHreflangBlockExact(relPath) {
  const trBase = pickHrefForPath(relPath);
  // For subdir pattern: index.html -> /en/, /de/, etc. ; subpages -> /en/<relPath>
  const subdirPath = relPath === 'index.html' ? '' : relPath;
  return [
    `<link rel="alternate" hreflang="tr" href="${trBase}">`,
    `<link rel="alternate" hreflang="en" href="${SITE}/en/${subdirPath}">`,
    `<link rel="alternate" hreflang="de" href="${SITE}/de/${subdirPath}">`,
    `<link rel="alternate" hreflang="ru" href="${SITE}/ru/${subdirPath}">`,
    `<link rel="alternate" hreflang="fr" href="${SITE}/fr/${subdirPath}">`,
    `<link rel="alternate" hreflang="x-default" href="${trBase}">`,
  ].join('\n');
}

async function processPage(relPath) {
  const filePath = path.join(ROOT, relPath);
  let html;
  try {
    html = await readFile(filePath, 'utf8');
  } catch (e) {
    return { relPath, status: 'missing' };
  }
  const original = html;
  const out = { ogLocaleAdded: false, hreflangUpdated: false, fontFixed: false, jsonLdAdded: false };

  // 1. og:locale:alternate — only add if missing
  if (!/og:locale:alternate/i.test(html)) {
    // Find og:locale and inject after it
    const locTagRe = /(<meta\s+property=["']og:locale["'][^>]*>)/i;
    if (locTagRe.test(html)) {
      html = html.replace(locTagRe, `$1\n${OG_LOCALE_BLOCK}`);
      out.ogLocaleAdded = true;
    } else {
      // Insert after canonical or after <title>
      const canonRe = /(<link\s+rel=["']canonical["'][^>]*>)/i;
      const titleRe = /(<\/title>)/i;
      const insertion = `<meta property="og:locale" content="tr_TR">\n${OG_LOCALE_BLOCK}`;
      if (canonRe.test(html)) {
        html = html.replace(canonRe, `$1\n${insertion}`);
        out.ogLocaleAdded = true;
      } else if (titleRe.test(html)) {
        html = html.replace(titleRe, `$1\n${insertion}`);
        out.ogLocaleAdded = true;
      }
    }
  }

  // 2. hreflang replacement — remove existing hreflang lines, insert canonical block
  const hreflangBlock = buildHreflangBlockExact(relPath);
  const subdirPath = relPath === 'index.html' ? '' : relPath;
  const expectedTr = `hreflang="tr" href="${pickHrefForPath(relPath)}"`;
  const expectedEn = `hreflang="en" href="${SITE}/en/${subdirPath}"`;
  const alreadyCorrect = html.includes(expectedTr) && html.includes(expectedEn);
  if (/hreflang=/i.test(html)) {
    if (!alreadyCorrect) {
      // Replace all existing hreflang lines with canonical block
      const linkLineRe = /[ \t]*<link\s+rel=["']alternate["']\s+hreflang=["'][^"']+["'][^>]*>\n?/gi;
      let firstIdx = html.search(linkLineRe);
      html = html.replace(linkLineRe, '');
      if (firstIdx > -1) {
        html = html.slice(0, firstIdx) + hreflangBlock + '\n' + html.slice(firstIdx);
        out.hreflangUpdated = true;
      }
    }
  } else {
    // No hreflang at all; insert after canonical or after <title>
    const canonRe = /(<link\s+rel=["']canonical["'][^>]*>)/i;
    if (canonRe.test(html)) {
      html = html.replace(canonRe, `$1\n${hreflangBlock}`);
      out.hreflangUpdated = true;
    } else {
      // No canonical either — insert canonical + hreflang after <title>
      const titleRe = /(<\/title>)/i;
      if (titleRe.test(html)) {
        const canonical = `<link rel="canonical" href="${pickHrefForPath(relPath)}">`;
        html = html.replace(titleRe, `$1\n${canonical}\n${hreflangBlock}`);
        out.hreflangUpdated = true;
      }
    }
  }

  // 3. Google Fonts &display=swap check (already done, just verify)
  const fontMatch = html.match(/fonts\.googleapis\.com\/css2\?[^"']*/);
  if (fontMatch && !/display=swap/.test(fontMatch[0])) {
    html = html.replace(/(fonts\.googleapis\.com\/css2\?[^"']*?)(["'])/g, (m, url, q) => {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}display=swap${q}`;
    });
    out.fontFixed = true;
  }

  // 4. LocalBusiness JSON-LD for index.html (only if not present)
  if (relPath === 'index.html' && !/"@type":"LocalBusiness"/.test(html)) {
    // Insert before </head> or after last existing ld+json
    const lastLdRe = /(<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>)(?![\s\S]*<script\s+type=["']application\/ld\+json["'])/i;
    if (lastLdRe.test(html)) {
      html = html.replace(lastLdRe, `$1\n${HOMEPAGE_LOCAL_BIZ_JSONLD}`);
      out.jsonLdAdded = true;
    }
  }

  if (html !== original) {
    await writeFile(filePath, html, 'utf8');
    return { relPath, status: 'updated', ...out };
  }
  return { relPath, status: 'skipped', ...out };
}

const results = [];
for (const p of SEO_PAGES) {
  const r = await processPage(p);
  results.push(r);
}

const updated = results.filter(r => r.status === 'updated');
const missing = results.filter(r => r.status === 'missing');
console.log(`\n=== SEO Quick Wins ===`);
console.log(`Processed: ${results.length}`);
console.log(`Updated: ${updated.length}`);
console.log(`Missing: ${missing.length}`);
console.log(`Skipped: ${results.filter(r => r.status === 'skipped').length}`);
if (missing.length) console.log(`Missing files: ${missing.map(r => r.relPath).join(', ')}`);
console.log(`\nDetails:`);
for (const r of updated) {
  const flags = [];
  if (r.ogLocaleAdded) flags.push('og:locale:alt');
  if (r.hreflangUpdated) flags.push('hreflang');
  if (r.fontFixed) flags.push('font-swap');
  if (r.jsonLdAdded) flags.push('localbiz');
  console.log(`  ${r.relPath}: ${flags.join(', ')}`);
}
