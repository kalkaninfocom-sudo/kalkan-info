#!/usr/bin/env node
/**
 * scripts/agency/gazete-editorial-i18n.mjs — GAZETE EDİTÖRYAL 5 DİL
 * -----------------------------------------------------------------
 * TR editöryalini (data/gazete-today.json) DE/RU/FR/EN'e çevirir → data/gazete-today.<lang>.json
 * + data/gazete-archive/<date>.<lang>.json. gazete-editorial-en.mjs'in kanıtlanmış kalıbı
 * (idempotency + evergreen + şema koruma + "uydurma yok"), merkezi lib/i18n-translate.mjs
 * üzerinden TÜM dillere genelleştirildi.
 *
 * Kaynak dil TR; hedefler = lib/i18n-translate LANGS (en/de/ru/fr).
 * IDEMPOTENT: her dil için source_generated_at aynıysa atlar.
 * DÜRÜSTLÜK: sadece çeviri; olgu/isim/rakam uydurulmaz. LLM başarısız → o dil atlanır (exit 0).
 *
 * Kullanım:
 *   node scripts/agency/gazete-editorial-i18n.mjs [YYYY-MM-DD] [--force] [--lang=de]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { translateFields, LANGS } from '../../lib/i18n-translate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel; CI'da env dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const FORCE = process.argv.includes('--force');
const ONLY = (process.argv.find(a => a.startsWith('--lang=')) || '').split('=')[1];

// Dile-özel sabit UI etiketleri (kısa; çeviriye gönderilmez → tutarlı). services yolu locale'li.
const LABELS = {
  en: { editor: 'Kalkan Today Editor', bulletin: 'Bulletin', coast: 'Coast', photo: 'Photo', services: 'kalkaninfo.com/en/services' },
  de: { editor: 'Kalkan Today Redaktion', bulletin: 'Bulletin', coast: 'Küste', photo: 'Foto', services: 'kalkaninfo.com/de/services' },
  ru: { editor: 'Редакция Kalkan Today', bulletin: 'Бюллетень', coast: 'Побережье', photo: 'Фото', services: 'kalkaninfo.com/ru/services' },
  fr: { editor: 'Rédaction Kalkan Today', bulletin: 'Bulletin', coast: 'Côte', photo: 'Photo', services: 'kalkaninfo.com/fr/services' },
};

const lastSeg = (s) => String(s || '').split('·').pop()?.trim() || '';
const afterFirst = (s) => { const i = String(s || '').indexOf('·'); return i >= 0 ? String(s).slice(i + 1).trim() : ''; };
const arrOf = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string') : (v ? [String(v)] : []);
const pick = (v, fb) => (typeof v === 'string' && v.trim()) ? v : fb;

async function loadTR() {
  const todayPath = join(ROOT, 'data', 'gazete-today.json');
  const archPath = join(ROOT, 'data', 'gazete-archive', `${date}.json`);
  let tr = null;
  try { const t = JSON.parse(await readFile(todayPath, 'utf8')); tr = (t.date === date) ? t : null; } catch {}
  if (!tr && existsSync(archPath)) { try { tr = JSON.parse(await readFile(archPath, 'utf8')); } catch {} }
  return tr;
}

async function buildLang(tr, eg, lang) {
  const L = LABELS[lang];
  const outPath = join(ROOT, 'data', `gazete-today.${lang}.json`);

  // Idempotency
  if (!FORCE && existsSync(outPath)) {
    try {
      const prev = JSON.parse(await readFile(outPath, 'utf8'));
      if (prev.date === date && prev.source_generated_at === tr.generated_at && prev.lead_headline) {
        console.log(`  ℹ ${lang}: güncel (source aynı) — atlandı`);
        return;
      }
    } catch {}
  }

  // Çevrilecek metin bloğu — kategori dahil (LLM tutarlı çeviriyor); foto/url/isim korunur.
  const input = {
    lead_headline: tr.lead_headline || '',
    lead_deck: tr.lead_deck || '',
    lead_body: arrOf(tr.lead_body),
    col1_title: tr.col1_title || '', col1_body: tr.col1_body || '', col1_cat: lastSeg(tr.col1_byline),
    col3_title: tr.col3_title || '', col3_body: tr.col3_body || '', col3_cat: lastSeg(tr.col3_byline),
    magazine_lead_headline: tr.magazine_lead_headline || '',
    magazine_lead_body: arrOf(tr.magazine_lead_body),
    eg_antik_name: eg.antik?.name || '', eg_antik_tag: eg.antik?.tag || '', eg_antik_fact: eg.antik?.fact || '',
    eg_ad_name: eg.ad?.name || '', eg_ad_tagline: eg.ad?.tagline || '',
    lead_cat: (String(tr.lead_caption || '').replace(/^Foto:\s*/i, '').split('·')[1] || '').trim(),
  };

  const t = await translateFields(input, lang, { context: 'Günlük gazete editöryali (Kalkan Today)', maxTokens: 1500, verbose: true });
  if (!t || !t.lead_headline) { console.warn(`  ⚠ ${lang}: çeviri alınamadı — atlandı`); return; }

  const leadSource = afterFirst(tr.lead_byline) || 'Kalkan Today';
  const capSource = (String(tr.lead_caption || '').replace(/^Foto:\s*/i, '').split('·')[0] || leadSource).trim();

  const out = {
    date, lang,
    generated_at: new Date().toISOString(),
    source_generated_at: tr.generated_at || null,
    source_ids: tr.source_ids || [],
    lead_headline: pick(t.lead_headline, tr.lead_headline),
    lead_deck: pick(t.lead_deck, tr.lead_deck || ''),
    lead_body: arrOf(t.lead_body).length ? arrOf(t.lead_body) : arrOf(tr.lead_body),
    lead_byline: `${L.editor} · ${leadSource}`,
    ...(tr.lead_image ? { lead_image: tr.lead_image } : {}),
    lead_caption: `${L.photo}: ${capSource}${t.lead_cat ? ` · ${t.lead_cat}` : ''}`,
    col1_title: pick(t.col1_title, tr.col1_title || ''),
    col1_byline: `${L.bulletin}${t.col1_cat ? ` · ${t.col1_cat}` : ''}`,
    col1_body: pick(t.col1_body, tr.col1_body || ''),
    col3_title: pick(t.col3_title, tr.col3_title || ''),
    col3_byline: `${L.coast}${t.col3_cat ? ` · ${t.col3_cat}` : ''}`,
    col3_body: pick(t.col3_body, tr.col3_body || ''),
    magazine_lead_headline: pick(t.magazine_lead_headline, tr.magazine_lead_headline || ''),
    magazine_lead_body: arrOf(t.magazine_lead_body).length ? arrOf(t.magazine_lead_body) : arrOf(tr.magazine_lead_body),
    eg_antik_name: pick(t.eg_antik_name, eg.antik?.name || ''),
    eg_antik_tag: pick(t.eg_antik_tag, eg.antik?.tag || ''),
    eg_antik_fact: pick(t.eg_antik_fact, eg.antik?.fact || ''),
    eg_ad_name: pick(t.eg_ad_name, eg.ad?.name || ''),
    eg_ad_tagline: pick(t.eg_ad_tagline, eg.ad?.tagline || ''),
    eg_ad_cta: L.services,
  };

  await writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`  ✓ ${lang}: "${out.lead_headline}"`);
  try {
    const archDir = join(ROOT, 'data', 'gazete-archive');
    await mkdir(archDir, { recursive: true });
    await writeFile(join(archDir, `${date}.${lang}.json`), JSON.stringify(out, null, 2));
  } catch (e) { console.warn(`  ⚠ ${lang} arşiv yazılamadı (non-fatal):`, e.message); }
}

async function main() {
  console.log(`\n════ GAZETE EDİTÖRYAL 5 DİL — ${date} ════`);
  const tr = await loadTR();
  if (!tr || !tr.lead_headline) { console.warn('⚠ TR editöryal bulunamadı — çeviri atlandı.'); return; }

  const { getEvergreen } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'evergreen.mjs')).href);
  const eg = getEvergreen(date) || {};

  const targets = ONLY ? [ONLY] : LANGS;
  for (const lang of targets) {
    if (!LABELS[lang]) { console.warn(`  ⚠ ${lang}: desteklenmiyor, atlandı`); continue; }
    await buildLang(tr, eg, lang);
  }
  console.log('✓ 5-dil editöryal tamam.');
}

main().catch(e => { console.error('[gazete-editorial-i18n]', e); process.exit(0); }); // bozma: hata olsa da akış devam
