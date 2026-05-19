/**
 * translate-restoranlar-json.mjs
 * Adds 5-language translations (en/de/ru/fr) for:
 *   - data._meta.title, data._meta.subtitle
 *   - each item: name, summary, specialties (array)
 *
 * Source language: TR (existing fields). Target: name_en/de/ru/fr,
 * summary_en/de/ru/fr, specialties_en/de/ru/fr.
 *
 * Idempotent: skips fields already translated.
 *
 * Usage:
 *   node scripts/translate-restoranlar-json.mjs --yes
 *   node scripts/translate-restoranlar-json.mjs --dry-run
 *   node scripts/translate-restoranlar-json.mjs --lang de --yes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env.local
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '').replace(/\\n$/,'');
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_LANG = (() => { const i = process.argv.indexOf('--lang'); return i > -1 ? process.argv[i+1] : null; })();
const TARGET_LANGS = ['en', 'de', 'ru', 'fr'].filter(l => !ONLY_LANG || l === ONLY_LANG);
const BATCH_SIZE = 40;
const MODEL = 'claude-haiku-4-5-20251001';

const LANG_NAMES = {
  en: 'English',
  de: 'Almanca (German)',
  ru: 'Rusça (Russian)',
  fr: 'Fransızca (French)',
};

const JSON_FILE = path.join(ROOT, 'data', 'restoranlar.json');

async function translateBatch(strings, targetLang) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  if (strings.length === 0) return [];

  const numbered = strings.map((s, i) => `${i + 1}|${s}`).join('\n');
  const langName = LANG_NAMES[targetLang];

  const prompt = `Sen profesyonel bir ${langName} çevirmensin. Aşağıdaki Türkçe metinleri ${langName} diline çevir. Bu metinler Kalkan, Antalya bölgesindeki restoran, bar ve gece kulüplerine ait. Ton: doğal, kısa, profesyonel. Yer adları (Kalkan, Antalya, Türkiye), restoran isimleri (Aubergine, Korsan Kalamar, Mussakka vb.) ve marka adları AYNEN koru — sadece çevrilmesi gereken sıfat/açıklamaları çevir. Kısa etiketler (örn. "Cocktail", "Bar", "Pizza", "Sushi") zaten İngilizce ise olduğu gibi bırak. Restoran isimleri için: özel isim ise (Aubergine, Mey Terrace) aynen koru; jenerik "Restoran" gibi sözcükler hedef dile çevrilsin.

Cevap formatı: her satıra SADECE \`<index>|<çeviri>\` yaz. Açıklama, başlık veya boş satır EKLEME. Çeviri kısa kalsın.

Metinler:
${numbered}`;

  const body = {
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text || '';

  const translations = new Array(strings.length).fill(null);
  for (const line of text.split('\n')) {
    const m = line.match(/^(\d+)\|(.+)$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < strings.length) {
        translations[idx] = m[2].trim();
      }
    }
  }
  return translations;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Collect every translatable string with a path so we can write back later.
 * Returns array of {path: ['items', 3, 'name_en'], sourceTR: '...'}
 */
function collectJobs(data, targetLang) {
  const jobs = [];
  const sfx = `_${targetLang}`;

  // _meta.title / subtitle
  if (data._meta) {
    if (data._meta.title && !data._meta[`title${sfx}`]) {
      jobs.push({ path: ['_meta', `title${sfx}`], sourceTR: data._meta.title });
    }
    if (data._meta.subtitle && !data._meta[`subtitle${sfx}`]) {
      jobs.push({ path: ['_meta', `subtitle${sfx}`], sourceTR: data._meta.subtitle });
    }
  }

  // items[].name / summary / specialties[]
  (data.items || []).forEach((it, i) => {
    if (it.name && !it[`name${sfx}`]) {
      jobs.push({ path: ['items', i, `name${sfx}`], sourceTR: it.name });
    }
    if (it.summary && !it[`summary${sfx}`]) {
      jobs.push({ path: ['items', i, `summary${sfx}`], sourceTR: it.summary });
    }
    if (Array.isArray(it.specialties) && it.specialties.length && !it[`specialties${sfx}`]) {
      // Translate each specialty separately so array length matches.
      it.specialties.forEach((sp, j) => {
        jobs.push({ path: ['items', i, `specialties${sfx}`, j], sourceTR: sp });
      });
    }
  });

  return jobs;
}

function setPath(data, p, value) {
  let cur = data;
  for (let i = 0; i < p.length - 1; i++) {
    const k = p[i];
    if (typeof p[i+1] === 'number' && !Array.isArray(cur[k])) {
      // ensure parent array key exists when writing specialties_xx[j]
      if (cur[k] === undefined) cur[k] = [];
    }
    if (cur[k] === undefined) cur[k] = (typeof p[i+1] === 'number') ? [] : {};
    cur = cur[k];
  }
  cur[p[p.length - 1]] = value;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Kalkan Info — restoranlar.json i18n         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  if (!API_KEY && !DRY_RUN) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

  for (const lang of TARGET_LANGS) {
    const jobs = collectJobs(data, lang);
    console.log(`[${lang.toUpperCase()}] ${jobs.length} strings to translate`);
    if (jobs.length === 0) continue;
    if (DRY_RUN) continue;

    const sources = jobs.map(j => j.sourceTR);
    const all = [];
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(sources.length/BATCH_SIZE)}...`);
      const t = await translateBatch(batch, lang);
      all.push(...t);
      process.stdout.write(` done\n`);
      if (i + BATCH_SIZE < sources.length) await sleep(400);
    }

    let ok = 0, fail = 0;
    jobs.forEach((j, i) => {
      if (all[i]) { setPath(data, j.path, all[i]); ok++; }
      else { fail++; }
    });
    console.log(`  → wrote ${ok} fields${fail?`, ${fail} failed`:''}`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`\nSaved ${JSON_FILE}`);
  } else {
    console.log('\n(dry-run, file unchanged)');
  }
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
