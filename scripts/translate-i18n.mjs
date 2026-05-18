/**
 * translate-i18n.mjs
 * TR → DE + RU + FR batch translation for Kalkan Info HTML files.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/translate-i18n.mjs
 *   node scripts/translate-i18n.mjs --dry-run   (scan only, no API calls)
 *   node scripts/translate-i18n.mjs --lang de    (only German)
 *   node scripts/translate-i18n.mjs --file index.html  (single file)
 *
 * Idempotent: already-translated attributes are skipped.
 * Reads ANTHROPIC_API_KEY from environment or .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_LANG = (() => { const i = process.argv.indexOf('--lang'); return i > -1 ? process.argv[i+1] : null; })();
const ONLY_FILE = (() => { const i = process.argv.indexOf('--file'); return i > -1 ? process.argv[i+1] : null; })();

const TARGET_LANGS = ['de', 'ru', 'fr'].filter(l => !ONLY_LANG || l === ONLY_LANG);
const BATCH_SIZE = 50;
const MODEL = 'claude-haiku-4-5-20251001';

// Attribute type definitions
const ATTR_TYPES = [
  { enAttr: 'data-en',             trAttr: 'data-tr',             type: 'text'        },
  { enAttr: 'data-en-html',        trAttr: 'data-tr-html',        type: 'html'        },
  { enAttr: 'data-en-placeholder', trAttr: 'data-tr-placeholder', type: 'placeholder' },
  { enAttr: 'data-en-alt',         trAttr: 'data-tr-alt',         type: 'alt'         },
  { enAttr: 'data-en-aria',        trAttr: 'data-tr-aria',        type: 'aria'        },
  { enAttr: 'data-en-title',       trAttr: 'data-tr-title',       type: 'title'       },
];

// Lang → target dataset attribute base name
const LANG_ATTR = { de: 'data-de', ru: 'data-ru', fr: 'data-fr' };
const LANG_SUFFIX = { de: '-de', ru: '-ru', fr: '-fr' };

// Lang full names for prompt
const LANG_NAMES = { de: 'Almanca (German)', ru: 'Rusça (Russian)', fr: 'Fransızca (French)' };

// ── HTML Attribute Regex Utilities ───────────────────────────────────────────

/**
 * Extract all translatable strings from an HTML file.
 * Returns array of { attrType, enAttr, targetAttrBase, trValue, enValue, matchIndex, fullMatch }
 */
function extractStrings(html, targetLang) {
  const results = [];

  for (const def of ATTR_TYPES) {
    const { enAttr, trAttr, type } = def;
    // Match elements that have data-en (or variant) but NOT the target lang attr yet
    const targetAttr = enAttr.replace('data-en', LANG_ATTR[targetLang]).replace('data-en-', LANG_ATTR[targetLang] + '-');
    // Also handle html/placeholder/alt/aria/title variants
    const actualTargetAttr = enAttr === 'data-en'
      ? LANG_ATTR[targetLang]
      : enAttr.replace('data-en', LANG_ATTR[targetLang]);

    // Regex: find tags containing enAttr="..." but not actualTargetAttr
    // We use a broad tag-level regex then check per-tag
    const tagRe = /<[^>]+>/gs;
    let tagMatch;
    while ((tagMatch = tagRe.exec(html)) !== null) {
      const tag = tagMatch[0];
      const tagStart = tagMatch.index;

      // Must have the EN attribute
      const enRe = new RegExp(`${escapeRegex(enAttr)}="([^"]*)"`, 'i');
      const enM = enRe.exec(tag);
      if (!enM) continue;

      // Must NOT already have the target lang attribute
      const targetRe = new RegExp(`${escapeRegex(actualTargetAttr)}="`, 'i');
      if (targetRe.test(tag)) continue; // already translated

      const enValue = enM[1];

      // Get TR value (prefer data-tr attr if present, else we'll use EN as source)
      const trRe = new RegExp(`${escapeRegex(trAttr)}="([^"]*)"`, 'i');
      const trM = trRe.exec(tag);
      // Source for translation: prefer TR, fallback EN
      const sourceValue = (trM && trM[1].trim()) ? trM[1] : enValue;

      if (!sourceValue.trim()) continue;

      results.push({
        type,
        enAttr,
        actualTargetAttr,
        sourceValue,       // TR text (source for translation)
        enValue,
        tagStart,
        tagEnd: tagStart + tag.length,
        originalTag: tag,
      });
    }
  }

  return results;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Anthropic API ─────────────────────────────────────────────────────────────

async function translateBatch(strings, targetLang) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  if (strings.length === 0) return [];

  const numbered = strings.map((s, i) => `${i + 1}|${s.sourceValue}`).join('\n');
  const langName = LANG_NAMES[targetLang];

  const prompt = `Sen profesyonel bir ${langName} çevirmensin. Aşağıdaki Türkçe metinleri ${langName} diline çevir. Bu metinler Kalkan, Antalya bölgesindeki bir turizm sitesine ait. Ton: doğal, kısa, profesyonel. Yer adları (Kalkan, Antalya, Türkiye) AYNEN koru.

Cevap formatı: her satıra SADECE \`<index>|<çeviri>\` yaz. Açıklama, başlık veya boş satır EKLEME.

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

  // Parse response: lines like "1|translation"
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

// ── HTML Injection ────────────────────────────────────────────────────────────

/**
 * Given the original HTML and a list of {originalTag, actualTargetAttr, translation},
 * inject the new attributes into the HTML.
 * We process replacements in reverse order (by tagStart) to preserve indices.
 */
function injectTranslations(html, replacements) {
  // Sort by tagStart descending so we can splice without shifting indices
  const sorted = [...replacements].sort((a, b) => b.tagStart - a.tagStart);

  for (const { tagStart, tagEnd, originalTag, actualTargetAttr, translation } of sorted) {
    if (!translation) continue;
    // Inject attr before closing >
    const escaped = translation.replace(/"/g, '&quot;');
    const newTag = originalTag.replace(/>$/, ` ${actualTargetAttr}="${escaped}">`);
    html = html.slice(0, tagStart) + newTag + html.slice(tagEnd);
  }

  return html;
}

// ── Per-file processing ───────────────────────────────────────────────────────

async function processFile(filePath, targetLang) {
  const rel = path.relative(ROOT, filePath);
  let html = fs.readFileSync(filePath, 'utf8');

  const items = extractStrings(html, targetLang);
  if (items.length === 0) {
    console.log(`  [${targetLang.toUpperCase()}] ${rel}: already complete or no data-en attrs`);
    return { file: rel, lang: targetLang, translated: 0, skipped: 0 };
  }

  console.log(`  [${targetLang.toUpperCase()}] ${rel}: ${items.length} strings to translate`);

  if (DRY_RUN) {
    return { file: rel, lang: targetLang, translated: items.length, skipped: 0, dryRun: true };
  }

  // Batch translate
  const allTranslations = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    process.stdout.write(`    batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(items.length/BATCH_SIZE)}...`);
    const t = await translateBatch(batch, targetLang);
    allTranslations.push(...t);
    process.stdout.write(` done\n`);
    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < items.length) await sleep(500);
  }

  // Build replacement list
  const replacements = items.map((item, i) => ({
    ...item,
    translation: allTranslations[i],
  }));

  html = injectTranslations(html, replacements);
  fs.writeFileSync(filePath, html, 'utf8');

  const done = replacements.filter(r => r.translation).length;
  const failed = replacements.filter(r => !r.translation).length;
  console.log(`    → injected ${done} attrs${failed ? `, ${failed} failed` : ''}`);

  return { file: rel, lang: targetLang, translated: done, failed };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Kalkan Info — i18n Translation Script       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  if (!API_KEY && !DRY_RUN) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set.');
    console.error('');
    console.error('Options:');
    console.error('  1. Add to .env.local:  ANTHROPIC_API_KEY=sk-ant-...');
    console.error('  2. Set env variable:   ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-i18n.mjs');
    console.error('  3. Dry run (scan only): node scripts/translate-i18n.mjs --dry-run');
    process.exit(1);
  }

  if (DRY_RUN) console.log('MODE: DRY RUN (no API calls)\n');
  if (ONLY_LANG) console.log(`FILTER: only ${ONLY_LANG.toUpperCase()}\n`);
  if (ONLY_FILE) console.log(`FILTER: only ${ONLY_FILE}\n`);

  // Find HTML files
  let htmlFiles = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(ROOT, f));

  if (ONLY_FILE) {
    htmlFiles = htmlFiles.filter(f => path.basename(f) === ONLY_FILE || f === ONLY_FILE);
    if (htmlFiles.length === 0) {
      console.error(`File not found: ${ONLY_FILE}`);
      process.exit(1);
    }
  }

  console.log(`Files: ${htmlFiles.length} HTML files`);
  console.log(`Langs: ${TARGET_LANGS.join(', ').toUpperCase()}`);
  console.log(`Model: ${MODEL}`);
  console.log('');

  // Scan totals first
  let totalAttrs = 0;
  for (const f of htmlFiles) {
    for (const lang of TARGET_LANGS) {
      const html = fs.readFileSync(f, 'utf8');
      const items = extractStrings(html, lang);
      totalAttrs += items.length;
    }
  }

  const estimatedTokens = totalAttrs * 25; // ~25 tokens per string average
  const estimatedCostUSD = (estimatedTokens / 1_000_000) * 0.8; // Haiku input ~$0.80/M tokens (rough)
  console.log(`Total strings to translate: ~${totalAttrs}`);
  console.log(`Estimated API cost: ~$${estimatedCostUSD.toFixed(3)} USD`);
  console.log('');

  if (!DRY_RUN && !process.argv.includes('--yes')) {
    console.log('Run with --yes to proceed, or --dry-run to scan only.');
    console.log('Example: node scripts/translate-i18n.mjs --yes');
    process.exit(0);
  }

  // Process
  const stats = { de: { translated: 0, files: 0 }, ru: { translated: 0, files: 0 }, fr: { translated: 0, files: 0 } };

  for (const filePath of htmlFiles) {
    for (const lang of TARGET_LANGS) {
      const result = await processFile(filePath, lang);
      if (result.translated > 0) {
        stats[lang].translated += result.translated;
        stats[lang].files++;
      }
    }
  }

  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════');
  for (const lang of TARGET_LANGS) {
    console.log(`  ${lang.toUpperCase()}: ${stats[lang].translated} strings injected across ${stats[lang].files} files`);
  }
  console.log('');
  console.log('Done. Test at: http://localhost:3000');
  console.log('Switch language with buttons: EN | TR | DE | RU | FR');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
