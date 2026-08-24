#!/usr/bin/env node
/**
 * scripts/build-sitemap.mjs — SEO sitemap üretici (i18n hreflang'li)
 * ==================================================================
 * Denetim bulgusu (SITE-AUDIT-SEO.md C3/H2): sitemap TR-only (318 URL), 0 dil URL'i,
 * 0 hreflang, lastmod bayat (2026-06-27) → çevrilmiş /en//de//ru//fr sayfaları arama
 * motorunca KEŞFEDİLEMİYOR. Bu üretici mevcut kanonik URL setini KORUR ve:
 *   1. Her TR sayfa için, dil karşılığı diskte VARSA → xhtml:link hreflang kümesi (tr+4 dil+x-default)
 *   2. Çevrilebilir her sayfanın /en//de//ru//fr URL'lerini de ayrı <url> olarak ekler (reciprocal)
 *   3. lastmod'u bugüne çeker · .html artıklarını temizler · trailingSlash:false (slashsız)
 *
 * Güvenli: yalnız sitemap.xml üretir; sayfa render'ına DOKUNMAZ.
 * Kullanım: node scripts/build-sitemap.mjs   (mevcut sitemap.xml'i kaynak alır, üstüne yazar)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://kalkaninfo.com';
const LANGS = ['en', 'de', 'ru', 'fr'];
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD

// Mevcut sitemap'ten kanonik TR URL listesi (site'da GERÇEKTEN var olan sayfalar — güven kaynağı).
function currentLocs() {
  try {
    const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  } catch { return []; }
}

// TR loc → site-içi yol ("" = anasayfa). ".html" ve trailing slash temizle.
function pathOf(loc) {
  let p = loc.replace(BASE, '').replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '');
  return p; // "" | "restoranlar" | "restoran/adams-restaurant-kalkan"
}

// Bu yolun dil karşılığı diskte var mı? (yalnız kök-seviye çevrilmiş sayfalar için; detay sayfaları TR-only)
function isTranslatable(path) {
  const file = path === '' ? 'index' : path;
  return LANGS.every((l) => existsSync(join(ROOT, l, `${file}.html`)));
}

const trUrl = (path) => (path === '' ? `${BASE}/` : `${BASE}/${path}`);
const langUrl = (l, path) => (path === '' ? `${BASE}/${l}/` : `${BASE}/${l}/${path}`);

// Bir sayfa için (çevrilebilirse) hreflang alternatif blokları.
function altLinks(path) {
  const alts = [`<xhtml:link rel="alternate" hreflang="tr" href="${trUrl(path)}"/>`];
  for (const l of LANGS) alts.push(`<xhtml:link rel="alternate" hreflang="${l}" href="${langUrl(l, path)}"/>`);
  alts.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${trUrl(path)}"/>`);
  return alts.map((a) => `    ${a}`).join('\n');
}

function urlEntry(loc, path, translatable, priority) {
  const lines = [`  <url>`, `    <loc>${loc}</loc>`];
  if (translatable) lines.push(altLinks(path));
  lines.push(`    <lastmod>${TODAY}</lastmod>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  lines.push(`  </url>`);
  return lines.join('\n');
}

function build() {
  const locs = currentLocs();
  if (!locs.length) { console.error('✗ Mevcut sitemap.xml okunamadı — iptal.'); process.exit(1); }
  const seen = new Set();
  const entries = [];
  let translatableCount = 0, langUrlCount = 0;

  for (const loc of locs) {
    const path = pathOf(loc);
    const canonical = trUrl(path);
    if (seen.has(canonical)) continue; seen.add(canonical);
    const translatable = isTranslatable(path);
    if (translatable) translatableCount++;
    const prio = path === '' ? '1.0' : (/^(restoran|otel|villa)\//.test(path) ? '0.7' : '0.8');
    entries.push(urlEntry(canonical, path, translatable, prio));
    // Çevrilebilir sayfanın dil URL'lerini de reciprocal küme ile ekle
    if (translatable) {
      for (const l of LANGS) {
        const lu = langUrl(l, path);
        if (seen.has(lu)) continue; seen.add(lu);
        entries.push(urlEntry(lu, path, true, prio));
        langUrlCount++;
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join('\n') + `\n</urlset>\n`;
  writeFileSync(join(ROOT, 'sitemap.xml'), xml, 'utf8');
  console.log(`✓ sitemap.xml: ${seen.size} URL (${translatableCount} çevrilebilir sayfa → ${langUrlCount} dil URL'i + hreflang), lastmod ${TODAY}`);
}

build();
