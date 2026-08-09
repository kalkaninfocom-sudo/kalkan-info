#!/usr/bin/env node
/**
 * build-villa-i18n.mjs
 * Her villa için dil-özel STATİK sayfa üretir (gerçek çok-dilli SEO).
 *   TR  -> villa/villa-<slug>/index.html            (baz, hreflang/canonical güncellenir)
 *   XX  -> villa/villa-<slug>/<lang>/index.html      (en/de/ru/fr)
 *
 * Yaklaşım: sayfanın KENDİ i18n motorunu puppeteer'da o dilde çalıştırıp
 * doğru <title>/meta/og/<html lang> değerlerini çeker; bu değerleri HAM HTML head'ine
 * enjekte eder (Google için en güçlü dil sinyalleri). Gövde JS ile o dile render olur
 * (Googlebot JS render eder). hreflang kümesi temiz URL'lere işaret eder.
 *
 * Kullanım: node scripts/build-villa-i18n.mjs            (localhost:3000 çalışıyor olmalı)
 *           node scripts/build-villa-i18n.mjs poyraz     (tek villa)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ORIGIN = 'https://kalkaninfo.com';
const LANGS = ['tr', 'en', 'de', 'ru', 'fr'];
const OG_LOCALE = { tr: 'tr_TR', en: 'en_US', de: 'de_DE', ru: 'ru_RU', fr: 'fr_FR' };

const VILLAS = [
  { slug: 'villa-poyraz' },
  { slug: 'villa-seascape' },
  { slug: 'villa-ship-ahoy' },
];

const only = process.argv[2]; // opsiyonel: 'poyraz' gibi
const villas = only ? VILLAS.filter(v => v.slug.includes(only)) : VILLAS;

// Site konvansiyonu: trailingSlash:false + cleanUrls → URL'ler slash'sız (200; slash → 308 redirect)
function langUrl(slug, lang) {
  return lang === 'tr'
    ? `${ORIGIN}/villa/${slug}`
    : `${ORIGIN}/villa/${slug}/${lang}`;
}

// Head meta'yı puppeteer'da o dilde render edip değerleri döndürür
// Kaynaktaki `var META = {...}` literalini çıkar (brace-matching)
function extractObjectLiteral(src, afterIndex) {
  let i = src.indexOf('{', afterIndex);
  if (i < 0) return null;
  let depth = 0, inStr = false, q = '', esc = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === q) inStr = false;
    } else {
      if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; }
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
    }
  }
  return null;
}

// Sayfanın kendi META objesini parse edip dil başına {title, desc} döndürür.
// Üç farklı şekli destekler: {en:{title,desc}} / {en:{title,desc,ogTitle..}} / {title:{tr,en..},description:{..}}
function parseMeta(src) {
  const srcTitle = (src.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const srcDesc = (src.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '';
  const out = {};
  for (const l of LANGS) out[l] = { title: srcTitle, desc: srcDesc };

  const mi = src.search(/\bMETA\s*=/);
  if (mi < 0) return out;
  const lit = extractObjectLiteral(src, mi);
  if (!lit) return out;
  let obj;
  try {
    obj = vm.runInNewContext(`(${lit})`, { document: { title: srcTitle } });
  } catch (e) { console.warn('META parse hata:', e.message); return out; }

  const shapeFieldKeyed = obj.title && typeof obj.title === 'object'; // {title:{tr,en..}}
  for (const l of LANGS) {
    if (shapeFieldKeyed) {
      const t = obj.title[l], d = (obj.description || obj.desc || {})[l];
      if (t) out[l].title = t;
      if (d) out[l].desc = d;
    } else if (obj[l]) {
      if (obj[l].title) out[l].title = obj[l].title;
      if (obj[l].desc) out[l].desc = obj[l].desc;
    }
  }
  return out;
}

// HTML string üzerinde head/hreflang/lang enjeksiyonu (regex, güvenli hedefli)
function transform(html, slug, lang, meta) {
  const esc = s => (s || '').replace(/"/g, '&quot;');
  const url = langUrl(slug, lang);

  // idempotent: önceki i18n-static inject'i temizle (tekrar çalıştırmada çift enjeksiyon olmasın)
  html = html.replace(/\n?<script>\/\* i18n-static \*\/[\s\S]*?<\/script>\n?/g, '\n');

  // <html lang="..">
  html = html.replace(/<html[^>]*\blang="[^"]*"/i, m => m.replace(/lang="[^"]*"/, `lang="${lang}"`));
  // <title>
  if (meta.title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);
  // meta description
  if (meta.desc) html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, `$1${esc(meta.desc)}$2`);
  // og:locale
  html = html.replace(/(<meta\s+property="og:locale"\s+content=")[^"]*(")/i, `$1${OG_LOCALE[lang]}$2`);
  // og / twitter title+description -> çevrilmiş title/description kullan
  const ogT = meta.title;
  const ogD = meta.desc;
  if (ogT) html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${esc(ogT)}$2`);
  if (ogD) html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, `$1${esc(ogD)}$2`);
  if (ogT) html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i, `$1${esc(ogT)}$2`);
  if (ogD) html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i, `$1${esc(ogD)}$2`);
  // canonical + og:url -> bu dilin temiz URL'i
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${url}$2`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/i, `$1${url}$2`);

  // hreflang bloğu -> temiz URL'ler (tüm alternate satırlarını yeniden yaz)
  const hreflangBlock = LANGS.map(l =>
    `<link rel="alternate" hreflang="${l}" href="${langUrl(slug, l)}" />`
  ).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${langUrl(slug, 'tr')}" />`;
  // mevcut tüm hreflang alternate satırlarını (x-default dâhil) tek blokla değiştir
  html = html.replace(/(?:[ \t]*<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>\s*\n?)+/i, hreflangBlock + '\n');

  // i18n-static: (1) sayfanın dilini HİÇBİR script değiştirmeden önce yakala (__STATIC_LANG__) —
  //   getInitialLang bunu okur (takvim re-apply'ı html lang'ı resetlese bile güvenli).
  //   (2) dil-switcher butonları gerçek dil URL'lerine gitsin (crawlable).
  // ÖNEMLİ: <head> başına, tüm sayfa script'lerinden ÖNCE.
  const inject = `<script>/* i18n-static */
(function(){var LANGS=['tr','en','de','ru','fr'];
window.__STATIC_LANG__=(document.documentElement.getAttribute('lang')||'').toLowerCase();
var BASE='/villa/${slug}/';
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-lang]');if(!b)return;var l=b.getAttribute('data-lang');if(LANGS.indexOf(l)<0)return;e.preventDefault();e.stopImmediatePropagation();var dest=(l==='tr')?BASE.replace(/\\/$/,''):BASE+l;var cur=location.pathname.replace(/\\/(index\\.html)?$/,'');if(cur!==dest)location.href=dest;},true);
})();</script>
`;
  html = html.replace(/<head(\s[^>]*)?>/i, m => m + '\n' + inject);
  return html;
}

const root = process.cwd();
let written = 0;

for (const v of villas) {
  const srcPath = path.join(root, 'villa', v.slug, 'index.html');
  const src = fs.readFileSync(srcPath, 'utf8');
  const metaByLang = parseMeta(src); // kaynaktan deterministik parse
  for (const lang of LANGS) {
    console.log(`· ${v.slug} [${lang}] title: ${(metaByLang[lang].title || '').slice(0, 55)}`);
    const out = transform(src, v.slug, lang, metaByLang[lang]);
    const outPath = lang === 'tr'
      ? srcPath
      : path.join(root, 'villa', v.slug, lang, 'index.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, out, 'utf8');
    written++;
    console.log(`✓ ${v.slug} [${lang}] -> ${path.relative(root, outPath)}`);
  }
}
console.log(`\nToplam ${written} dosya yazıldı.`);
