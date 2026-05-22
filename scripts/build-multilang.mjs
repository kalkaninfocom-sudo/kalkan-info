#!/usr/bin/env node
// Multilang URL build: TR baseline → /{lang}/page.html statik render (EN/DE/RU/FR)
// data-{lang}, data-{lang}-{attr} pattern okur, internal link'leri /{lang}/ prefix'le yeniden yazar
// Asset path'leri mutlak yapar (/dist/tw.css) — sub-dir'de bozulmaz

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename, relative, posix } from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = resolve(import.meta.dirname || '.', '..');
const LANGS = ['en', 'de', 'ru', 'fr'];
const EXCLUDE = new Set(['admin.html', 'login.html', 'register.html', 'profil.html']);

const TITLE_FALLBACK = {
  en: 'Kalkan Info — The Kalkan & Lycia Guide',
  de: 'Kalkan Info — Der Reiseführer für Kalkan & Lykien',
  ru: 'Kalkan Info — Путеводитель по Калкану и Ликии',
  fr: 'Kalkan Info — Le guide de Kalkan & de la Lycie',
};

function collectHtml(dir, relBase = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    const rel = relBase ? `${relBase}/${entry}` : entry;
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (['node_modules', 'dist', 'en', 'de', 'ru', 'fr', '.git', '.vercel', 'temporary screenshots', '.omc', 'COMPANY', 'docs', 'data', 'scripts', 'icons', 'img', 'assets', 'js', 'api'].includes(entry)) continue;
      out.push(...collectHtml(abs, rel));
    } else if (entry.endsWith('.html') && !EXCLUDE.has(entry) && !rel.startsWith('temporary')) {
      out.push(rel);
    }
  }
  return out;
}

function rewriteLocalHref(href, lang) {
  if (!href) return href;
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('data:')) return href;
  const m = href.match(/^https?:\/\/(www\.)?kalkaninfo\.com(\/.*)?$/i);
  if (m) {
    const path = m[2] || '/';
    if (path === '/' || path === '') return `https://kalkaninfo.com/${lang}/`;
    if (path.match(/^\/(en|de|ru|fr)\//)) return href;
    return `https://kalkaninfo.com/${lang}${path}`;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('/')) {
    if (href.match(/^\/(en|de|ru|fr)(\/|$)/)) return href;
    if (href.match(/^\/(dist|js|css|img|assets|icons|data|api|p|antik-kentler|content)\b/)) return href;
    return `/${lang}${href}`;
  }
  if (/\.(html?|md)(\?|#|$)/i.test(href)) return `/${lang}/${href}`;
  return href;
}

function rewriteAssetPath(p, fileRelDir) {
  if (!p) return p;
  if (p.startsWith('http') || p.startsWith('/') || p.startsWith('#') || p.startsWith('data:') || p.startsWith('mailto:')) return p;
  return `/${posix.normalize(posix.join(fileRelDir, p))}`.replace(/\/+/g, '/');
}

const warnings = { lang: { en: 0, de: 0, ru: 0, fr: 0 }, byFile: {} };

function transformOne(fileRel, lang) {
  const absSrc = resolve(ROOT, fileRel);
  const html = readFileSync(absSrc, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const fileDir = dirname(fileRel).replace(/\\/g, '/');
  const isSubDir = fileDir !== '.';

  $('html').attr('lang', lang);

  $('a[href], link[href]').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName?.toLowerCase();
    const href = $el.attr('href');
    if (!href) return;
    if (tag === 'link') {
      const relAttr = ($el.attr('rel') || '').toLowerCase();
      if (relAttr.includes('stylesheet') || relAttr.includes('icon') || relAttr.includes('manifest') || relAttr.includes('preload') || relAttr.includes('preconnect') || relAttr.includes('dns-prefetch')) {
        if (relAttr.includes('alternate')) return;
        $el.attr('href', rewriteAssetPath(href, fileDir));
        return;
      }
    }
    $el.attr('href', rewriteLocalHref(href, lang));
  });

  $('script[src], img[src], source[src], iframe[src], video[src], audio[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (!src) return;
    $el.attr('src', rewriteAssetPath(src, fileDir));
  });

  $('img[srcset], source[srcset]').each((_, el) => {
    const $el = $(el);
    const ss = $el.attr('srcset');
    if (!ss) return;
    const rewritten = ss.split(',').map(part => {
      const trimmed = part.trim();
      const [url, ...rest] = trimmed.split(/\s+/);
      return [rewriteAssetPath(url, fileDir), ...rest].join(' ');
    }).join(', ');
    $el.attr('srcset', rewritten);
  });

  $('meta[property="og:url"], meta[name="canonical"]').each((_, el) => {
    const $el = $(el);
    const c = $el.attr('content') || $el.attr('href');
    if (c) {
      const attr = $el.attr('content') ? 'content' : 'href';
      $el.attr(attr, rewriteLocalHref(c, lang));
    }
  });
  $('link[rel="canonical"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (href) $el.attr('href', rewriteLocalHref(href, lang));
  });

  $('link[rel="alternate"][hreflang]').remove();
  const filename = basename(fileRel);
  const cleanPath = fileDir === '.' ? `/${filename}` : `/${fileDir}/${filename}`;
  const head = $('head');
  for (const l of ['tr', ...LANGS]) {
    const langPath = l === 'tr' ? cleanPath : `/${l}${cleanPath}`;
    head.append(`\n<link rel="alternate" hreflang="${l}" href="https://kalkaninfo.com${langPath}">`);
  }
  head.append(`\n<link rel="alternate" hreflang="x-default" href="https://kalkaninfo.com${cleanPath}">`);

  let missing = 0;
  $(`[data-${lang}]`).each((_, el) => {
    const $el = $(el);
    const val = $el.attr(`data-${lang}`);
    if (val != null && val !== '') $el.text(val);
  });
  $(`[data-${lang}-html]`).each((_, el) => {
    const $el = $(el);
    const val = $el.attr(`data-${lang}-html`);
    if (val != null && val !== '') $el.html(val);
  });
  for (const attr of ['title', 'alt', 'aria-label', 'placeholder', 'content']) {
    const dataKey = attr === 'aria-label' ? 'aria' : attr;
    $(`[data-${lang}-${dataKey}]`).each((_, el) => {
      const $el = $(el);
      const val = $el.attr(`data-${lang}-${dataKey}`);
      if (val != null && val !== '') $el.attr(attr, val);
    });
  }

  $('[data-tr], [data-en], [data-de], [data-ru], [data-fr]').each((_, el) => {
    if (!$(el).attr(`data-${lang}`) && !$(el).attr('data-tr')) missing++;
  });

  const titleEl = $('title').first();
  const titleData = titleEl.attr(`data-${lang}`);
  if (titleData) titleEl.text(titleData);
  else if (titleEl.text().length === 0) titleEl.text(TITLE_FALLBACK[lang]);

  $('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').each((_, el) => {
    const $el = $(el);
    const data = $el.attr(`data-${lang}`);
    if (data) $el.attr('content', data);
  });
  $('meta[property="og:title"], meta[name="twitter:title"]').each((_, el) => {
    const $el = $(el);
    const data = $el.attr(`data-${lang}`);
    if (data) $el.attr('content', data);
    else if (titleData) $el.attr('content', titleData);
  });
  $('meta[property="og:locale"]').attr('content', { en: 'en_US', de: 'de_DE', ru: 'ru_RU', fr: 'fr_FR' }[lang]);

  const outRel = `${lang}/${fileRel.replace(/\\/g, '/')}`;
  const outAbs = resolve(ROOT, outRel);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, $.html(), 'utf8');

  return { outRel, missing };
}

function regenSitemap(allFiles) {
  const urls = [];
  for (const fileRel of allFiles) {
    const fileDir = dirname(fileRel).replace(/\\/g, '/');
    const filename = basename(fileRel);
    const cleanPath = fileDir === '.' ? `/${filename}` : `/${fileDir}/${filename}`;
    for (const l of ['tr', ...LANGS]) {
      const langPath = l === 'tr' ? cleanPath : `/${l}${cleanPath}`;
      const alts = ['tr', ...LANGS].map(ll => {
        const llPath = ll === 'tr' ? cleanPath : `/${ll}${cleanPath}`;
        return `    <xhtml:link rel="alternate" hreflang="${ll}" href="https://kalkaninfo.com${llPath}"/>`;
      }).join('\n');
      urls.push(`  <url>
    <loc>https://kalkaninfo.com${langPath}</loc>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="https://kalkaninfo.com${cleanPath}"/>
    <changefreq>weekly</changefreq>
    <priority>${cleanPath === '/index.html' ? '1.0' : '0.7'}</priority>
  </url>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
  writeFileSync(resolve(ROOT, 'sitemap.xml'), xml, 'utf8');
  return urls.length;
}

async function main() {
  const t0 = Date.now();
  const files = collectHtml(ROOT);
  console.log(`📂 ${files.length} HTML kaynak bulundu`);

  const tasks = [];
  for (const fileRel of files) {
    for (const lang of LANGS) {
      tasks.push(transformOne(fileRel, lang));
    }
  }

  let totalMissing = 0;
  for (const t of tasks) totalMissing += t.missing;

  const sitemapCount = regenSitemap(files);

  const ms = Date.now() - t0;
  console.log(`✅ ${tasks.length} dosya üretildi (${LANGS.length} dil × ${files.length} sayfa)`);
  console.log(`🗺️  sitemap.xml: ${sitemapCount} URL`);
  console.log(`⚠️  Eksik çeviri attr toplam: ${totalMissing}`);
  console.log(`⏱️  ${ms}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
