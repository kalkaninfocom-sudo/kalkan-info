#!/usr/bin/env node
/**
 * translate-villa-i18n.mjs
 *
 * Villa DETAY sayfalari icin ICERIK cevirisi (EN/DE/RU/FR).
 * villalar.json TR-only idi; build-villa-pages.mjs i18nAttrs() bekliyor ama alanlar bostu.
 * Bu script su i18n alanlarini uretir (sekil: { tr, en, de, ru, fr } | dizi icin {en:[],...}):
 *   - taglineI18n            (CUSTOM tagline — build-villa-pages.mjs)
 *   - aboutTitleI18n         (CUSTOM aboutTitle)
 *   - summaryI18n            (v.summary — meta)
 *   - descriptionLongI18n    ({en:[...],...} — about paragraflari)
 *   - kitchen_detail.titleI18n / introI18n
 *   - salon_detail.titleI18n / introI18n
 *   - garden_detail.titleI18n / introI18n
 *
 * Ceviri: cheap-llm router, order groq>cerebras>nvidia>gemini>claude (ollama ATLANDI — zayif TR).
 * IDEMPOTENT degil: --force olmadan da mevcut alanlari EZER (villa=3, kucuk).
 *
 * KULLANIM: node scripts/translate-villa-i18n.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── .env.local yukle (cheap-llm process.env okur) ──
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const { cheapLLM, availableProviders } = await import('../lib/cheap-llm.mjs');

const LANGS = ['en', 'de', 'ru', 'fr'];
const LANG_NAME = { en: 'English', de: 'German (Deutsch)', ru: 'Russian (Русский)', fr: 'French (Français)' };
const ORDER = ['groq', 'cerebras', 'nvidia', 'gemini', 'claude']; // ollama YOK (zayif TR)

// CUSTOM tagline/aboutTitle — build-villa-pages.mjs CUSTOM ile AYNI (DOM taban metni).
const CUSTOM = {
  'villa-poyraz': {
    tagline: 'Seyir Terası, Jakuzili Suite & Bilardo Masası',
    aboutTitle: 'Modern Lüks, İki Jakuzili Suite, Bilardo Akşamları.',
  },
  'villa-ship-ahoy': {
    tagline: "Kalamar'da Salıncaklı Bahçe & Üst Kat Jakuzi",
    aboutTitle: 'Denize 1 km, Salıncaklı Bahçe, Şömineli Salon.',
  },
  'villa-seascape': {
    tagline: 'Sonsuzluk Havuzu, Çocuk Havuzu & Denize 400 Metre',
    aboutTitle: 'Akdeniz Ufkuyla Birleşen Bir Silüet · Aile Dostu.',
  },
};

function transSystem(lang) {
  return `You are a professional ${LANG_NAME[lang]} translator for a Kalkan (Antalya, Turkey) luxury villa rental website. `
    + `Translate each numbered Turkish line into natural, upscale ${LANG_NAME[lang]}. `
    + `Rules: (1) Keep proper nouns and place names (Kalkan, Kalamar, Dalaman, Akdeniz->Mediterranean) natural. `
    + `(2) Keep it concise and premium in tone; do not merge or split lines. `
    + `(3) Translate EVERY line, including short headings. `
    + `(4) Output ONLY \`<index>|<translation>\` lines — no commentary, no code fences.`;
}

async function translateLines(strings, lang) {
  if (!strings.length) return [];
  const numbered = strings.map((s, i) => `${i + 1}|${String(s).replace(/\r?\n/g, ' ')}`).join('\n');
  const prompt = `Translate these ${strings.length} Turkish lines to ${LANG_NAME[lang]}.\n`
    + `Output EXACTLY one line per input as \`<index>|<translation>\` — same indexes, no extra lines, `
    + `no commentary, no code fences.\n\n${numbered}`;
  const maxTokens = Math.min(3600, 120 + strings.length * 70);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { text, provider } = await cheapLLM(prompt, { system: transSystem(lang), order: ORDER, maxTokens, temperature: 0.2, timeoutMs: 90000 });
      const out = new Array(strings.length).fill(null);
      for (const line of String(text).split('\n')) {
        const m = line.match(/^\s*(\d+)\s*\|(.*)$/);
        if (m) { const i = +m[1] - 1; if (i >= 0 && i < out.length && m[2].trim()) out[i] = m[2].trim(); }
      }
      if (out.every(x => x != null)) { if (attempt === 0) process.stdout.write(`[${provider}] `); return out; }
      lastErr = new Error(`eksik satir (${out.filter(x => x == null).length}/${strings.length})`);
    } catch (e) { lastErr = e; }
  }
  throw new Error(lastErr ? lastErr.message : 'ceviri yok');
}

const villaFile = path.join(ROOT, 'data', 'villalar.json');
const data = JSON.parse(fs.readFileSync(villaFile, 'utf8'));

console.log('Saglayicilar:', availableProviders().join(', '));

for (const v of data.items || []) {
  const c = CUSTOM[v.id] || {};
  console.log(`\n=== ${v.id} ===`);

  // Toplanan tum stringler tek batch/lang (verimli) — sabit sirali.
  const tagline = c.tagline || v.summary || '';
  const aboutTitle = c.aboutTitle || v.name || '';
  const summary = v.summary || '';
  const descLong = Array.isArray(v.description_long) ? v.description_long : [];
  const k = v.kitchen_detail || {};
  const s = v.salon_detail || {};
  const g = v.garden_detail || {};

  // Sabit indeksli birlesik dizi: [tagline, aboutTitle, summary, ...descLong, kTitle,kIntro, sTitle,sIntro, gTitle,gIntro]
  const fixed = [tagline, aboutTitle, summary];
  const dlStart = fixed.length;
  fixed.push(...descLong);
  const kTitleIdx = fixed.length; fixed.push(k.title || '', k.intro || '');
  const sTitleIdx = fixed.length; fixed.push(s.title || '', s.intro || '');
  const gTitleIdx = fixed.length; fixed.push(g.title || '', g.intro || '');

  for (const lang of LANGS) {
    const tr = await translateLines(fixed, lang);
    // tagline
    (v.taglineI18n ||= { tr: tagline }).tr = tagline; v.taglineI18n[lang] = tr[0];
    (v.aboutTitleI18n ||= { tr: aboutTitle }).tr = aboutTitle; v.aboutTitleI18n[lang] = tr[1];
    (v.summaryI18n ||= { tr: summary }).tr = summary; v.summaryI18n[lang] = tr[2];
    // description_long dizi
    v.descriptionLongI18n ||= {};
    v.descriptionLongI18n[lang] = descLong.map((_, i) => tr[dlStart + i]);
    // kitchen/salon/garden
    if (v.kitchen_detail) {
      (v.kitchen_detail.titleI18n ||= { tr: k.title || '' })[lang] = tr[kTitleIdx];
      (v.kitchen_detail.introI18n ||= { tr: k.intro || '' })[lang] = tr[kTitleIdx + 1];
    }
    if (v.salon_detail) {
      (v.salon_detail.titleI18n ||= { tr: s.title || '' })[lang] = tr[sTitleIdx];
      (v.salon_detail.introI18n ||= { tr: s.intro || '' })[lang] = tr[sTitleIdx + 1];
    }
    if (v.garden_detail) {
      (v.garden_detail.titleI18n ||= { tr: g.title || '' })[lang] = tr[gTitleIdx];
      (v.garden_detail.introI18n ||= { tr: g.intro || '' })[lang] = tr[gTitleIdx + 1];
    }
    console.log(`  ${lang}: ${fixed.length} satir OK`);
  }
}

fs.writeFileSync(villaFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('\n✓ villalar.json guncellendi.');
