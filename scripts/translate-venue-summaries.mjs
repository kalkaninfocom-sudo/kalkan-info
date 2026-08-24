#!/usr/bin/env node
/**
 * translate-venue-summaries.mjs
 *
 * Fills in missing summaryI18n (en/de/ru/fr) for restoranlar.json and plajlar.json.
 * Items that already have all 4 non-empty translations are skipped (idempotent).
 * Persists after every item so partial CI runs accumulate safely.
 *
 * USAGE
 *   node scripts/translate-venue-summaries.mjs            # both datasets
 *   node scripts/translate-venue-summaries.mjs --dry      # preview counts only
 *   node scripts/translate-venue-summaries.mjs --only=restoranlar
 *   node scripts/translate-venue-summaries.mjs --only=plajlar
 *   node scripts/translate-venue-summaries.mjs --only=restoranlar --dry
 *
 * ENV (read via .env.local → process.env):
 *   I18N_LLM_ORDER   comma-sep provider list (default: groq,cerebras,nvidia,gemini,claude)
 *                    In CI set e.g. GEMINI_API_KEY + I18N_LLM_ORDER=gemini,groq
 *   GROQ_API_KEY / GEMINI_API_KEY / etc.  — standard cheap-llm keys
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Load .env.local (cheap-llm reads process.env) ──
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const { translateToAll } = await import('../lib/i18n-translate.mjs');

// ── CLI args ──
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const onlyArg = argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.replace('--only=', '') : null; // 'restoranlar' | 'plajlar' | null

const LANGS = ['en', 'de', 'ru', 'fr'];

/**
 * Returns true if the item is missing at least one of en/de/ru/fr in summaryI18n.
 */
function needsTranslation(item) {
  const s = item.summaryI18n;
  if (!s || typeof s !== 'object') return true;
  return LANGS.some(l => !s[l] || !String(s[l]).trim());
}

/**
 * Process one JSON data file.
 * @param {string} filePath  - absolute path to the JSON file
 * @param {string} label     - human label for logging
 */
async function processFile(filePath, label) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const items = data.items;

  if (!Array.isArray(items)) {
    console.error(`[${label}] No 'items' array found — skipping.`);
    return;
  }

  const toProcess = items.filter(needsTranslation);
  const total = items.length;
  const skipped = total - toProcess.length;

  console.log(`\n[${label}] total=${total}  already-complete=${skipped}  to-translate=${toProcess.length}`);

  if (DRY) {
    console.log(`[${label}] --dry: no changes written.`);
    // Show per-lang gaps
    const gaps = {};
    LANGS.forEach(l => { gaps[l] = items.filter(i => !i.summaryI18n?.[l]?.trim()).length; });
    console.log(`[${label}] per-lang gaps:`, gaps);
    return;
  }

  if (toProcess.length === 0) {
    console.log(`[${label}] Nothing to do.`);
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const item of toProcess) {
    // Only translate the TR summary field — keep the result compact for the LLM.
    const trSummary = (item.summary || '').trim();
    if (!trSummary) {
      console.warn(`  [${label}] ${item.id}: summary is empty — skipping (cannot translate blank).`);
      failed++;
      continue;
    }

    // Determine which langs are actually missing (gap-fill mode).
    const existing = item.summaryI18n && typeof item.summaryI18n === 'object' ? item.summaryI18n : {};
    const missingLangs = LANGS.filter(l => !existing[l] || !String(existing[l]).trim());

    // translateToAll translates all 4 langs in parallel; we only keep the missing ones.
    let translated;
    try {
      translated = await translateToAll(
        { summary: trSummary },
        {
          context: `Short venue description for ${label === 'restoranlar' ? 'a restaurant' : 'a beach'} in Kalkan, Turkey. 1–2 sentences. Keep it factual and engaging.`,
          verbose: false,
        }
      );
    } catch (err) {
      console.warn(`  [${label}] ${item.id}: translateToAll threw — ${err.message}. Leaving TR.`);
      failed++;
      continue;
    }

    // Merge only the missing langs; never overwrite already-translated ones.
    if (!item.summaryI18n || typeof item.summaryI18n !== 'object') {
      item.summaryI18n = { tr: trSummary };
    }
    // Ensure TR is always present
    if (!item.summaryI18n.tr) item.summaryI18n.tr = trSummary;

    let anyFilled = false;
    for (const l of missingLangs) {
      const val = translated[l]?.summary;
      if (val && String(val).trim()) {
        item.summaryI18n[l] = String(val).trim();
        anyFilled = true;
      } else {
        console.warn(`  [${label}] ${item.id}: ${l} translation empty — leaving gap.`);
      }
    }

    if (anyFilled) {
      ok++;
      console.log(`  ✓ [${label}] ${item.id} (${missingLangs.join('/')})`);
    } else {
      failed++;
      console.warn(`  ✗ [${label}] ${item.id}: no langs filled.`);
    }

    // Persist after every item so partial runs accumulate.
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  console.log(`\n[${label}] Done. ok=${ok}  failed/skipped=${failed}`);
}

// ── Main ──
const DATASETS = [
  { file: path.join(ROOT, 'data', 'restoranlar.json'), label: 'restoranlar' },
  { file: path.join(ROOT, 'data', 'plajlar.json'),     label: 'plajlar'     },
];

for (const { file, label } of DATASETS) {
  if (ONLY && ONLY !== label) continue;
  await processFile(file, label);
}

console.log('\nAll done.');
