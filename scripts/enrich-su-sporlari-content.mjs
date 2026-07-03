#!/usr/bin/env node
/**
 * enrich-su-sporlari-content.mjs
 *
 * data/su-sporlari.json icindeki 5 su sporlari isletmesi icin ICERIK uretir
 * ve 5 dile cevirir — ucretsiz cheap-llm router (Ollama/NVIDIA/Groq/Gemini)
 * kullanir, Claude token yakmaz.
 *
 * URETILEN ALANLAR (her isletmeye eklenir):
 *   tagline    + taglineI18n{tr,en,de,ru,fr}
 *   aboutP1    + aboutP1I18n{...}        (2 kisa paragraftan 1.si)
 *   aboutP2    + aboutP2I18n{...}        (2.si)
 *   summary    + summaryI18n{...}        (meta aciklama, 1-2 cumle)
 *   services[] + servicesI18n{tr:[...],en:[...],de,ru,fr}  (4-6 gercek hizmet)
 *
 * TR icerik isletmenin GERCEK type'ina (data'daki) gore uretilir — uydurma hizmet yok.
 * IDEMPOTENT: mevcut (dolu) alan/dil atlanir. --force ile ezilir.
 *
 * KULLANIM:
 *   node scripts/enrich-su-sporlari-content.mjs            # eksikleri doldur
 *   node scripts/enrich-su-sporlari-content.mjs --force    # hepsini yeniden uret
 *   node scripts/enrich-su-sporlari-content.mjs --dry-run
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

const { cheapLLM, cheapJSON, availableProviders } = await import('../lib/cheap-llm.mjs');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
// --only-lang <l> : sadece belirtilen dil(ler)i (yeniden) cevir (TR uretimini atla)
const onlyLangIdx = argv.indexOf('--only-lang');
const ONLY_LANGS = onlyLangIdx >= 0
  ? argv.slice(onlyLangIdx + 1).filter(a => !a.startsWith('--'))
  : null;
const LANGS = (ONLY_LANGS && ONLY_LANGS.length ? ONLY_LANGS : ['en', 'de', 'ru', 'fr']);
const LANG_NAME = { en: 'English', de: 'German (Deutsch)', ru: 'Russian (Русский)', fr: 'French (Français)' };

const FILE = path.join(ROOT, 'data', 'su-sporlari.json');

function ensureI18n(obj, field) {
  if (!obj[field] || typeof obj[field] !== 'object' || Array.isArray(obj[field])) obj[field] = {};
  return obj[field];
}

// ── TR icerik uretimi ──
async function generateTR(item) {
  const system = 'Sen Kalkan (Antalya, Turkiye) turizm sitesi icin profesyonel bir Turkce metin yazarisin. '
    + 'Olgusal, sade, abartisiz yaz. Emoji KULLANMA. Uydurma iddia/odul/rakam ekleme. '
    + 'Sadece isletmenin turune uygun gercek hizmetlerden bahset. SADECE gecerli JSON dondur.';
  const prompt = `Su Kalkan su sporlari isletmesi icin tanitim metni uret:
Isim: ${item.name}
Tur: ${item.type}
Konum: ${item.location}

Su JSON semasinda dondur (Turkce degerler):
{
  "tagline": "tek cumlelik carpici ama olgusal slogan (max 90 karakter)",
  "aboutP1": "Hakkimizda 1. paragraf — isletmeyi ve konumunu tanitan 2-3 cumle",
  "aboutP2": "Hakkimizda 2. paragraf — sundugu deneyim/hizmet yaklasimi, 2-3 cumle",
  "summary": "meta aciklama, arama sonuclari icin 1-2 cumle (max 155 karakter)",
  "services": ["4 ila 6 arasi, isletmenin turune uygun GERCEK hizmet (orn. jet ski, dalis kursu, tekne turu, parasailing, balik turu, ekipman kiralama) — kisa etiketler"]
}
Sadece JSON, aciklama yok, kod bloklari yok.`;
  const { data, provider } = await cheapJSON(prompt, { system, maxTokens: 900, temperature: 0.5, timeoutMs: 90000 });
  // Normalizasyon
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return {
    tagline: clean(data.tagline),
    aboutP1: clean(data.aboutP1),
    aboutP2: clean(data.aboutP2),
    summary: clean(data.summary),
    services: Array.isArray(data.services) ? data.services.map(clean).filter(Boolean).slice(0, 6) : [],
    provider,
  };
}

// ── Numarali-satir cevirici (translate-detail-i18n deseni) ──
const SCRIPT_RULE = {
  en: 'Write ONLY in English (Latin script).',
  de: 'Write ONLY in German (Latin script).',
  ru: 'Write ONLY in Russian using the Cyrillic script. Transliterate place names into Cyrillic (Kalkan → Калкан, Kaş → Каш, Antalya → Анталья). NEVER mix Latin letters into a Cyrillic word and NEVER use any other language (no Vietnamese, Chinese, etc.).',
  fr: 'Write ONLY in French (Latin script).',
};
function transSystem(lang) {
  return `You are a professional ${LANG_NAME[lang]} translator for a Kalkan (Antalya, Turkey) tourism website. `
    + `Translate each numbered Turkish line into natural ${LANG_NAME[lang]}. `
    + `${SCRIPT_RULE[lang]} `
    + `Rules: (1) Keep brand names (SEAPRO, Aristos, PRO FISHING TOURS, Kalamar) as-is. `
    + `(2) Keep it concise; do not merge or split lines. `
    + `(3) Translate EVERY line, including short headings. `
    + `(4) Output ONLY \`<index>|<translation>\` lines — no commentary, no code fences.`;
}
async function translateLines(strings, lang) {
  if (!strings.length) return [];
  const numbered = strings.map((s, i) => `${i + 1}|${String(s).replace(/\r?\n/g, ' ')}`).join('\n');
  const prompt = `Translate these ${strings.length} Turkish lines to ${LANG_NAME[lang]}.\n`
    + `Output EXACTLY one line per input as \`<index>|<translation>\` — same indexes, no extra lines, `
    + `no commentary, no code fences.\n\n${numbered}`;
  const maxTokens = Math.min(3200, 120 + strings.length * 60);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await cheapLLM(prompt, { system: transSystem(lang), maxTokens, temperature: 0.2, timeoutMs: 90000 });
      const out = new Array(strings.length).fill(null);
      for (const line of String(text).split('\n')) {
        const m = line.match(/^\s*(\d+)\s*\|(.*)$/);
        if (m) { const i = +m[1] - 1; if (i >= 0 && i < out.length && m[2].trim()) out[i] = m[2].trim(); }
      }
      if (out.some(x => x != null)) return out;
      lastErr = new Error('bos yanit');
    } catch (e) { lastErr = e; }
  }
  throw new Error(lastErr ? lastErr.message : 'ceviri yok');
}

const SCALARS = ['tagline', 'aboutP1', 'aboutP2', 'summary'];

async function enrichItem(item) {
  let changed = false;

  // 1) TR icerik — eksikse (veya --force) uret. --only-lang modunda TR uretimi atlanir.
  const needTR = !ONLY_LANGS && (FORCE || SCALARS.some(k => !item[k]) || !Array.isArray(item.services) || !item.services.length);
  if (needTR) {
    process.stdout.write(`  ${item.name}: TR uretiliyor...`);
    const tr = await generateTR(item);
    for (const k of SCALARS) if (tr[k]) item[k] = tr[k];
    if (tr.services.length) item.services = tr.services;
    process.stdout.write(` ok (${tr.provider})\n`);
    changed = true;
  } else {
    console.log(`  ${item.name}: TR mevcut, atlaniyor`);
  }

  // TR tabani I18n objelerine yerlestir
  for (const k of SCALARS) if (item[k]) ensureI18n(item, `${k}I18n`).tr = item[k];
  if (Array.isArray(item.services) && item.services.length) ensureI18n(item, 'servicesI18n').tr = item.services.slice();

  // 2) Ceviriler
  for (const lang of LANGS) {
    const scalarNeed = FORCE || SCALARS.some(k => item[k] && !item[`${k}I18n`]?.[lang]);
    const servNeed = item.services?.length && (FORCE || !item.servicesI18n?.[lang]);
    if (!scalarNeed && !servNeed) continue;

    process.stdout.write(`    [${lang}] ${item.id}`);
    // Tek call: [scalarlar..., services...]
    const keys = SCALARS.filter(k => item[k]);
    const strings = [...keys.map(k => item[k]), ...(servNeed ? item.services : [])];
    try {
      const tr = await translateLines(strings, lang);
      keys.forEach((k, i) => { ensureI18n(item, `${k}I18n`)[lang] = tr[i] || item[k]; });
      if (servNeed) {
        const arr = item.services.map((s, j) => tr[keys.length + j] || s);
        ensureI18n(item, 'servicesI18n')[lang] = arr;
      }
      changed = true;
      process.stdout.write(' ok\n');
    } catch (e) {
      process.stdout.write(` FAIL(${e.message.slice(0, 50)})\n`);
    }
  }
  return changed;
}

async function main() {
  console.log('cheap-llm saglayicilar:', availableProviders().join(', ') || '(yok)');
  const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let anyChanged = false;
  for (const item of (db.items || [])) {
    if (DRY) { console.log(`  (dry-run) ${item.name}`); continue; }
    if (await enrichItem(item)) {
      anyChanged = true;
      fs.writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n', 'utf8'); // her isletmeden sonra kaydet
      console.log('    -> kaydedildi');
    }
  }
  if (!DRY && anyChanged) console.log(`\nTamam: data/su-sporlari.json`);
  else if (!DRY) console.log('\nDegisiklik yok.');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
