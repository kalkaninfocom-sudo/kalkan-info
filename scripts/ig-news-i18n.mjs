#!/usr/bin/env node
/**
 * scripts/ig-news-i18n.mjs — IG HABER KARTI + CAPTION 5 DİL (P3)
 * ------------------------------------------------------------
 * "Her üretilen içerik 5 dilde" vizyonunun IG-haber katmanı.
 * TR haber öğesinden (data/haberler.json item) EN/DE/RU/FR için:
 *   1) kart metinlerini (başlık + kategori) çevirir → her dile ayrı JPEG kart render eder
 *   2) caption gövdesini çevirir → AI şeffaflık ibaresi (dile çevrili) + hashtag ekler
 *
 * Kanıtlanmış kalıp: gazete-editorial-i18n.mjs (orchestrator) + build.mjs translateWebData
 * (alan-alan PARALEL çeviri; küçük tek-alan JSON güvenilir). Beyin: lib/i18n-translate.mjs
 * (ücretsiz LLM önce; başarısız → o dil graceful atlanır, TR akışı ETKİLENMEZ).
 *
 * IG SADECE JPEG kabul eder (PNG → 9004) → generateNewsCard zaten JPEG üretir; dil eki
 * <id>.<lang>.jpg olarak kaydedilir.
 *
 * Reklam uyumu: her dildeki caption'a AI ibaresi (madde 1) eklenir (lib/reklam-uyum.mjs
 * TR/EN hazır; DE/RU/FR ibaresi çeviriyle üretilir).
 *
 * Kullanım (standalone test):
 *   node scripts/ig-news-i18n.mjs <haber-id> [--lang=de] [--only-captions]
 *   node scripts/ig-news-i18n.mjs            # en yeni haber, tüm diller
 *
 * Export:
 *   translateNewsItem(item, opts) → { captions:{tr,en,de,ru,fr}, cardText:{...perLang} }
 *   generateNewsCardsAllLangs({ item, cardText, outDir?, browser? }) → { tr, en, de, ru, fr } (path/publicPath)
 */
import puppeteer from 'puppeteer';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateNewsCard } from './ig-news-card.mjs';
import { translateFields, translateText, LANGS } from '../lib/i18n-translate.mjs';
import { withAiDisclosure, AI_IBARESI_TR, AI_IBARESI_EN } from '../lib/reklam-uyum.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env.local yükle (yerel; CI'da env dolu). I18N_LLM_ORDER burada da geçerli.
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

// Kaynak TR + hedef diller (kart/caption 5 dil).
export const ALL_LANGS = ['tr', ...LANGS]; // tr, en, de, ru, fr

// AI şeffaflık ibaresi (madde 1). TR/EN sabit; DE/RU/FR ilk kullanımda çevrilir (cache).
const AI_DISCLOSURE = { tr: AI_IBARESI_TR, en: AI_IBARESI_EN };
async function aiDisclosureFor(lang) {
  if (AI_DISCLOSURE[lang]) return AI_DISCLOSURE[lang];
  // TR ibaresini hedef dile çevir (emoji korunur; başarısız → EN'e düş).
  const t = await translateText(AI_IBARESI_TR, lang, { context: 'AI şeffaflık ibaresi (kısa yasal not)', maxTokens: 120 });
  const val = (t && t.trim()) ? t.trim() : AI_IBARESI_EN;
  AI_DISCLOSURE[lang] = val;
  return val;
}

// ── Kategori çevirileri (sabit sözlük → tutarlı rozet; LLM'e gönderilmez) ─────
// Kartta kategori rozeti kısa ve tutarlı olmalı; serbest çeviri dalgalanır.
const CATEGORY_I18N = {
  'Asayiş':   { en: 'Public Safety', de: 'Sicherheit',  ru: 'Происшествия', fr: 'Sécurité' },
  'Belediye': { en: 'Municipality',  de: 'Gemeinde',    ru: 'Муниципалитет', fr: 'Municipalité' },
  'Gündem':   { en: 'News',          de: 'Aktuelles',   ru: 'Новости',      fr: 'Actualité' },
  'Plaj':     { en: 'Beach',         de: 'Strand',      ru: 'Пляж',         fr: 'Plage' },
  'Hava':     { en: 'Weather',       de: 'Wetter',      ru: 'Погода',       fr: 'Météo' },
  'Kültür':   { en: 'Culture',       de: 'Kultur',      ru: 'Культура',     fr: 'Culture' },
  'Etkinlik': { en: 'Event',         de: 'Event',       ru: 'Событие',      fr: 'Événement' },
  'Turizm':   { en: 'Tourism',       de: 'Tourismus',   ru: 'Туризм',       fr: 'Tourisme' },
};
function categoryFor(catTR, lang) {
  if (lang === 'tr') return catTR;
  return CATEGORY_I18N[catTR]?.[lang] || catTR;
}

/**
 * Bir haber öğesinin KART METİNLERİNİ (başlık) ve CAPTION gövdesini 5 dile çevirir.
 * Alan-alan PARALEL çeviri (gazete deseni). TR her zaman kaynak olarak döner.
 *
 * @param {object} item - haberler.json öğesi ({ title, category, summary, source, ... }).
 * @param {{captionBodyTR?:string, verbose?:boolean}} [opts] captionBodyTR verilmezse title+summary'den kurulur.
 * @returns {Promise<{ cardText:Record<string,{title,category}>, captions:Record<string,string> }>}
 */
export async function translateNewsItem(item, opts = {}) {
  if (!item || !item.title) throw new Error('translateNewsItem: geçerli haber item gerekli');
  const verbose = opts.verbose;
  const titleTR = String(item.title).trim();
  const catTR = item.category || 'Gündem';
  const captionBodyTR = (opts.captionBodyTR || item.summary || item.title || '').trim();

  // ── TR temel değerler ──
  const cardText = { tr: { title: titleTR, category: catTR } };
  const captions = { tr: captionBodyTR };

  // ── Hedef diller: kart başlığı + caption gövdesi TEK JSON'da (küçük, tek-alan → güvenilir),
  //    diller PARALEL. Kategori sözlükten (LLM'e gönderilmez). ──
  const perLang = await Promise.all(LANGS.map(async (lang) => {
    const t = await translateFields(
      { title: titleTR, caption: captionBodyTR },
      lang,
      { context: 'Yerel haber kartı başlığı ve Instagram caption özeti (Kalkan/Kaş bölgesi)', maxTokens: 700, verbose }
    );
    return [lang, t];
  }));

  for (const [lang, t] of perLang) {
    if (t && t.title) {
      cardText[lang] = { title: String(t.title).trim(), category: categoryFor(catTR, lang) };
      captions[lang] = String(t.caption || captionBodyTR).trim();
    } else {
      if (verbose) console.warn(`  ⚠ ${lang}: çeviri alınamadı — bu dil atlanıyor (TR akışı etkilenmez)`);
      // dili atla: cardText/captions'a EKLEME → çağıran sadece başarılı dilleri işler.
    }
  }
  return { cardText, captions };
}

/**
 * Bir caption gövdesini yayına hazır hale getirir: AI ibaresi (dile çevrili) + hashtag'ler.
 * @returns {Promise<string>}
 */
export async function finalizeCaption(bodyText, { lang, source, hashtags = [] } = {}) {
  const src = source || 'Kalkan Info';
  const srcLabel = lang === 'tr' ? 'Kaynak' : (lang === 'de' ? 'Quelle' : (lang === 'fr' ? 'Source' : (lang === 'ru' ? 'Источник' : 'Source')));
  let body = String(bodyText || '').trim();
  if (!new RegExp(`${srcLabel}\\s*:`, 'i').test(body)) body += `\n\n${srcLabel}: ${src}`;

  // AI şeffaflık ibaresi (madde 1) — dile göre.
  const disclosure = await aiDisclosureFor(lang);
  // reklam-uyum withAiDisclosure yalnız tr/en ibaresi bilir; DE/RU/FR için ibareyi elle
  // ekliyoruz (aynı davranış: yoksa ekle). Hashtag'lere #yapayzeka her dilde eklenir.
  const alreadyHasAI = /yapay\s*zek|#yapayzeka|\bA\.?I\.?\b|\bИИ\b|künstliche intelligenz|intelligence artificielle|искусственн/i.test(body);
  if (!alreadyHasAI) body = body.replace(/\s+$/, '') + '\n\n' + disclosure;

  const tags = [...new Set([...(hashtags || []), '#yapayzeka'])];
  return `${body}\n\n${tags.join(' ')}`.trim();
}

/**
 * TR + çevrilmiş kart metinleriyle her dil için bir JPEG kart render eder.
 * Görsel/tarih/kaynak korunur; sadece başlık + kategori rozeti dile göre değişir.
 *
 * @param {{item:object, cardText:Record<string,{title,category}>, outDir?:string, browser?}} args
 * @returns {Promise<Record<string,{outPath,publicPath,kb,hadImage,lang}>>}
 */
export async function generateNewsCardsAllLangs({ item, cardText, outDir, browser: shared } = {}) {
  const langs = Object.keys(cardText);
  const browser = shared || await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-web-security'],
  });
  const out = {};
  try {
    for (const lang of langs) {
      const ct = cardText[lang];
      if (!ct || !ct.title) continue;
      // Dil eki: tr → <id>.jpg (mevcut davranışı bozma); diğerleri → <id>.<lang>.jpg
      const langItem = {
        ...item,
        id: lang === 'tr' ? item.id : `${item.id}.${lang}`,
        title: ct.title,
        category: ct.category,
      };
      // lang → tarih/etiket lokalize; catColorKey → rozet rengi TR kategoriden çözülür.
      const r = await generateNewsCard({ item: langItem, outDir, browser, lang, catColorKey: item.category || 'Gündem' });
      out[lang] = { ...r, lang };
    }
  } finally {
    if (!shared) await browser.close();
  }
  return out;
}

// ── Standalone test ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const onlyLang = (args.find(a => a.startsWith('--lang=')) || '').split('=')[1] || null;
  const onlyCaptions = args.includes('--only-captions');
  const idArg = args.find(a => !a.startsWith('--'));

  const data = JSON.parse(await readFile(join(ROOT, 'data', 'haberler.json'), 'utf8'));
  const items = data.items || [];
  if (!items.length) { console.error('haberler.json boş'); process.exit(1); }
  const item = idArg ? items.find(x => x.id === idArg) : items[0];
  if (!item) { console.error(`Haber bulunamadı: ${idArg}`); process.exit(1); }

  console.log(`\n════ IG HABER 5 DİL — ${item.id} ════`);
  console.log(`TR başlık: ${item.title}`);
  console.log(`Kategori: ${item.category} | Kaynak: ${item.source}\n`);

  console.log('🌐 Çeviri (alan-alan paralel)...');
  const { cardText, captions } = await translateNewsItem(item, { verbose: true });

  const langsDone = Object.keys(cardText);
  const targets = onlyLang ? langsDone.filter(l => l === onlyLang) : langsDone;

  console.log('\n── CAPTION\'LAR ──');
  for (const lang of targets) {
    const full = await finalizeCaption(captions[lang], { lang, source: item.source });
    console.log(`\n[${lang.toUpperCase()}] başlık: ${cardText[lang].title}`);
    console.log(`[${lang.toUpperCase()}] kategori rozeti: ${cardText[lang].category}`);
    console.log(`[${lang.toUpperCase()}] caption:\n   ` + full.split('\n').join('\n   '));
  }

  if (!onlyCaptions) {
    console.log('\n🎨 Kart render (her dil ayrı JPEG)...');
    const filtered = onlyLang
      ? Object.fromEntries(Object.entries(cardText).filter(([l]) => l === onlyLang))
      : cardText;
    const cards = await generateNewsCardsAllLangs({ item, cardText: filtered });
    for (const [lang, c] of Object.entries(cards)) {
      console.log(`  ✓ ${lang}: ${c.publicPath} (${c.kb} KB, görsel ${c.hadImage ? 'gömüldü' : 'fallback'})`);
    }
  }

  console.log(`\n✅ ${targets.length} dil işlendi: ${targets.join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href || process.argv[1]?.endsWith('ig-news-i18n.mjs')) {
  main().catch(e => { console.error('fatal:', e); process.exit(1); });
}
