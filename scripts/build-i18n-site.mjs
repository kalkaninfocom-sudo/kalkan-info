#!/usr/bin/env node
/**
 * scripts/build-i18n-site.mjs — STATİK 5-DİL SİTE BUILD MOTORU
 * ===========================================================
 * Her kaynak HTML sayfasını hedef diller (en/de/ru/fr) için build-zamanında
 * pre-render eder ve gerçek URL'lere yazar: /en/<yol>, /de/<yol> ...
 * TR kaynak kökte kalır (dokunulmaz).
 *
 * NEDEN: mevcut çeviri %100 istemci-taraflı (js/i18n.js) → arama motorları ve
 * LLM'ler için görünmez; detay sayfaları i18n.js'i hiç yüklemiyor → HİÇ çevrilmiyor.
 * Bu motor içeriği HTML'e bake eder (SEO/GEO görünür) ve tüm sayfaları kapsar.
 *
 * İKİ MODLU çeviri:
 *   1) Element'te data-{lang} varsa → onu kullan (mevcut/insan çevirisi kazanır).
 *   2) Yoksa görünür metni topla → lib/i18n-translate.mjs (ücretsiz LLM) ile çevir.
 * Global string cache (data/i18n-cache/strings.<lang>.json) → nav/footer gibi
 * tekrar eden metinler bir kez çevrilir (maliyet + tutarlılık).
 *
 * KULLANIM:
 *   node scripts/build-i18n-site.mjs --lang=en --only=restoranlar.html
 *   node scripts/build-i18n-site.mjs --lang=all --only=restoranlar.html,restoran/kaptan-restaurant/index.html
 *   node scripts/build-i18n-site.mjs --lang=all --pilot
 *   node scripts/build-i18n-site.mjs --lang=all --all          (tüm site)
 *   Bayraklar: --dry (çeviri yapma, sadece yapıyı işle), --limit=N, --verbose
 */
import { load } from 'cheerio';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateFields, LANGS } from '../lib/i18n-translate.mjs';
import { localizeHead } from './lib/head-localize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'i18n-cache');

// ---- argv ----
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const has = (n) => argv.includes(`--${n}`);
const VERBOSE = has('verbose');
const DRY = has('dry');
const LIMIT = parseInt(flag('limit', '0'), 10) || 0;

// Metin çevirisi ATLANACAK etiketler (içerikleri koru)
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'code', 'pre', 'svg', 'math']);
// data-{lang} attribute türleri (i18n.js ile birebir)
const LETTER = /[A-Za-zÇĞİÖŞÜçğıöşüÀ-ÿА-я]/;

// ---- elle doğrulanmış sözlük (glossary cache/LLM'den ÖNCE, otoriter) ----
let GLOSSARY = null;
async function loadGlossary() {
  if (GLOSSARY) return GLOSSARY;
  GLOSSARY = {};
  const f = path.join(ROOT, 'data', 'i18n-glossary.json');
  if (existsSync(f)) {
    try {
      const raw = JSON.parse(await readFile(f, 'utf8'));
      for (const [tr, langs] of Object.entries(raw)) { if (tr !== '_comment') GLOSSARY[tr] = langs; }
    } catch (e) { console.warn('glossary parse hatası:', e.message); }
  }
  return GLOSSARY;
}
function glossaryHit(s, lang) {
  const g = GLOSSARY && GLOSSARY[s];
  return g && g[lang] ? g[lang] : null;
}

// ---- string cache (dil başına) ----
const cacheMem = {}; // { en: Map, de: Map, ... }
async function loadCache(lang) {
  if (cacheMem[lang]) return cacheMem[lang];
  const f = path.join(CACHE_DIR, `strings.${lang}.json`);
  let obj = {};
  if (existsSync(f)) { try { obj = JSON.parse(await readFile(f, 'utf8')); } catch {} }
  cacheMem[lang] = new Map(Object.entries(obj));
  return cacheMem[lang];
}
async function saveCache(lang) {
  if (!cacheMem[lang]) return;
  await mkdir(CACHE_DIR, { recursive: true });
  const obj = Object.fromEntries([...cacheMem[lang].entries()]);
  await writeFile(path.join(CACHE_DIR, `strings.${lang}.json`), JSON.stringify(obj, null, 0), 'utf8');
}

// Eksik stringleri LLM ile çevir (chunklu), cache'e yaz
async function translateStrings(strings, lang) {
  await loadGlossary();
  const cache = await loadCache(lang);
  // glossary'de olanları LLM'e SORMA (otoriter + ücretsiz)
  const missing = strings.filter((s) => !glossaryHit(s, lang) && !cache.has(s));
  if (missing.length && !DRY) {
    // chunk: max ~25 string ve ~3500 karakter
    const chunks = []; let cur = [], curLen = 0;
    for (const s of missing) {
      if (cur.length >= 25 || curLen + s.length > 3500) { if (cur.length) chunks.push(cur); cur = []; curLen = 0; }
      cur.push(s); curLen += s.length;
    }
    if (cur.length) chunks.push(cur);
    if (VERBOSE) console.log(`   ${lang}: ${missing.length} yeni string, ${chunks.length} chunk`);
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      const fields = {}; ch.forEach((s, j) => { fields['s' + j] = s; });
      const out = await translateFields(fields, lang, { maxTokens: 4000, verbose: VERBOSE, context: 'kalkaninfo.com web sayfası içeriği' });
      ch.forEach((s, j) => {
        const t = out && out['s' + j];
        cache.set(s, (typeof t === 'string' && t.trim()) ? t : s); // başarısızsa kaynağı koru (TR sızmaz-görünür ama boş kalmaz)
      });
      if (VERBOSE) console.log(`   ${lang}: chunk ${i + 1}/${chunks.length} ✓`);
    }
    await saveCache(lang);
  }
  const map = new Map();
  for (const s of strings) map.set(s, glossaryHit(s, lang) ?? cache.get(s) ?? s);
  return map;
}

// ---- DOM yardımcıları ----
function hasLangData(el) {
  if (!el.attribs) return false;
  return Object.keys(el.attribs).some((k) => /^data-(en|de|ru|fr)(-|$)/.test(k));
}
function elClosestHasLangData($, node) {
  let p = node;
  while (p) { if (p.type === 'tag' && hasLangData(p)) return true; p = p.parent; }
  return false;
}

// Çevrilecek görünür metinleri + attr'ları topla
function collectStrings($) {
  const out = new Set();
  const push = (t) => { const s = (t || '').replace(/\s+/g, ' ').trim(); if (s.length > 1 && LETTER.test(s)) out.add(s); };

  // text node'lar (data-{lang} taşıyan element altları hariç → applyExisting halleder)
  const walk = (node) => {
    if (!node.children) return;
    for (const ch of node.children) {
      if (ch.type === 'text') { if (!elClosestHasLangData($, ch)) push(ch.data); }
      else if (ch.type === 'tag' && !SKIP_TAGS.has(ch.name)) walk(ch);
    }
  };
  const body = $('body')[0]; if (body) walk(body);

  // çevrilebilir attr'lar (ilgili data-* yoksa)
  $('[placeholder]').each((_, el) => { if (!el.attribs['data-en-placeholder']) push(el.attribs.placeholder); });
  $('[title]').each((_, el) => { if (!el.attribs['data-en-title'] && el.name !== 'link') push(el.attribs.title); });
  $('img[alt]').each((_, el) => { if (!el.attribs['data-en-alt']) push(el.attribs.alt); });
  $('[aria-label]').each((_, el) => { if (!el.attribs['data-en-aria']) push(el.attribs['aria-label']); });

  return [...out];
}

// data-{lang} attribute'larını uygula (i18n.js apply mantığı — build-zamanı)
function applyExisting($, lang) {
  const pick = (el, type) => {
    const key = (l) => `data-${l}${type ? '-' + type : ''}`;
    return el.attribs[key(lang)] || el.attribs[key('en')] || null; // hedef → en (fallback)
  };
  $('[data-en]').each((_, el) => { const v = pick(el, ''); if (v != null) $(el).text(v); });
  $('[data-en-html]').each((_, el) => { const v = pick(el, 'html'); if (v != null) $(el).html(v); });
  $('[data-en-placeholder]').each((_, el) => { const v = pick(el, 'placeholder'); if (v != null) el.attribs.placeholder = v; });
  $('[data-en-title]').each((_, el) => { const v = pick(el, 'title'); if (v != null) el.attribs.title = v; });
  $('[data-en-alt]').each((_, el) => { const v = pick(el, 'alt'); if (v != null) el.attribs.alt = v; });
  $('[data-en-aria]').each((_, el) => { const v = pick(el, 'aria'); if (v != null) el.attribs['aria-label'] = v; });
  $('[data-en-only]').each((_, el) => { if (lang !== 'en') $(el).remove(); });
}

// Toplanan metinleri çevirilerle değiştir
function applyTranslations($, map) {
  const tr = (t) => { const s = (t || '').replace(/\s+/g, ' ').trim(); return map.get(s); };
  const walk = (node) => {
    if (!node.children) return;
    for (const ch of node.children) {
      if (ch.type === 'text') {
        if (!elClosestHasLangData($, ch)) {
          const v = tr(ch.data);
          if (v != null && v !== ch.data.replace(/\s+/g, ' ').trim()) {
            // baştaki/sondaki boşlukları koru
            const lead = (ch.data.match(/^\s*/) || [''])[0];
            const trail = (ch.data.match(/\s*$/) || [''])[0];
            ch.data = lead + v + trail;
          }
        }
      } else if (ch.type === 'tag' && !SKIP_TAGS.has(ch.name)) walk(ch);
    }
  };
  const body = $('body')[0]; if (body) walk(body);

  $('[placeholder]').each((_, el) => { if (!el.attribs['data-en-placeholder']) { const v = tr(el.attribs.placeholder); if (v) el.attribs.placeholder = v; } });
  $('[title]').each((_, el) => { if (!el.attribs['data-en-title'] && el.name !== 'link') { const v = tr(el.attribs.title); if (v) el.attribs.title = v; } });
  $('img[alt]').each((_, el) => { if (!el.attribs['data-en-alt']) { const v = tr(el.attribs.alt); if (v) el.attribs.alt = v; } });
  $('[aria-label]').each((_, el) => { if (!el.attribs['data-en-aria']) { const v = tr(el.attribs['aria-label']); if (v) el.attribs['aria-label'] = v; } });
}

// Göreli asset yollarını mutlaklaştır (alt klasörde kırılmasın)
const ASSET_ATTR = [['link', 'href'], ['script', 'src'], ['img', 'src'], ['source', 'src'], ['video', 'poster'], ['use', 'href']];
function isRelativeAsset(v) {
  return v && !/^(https?:|\/\/|\/|#|data:|mailto:|tel:|javascript:)/i.test(v);
}
function absolutizeAssets($) {
  for (const [tag, attr] of ASSET_ATTR) {
    $(`${tag}[${attr}]`).each((_, el) => {
      const v = el.attribs[attr];
      if (isRelativeAsset(v)) el.attribs[attr] = '/' + v.replace(/^\.\//, '');
    });
  }
  // srcset
  $('img[srcset],source[srcset]').each((_, el) => {
    el.attribs.srcset = el.attribs.srcset.split(',').map((part) => {
      const [u, d] = part.trim().split(/\s+/);
      return (isRelativeAsset(u) ? '/' + u.replace(/^\.\//, '') : u) + (d ? ' ' + d : '');
    }).join(', ');
  });
}

// İç sayfa linklerini /{lang}/ prefix'e çevir
function rewriteLinks($, lang) {
  $('a[href]').each((_, el) => {
    let v = el.attribs.href;
    if (!v || /^(https?:|\/\/|#|data:|mailto:|tel:|javascript:)/i.test(v)) return;
    // asset linklerine dokunma (pdf/jpg/png vs)
    if (/\.(pdf|jpe?g|png|webp|gif|svg|mp4|zip|xml|txt|ico|json|css|js)$/i.test(v.split('?')[0])) {
      if (isRelativeAsset(v)) el.attribs.href = '/' + v.replace(/^\.\//, '');
      return;
    }
    // normalize → köke göre yol
    let p = v.replace(/^\.\//, '');
    if (!p.startsWith('/')) p = '/' + p;
    // zaten /en//de/ ise dokunma
    if (/^\/(en|de|ru|fr)\//.test(p)) return;
    el.attribs.href = `/${lang}${p}`;
  });
}

// Runtime dil zorlama + switcher navigasyon override (dinamik JS-render içerik için)
function injectLangRuntime($, lang, relPath) {
  const rel = relPath.replace(/\\/g, '/');
  const script =
    `\n<script>window.KALKAN_PAGE_LANG=${JSON.stringify(lang)};` +
    `window.setLang=function(l){var langs=['tr','en','de','ru','fr'];if(langs.indexOf(l)<0)return;` +
    `var base=${JSON.stringify('/' + rel)};location.href=(l==='tr'?base:'/'+l+base);};</script>`;
  $('body').append(script);
}

// ---- tek sayfa build ----
async function buildPage(relPath, lang) {
  const src = path.join(ROOT, relPath);
  const html = await readFile(src, 'utf8');
  const $ = load(html, { decodeEntities: false });

  const sourceTitle = $('title').first().text().trim();
  const sourceDesc = $('meta[name="description"]').attr('content') || '';
  const sourceKeywords = $('meta[name="keywords"]').attr('content') || '';

  // topla → çevir
  const strings = collectStrings($);
  for (const s of [sourceTitle, sourceDesc, sourceKeywords]) if (s && LETTER.test(s)) strings.push(s.replace(/\s+/g, ' ').trim());
  const map = await translateStrings([...new Set(strings)], lang);

  // uygula
  applyExisting($, lang);
  applyTranslations($, map);
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  localizeHead($, {
    lang, relPath,
    title: map.get(norm(sourceTitle)),
    description: map.get(norm(sourceDesc)),
    keywords: map.get(norm(sourceKeywords)),
  });
  absolutizeAssets($);
  rewriteLinks($, lang);
  injectLangRuntime($, lang, relPath);

  // yaz → /{lang}/<relPath>
  const outPath = path.join(ROOT, lang, relPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, $.html(), 'utf8');
  return outPath;
}

// ---- sayfa listesi ----
const PILOT = ['restoranlar.html', 'restoran/kaptan-restaurant/index.html', 'villa/villa-poyraz/index.html'];

async function resolvePages() {
  const only = flag('only');
  if (only) return only.split(',').map((s) => s.trim()).filter(Boolean);
  if (has('pilot')) return PILOT;
  if (has('all')) return await discoverAll();
  return PILOT;
}

// Tüm kaynak HTML'leri keşfet (kök *.html + detay dizinleri), çıktı/araç dizinlerini hariç tut
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'en', 'de', 'ru', 'fr', 'functions', 'remotion', 'newspaper', 'gazete', 'admin', 'scripts', 'api', 'supabase', 'mobile', 'investor-deck', '.omc', '.vercel', '.github', 'temporary screenshots', 'models', 'assets']);
const EXCLUDE_FILES = new Set(['admin.html', 'login.html', 'register.html', 'profil.html', 'office.html', 'agent-panel.html', '404.html']);
async function discoverAll() {
  const results = [];
  // kök *.html
  for (const f of await readdir(ROOT)) {
    if (f.endsWith('.html') && !EXCLUDE_FILES.has(f)) results.push(f);
  }
  // detay dizinleri: restoran otel plaj tur villa hizmet demo
  for (const dir of ['restoran', 'otel', 'plaj', 'tur', 'villa', 'hizmet', 'demo']) {
    const base = path.join(ROOT, dir);
    if (!existsSync(base)) continue;
    for (const sub of await readdir(base)) {
      const idx = path.join(base, sub, 'index.html');
      if (existsSync(idx)) results.push(`${dir}/${sub}/index.html`);
    }
  }
  return results;
}

// ---- main ----
(async () => {
  const langArg = flag('lang', 'all');
  const langs = langArg === 'all' ? LANGS : langArg.split(',').filter((l) => LANGS.includes(l));
  if (!langs.length) { console.error('Geçersiz --lang. Kullan: en/de/ru/fr/all'); process.exit(1); }

  let pages = await resolvePages();
  if (LIMIT) pages = pages.slice(0, LIMIT);

  console.log(`🌍 i18n build — ${pages.length} sayfa × ${langs.length} dil (${langs.join(',')})${DRY ? ' [DRY]' : ''}`);
  let ok = 0, fail = 0;
  for (const rel of pages) {
    for (const lang of langs) {
      try {
        const out = await buildPage(rel, lang);
        ok++;
        console.log(`  ✓ ${lang}/${rel} → ${path.relative(ROOT, out)}`);
      } catch (e) {
        fail++;
        console.error(`  ✗ ${lang}/${rel}: ${e.message}`);
      }
    }
  }
  console.log(`\nBitti: ${ok} ✓  ${fail} ✗`);
})();
