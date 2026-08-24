/**
 * lib/i18n-translate.mjs — MERKEZİ 5-DİL ÇEVİRİ MODÜLÜ
 * ------------------------------------------------------
 * "Her üretilen içerik 5 dilde" vizyonunun ortak çeviri katmanı.
 * Kaynak dil TR; hedefler EN/DE/RU/FR. Tüm üreticiler (gazete, reel, IG kartı,
 * marka hatları) bunu kullanır → tek yerde tutarlı çeviri + "uydurma yok" güvencesi.
 *
 * Kanıtlanmış kalıp: gazete-editorial-en.mjs'in "TRANSLATE ONLY, JSON yapısını koru"
 * sistem prompt'u dil-parametrik hale getirildi. Beyin: lib/cheap-llm.mjs (ücretsiz önce).
 *
 * Kullanım:
 *   import { translateFields, translateToAll, LANGS, checkGlossary } from './i18n-translate.mjs';
 *   const en = await translateFields({ baslik, deck, govde }, 'en');       // tek dil
 *   const all = await translateToAll({ baslik, deck }, { context:'gazete manşeti' }); // {en,de,ru,fr}
 *
 * G6 — NATIVE REWRITE + GLOSSARY LOCK (2026-08-24)
 *   - Loads data/i18n-glossary.json __keep.keep list; gracefully falls back to [] if missing.
 *   - systemFor() injects keep-list and per-language audience note for native-idiomatic output.
 *   - checkGlossary(source, translated, keepList) → QA signal; never throws, never hard-fails.
 *
 * DÜRÜSTLÜK: LLM'e "SADECE çevir; olgu/isim/rakam UYDURMA; JSON yapısını birebir koru".
 * Başarısızsa o dil için null döner (çağıran graceful atlar) — asla TR sızdırmaz sessizce.
 */
import { cheapLLM } from './cheap-llm.mjs';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// Kaynak TR; hedef diller. (Web/IG 5-dil: tr + bunlar.)
export const LANGS = ['en', 'de', 'ru', 'fr'];

export const LANG_NAMES = {
  en: 'English (British)',
  de: 'German',
  ru: 'Russian',
  fr: 'French',
};

/** Per-language audience note injected into the prompt for native rewriting. */
const AUDIENCE_NOTES = {
  en: 'Target audience: British and international visitors holidaying in Turkey. Use clear, warm British English. Avoid American spellings.',
  de: 'Target audience: German-speaking tourists visiting the Turkish Riviera. Use standard German (Hochdeutsch), friendly and informative register.',
  ru: 'Target audience: Russian-speaking tourists travelling to Turkey. Use modern standard Russian, warm and practical in tone.',
  fr: 'Target audience: French-speaking visitors exploring southern Turkey. Use standard French (not Canadian or Belgian variant), cultured and welcoming register.',
};

// Ücretsiz hakemler önce (CI'da ollama yok → groq/cerebras); claude son çare. Token tasarrufu.
const ORDER = (process.env.I18N_LLM_ORDER || 'groq,cerebras,nvidia,gemini,claude').split(',');

// ---------------------------------------------------------------------------
// G6: Glossary keep-list loader — graceful, no crash if file absent/malformed.
// ---------------------------------------------------------------------------
function loadKeepList() {
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const glossaryPath = join(__dir, '..', 'data', 'i18n-glossary.json');
    const raw = readFileSync(glossaryPath, 'utf8');
    const parsed = JSON.parse(raw);
    const keep = parsed?.__keep?.keep;
    if (Array.isArray(keep) && keep.length > 0) return keep;
    return [];
  } catch {
    // Missing file, parse error, or wrong structure → behave exactly as before.
    return [];
  }
}

// Loaded once at module init; consumers may also pass a custom keepList via opts.
const DEFAULT_KEEP_LIST = loadKeepList();

// ---------------------------------------------------------------------------
// G6: checkGlossary — QA signal, never hard-fails.
// ---------------------------------------------------------------------------
/**
 * Checks that every keep-term present in `source` also appears verbatim in
 * `translated`. Returns an array of terms that are missing or altered.
 * This is a QA signal only — callers should log/warn, not throw.
 *
 * @param {string} source     - Original source text (stringify if needed).
 * @param {string} translated - Translated text (stringify if needed).
 * @param {string[]} keepList - Terms that must be preserved verbatim.
 * @returns {string[]}        - Keep-terms found in source but absent in translation.
 */
export function checkGlossary(source, translated, keepList) {
  if (!Array.isArray(keepList) || keepList.length === 0) return [];
  const src = String(source || '');
  const trn = String(translated || '');
  return keepList.filter((term) => {
    // Only flag terms actually present in the source.
    if (!src.includes(term)) return false;
    // Flag if the same term is absent in the translation.
    return !trn.includes(term);
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  for (const c of [t, t.replace(/\\"/g, '"')]) {
    try { return JSON.parse(c); } catch {}
  }
  return null;
}

/**
 * G6: strengthened system prompt.
 * - Injects glossary keep-list as an explicit NEVER-TRANSLATE fence.
 * - Instructs NATURAL, idiomatic rewriting for the target audience (not word-for-word).
 * - Adds a per-language audience note.
 * - Remains backward-compatible: if keepList is empty the fence section is omitted.
 */
function systemFor(lang, context, keepList) {
  const name = LANG_NAMES[lang] || lang;
  const audienceNote = AUDIENCE_NOTES[lang] || '';
  const keepListActive = Array.isArray(keepList) && keepList.length > 0;
  const keepFence = keepListActive
    ? `GLOSSARY LOCK — NEVER translate, transliterate, or alter these exact terms; copy them verbatim into the output:\n${keepList.map((t) => `  • ${t}`).join('\n')}\n`
    : '';

  return (
    `You are the ${name} sub-editor of Kalkan İnfo, a media brand for the Kalkan/Kaş/Patara region (Antalya, Turkey), serving international visitors.\n` +
    (context ? `CONTEXT: ${context}\n` : '') +
    (audienceNote ? `AUDIENCE: ${audienceNote}\n` : '') +
    `TASK: Rewrite the given Turkish JSON fields in natural, native-quality ${name} — as a local sub-editor would write it, NOT as a word-for-word translator.\n` +
    `STYLE: Idiomatic, fluent, and engaging for the target audience. Vary sentence structure where it sounds more natural. Keep the same meaning, warmth, and brand voice (curious, honest, no hype).\n` +
    (keepFence ? `\n${keepFence}\n` : '') +
    `RULES:\n` +
    `1. FACTS LOCKED — never invent, add, embellish, or omit facts, names, dates, or numbers.\n` +
    `2. Keep a calm, honest, non-clickbait tone (brand voice: warm, curious, no hype/sales talk).\n` +
    `3. Keep proper nouns as in the source; do NOT localise Kalkan/Kaş/Patara/venue names.\n` +
    `4. NEVER translate BRAND NAMES — keep EXACTLY as-is: "Kalkan İnfo", "Kalkan Info", "Kalkan Today", "Kalkan Today Editor". Do NOT translate "Today" to your language.\n` +
    `5. Keep any HTML tags (<li>, <b>, <span>, etc.) EXACTLY as in the source — translate only the text between tags.\n` +
    `6. Preserve the JSON structure EXACTLY: same keys, arrays stay arrays with the same number of items.\n` +
    `OUTPUT: return ONLY the valid JSON object, nothing else.`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bir alan setini (obje) TEK hedef dile çevirir. JSON yapısı korunur.
 * @param {object} fields - çevrilecek TR alanlar (string / string[] / iç içe obje).
 * @param {('en'|'de'|'ru'|'fr')} lang - hedef dil.
 * @param {{context?:string, maxTokens?:number, verbose?:boolean, keepList?:string[]}} [opts]
 *   keepList: override the default glossary keep-list for this call (pass [] to disable).
 * @returns {Promise<object|null>} çevrilmiş obje (aynı anahtarlar) ya da başarısızsa null.
 */
export async function translateFields(fields, lang, opts = {}) {
  if (!fields || typeof fields !== 'object') return null;
  if (!LANGS.includes(lang)) throw new Error(`Desteklenmeyen hedef dil: ${lang}`);

  // G6: resolve keep-list — caller can override; fall back to module-level default.
  const keepList = Array.isArray(opts.keepList) ? opts.keepList : DEFAULT_KEEP_LIST;

  const prompt =
    `Rewrite the VALUES of this JSON into natural, native ${LANG_NAMES[lang]}. Keep keys and structure identical.\n\n` +
    `${JSON.stringify(fields, null, 2)}\n\n` +
    `Return ONLY the translated JSON object.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await cheapLLM(prompt, {
        system: systemFor(lang, opts.context, keepList), json: true,
        maxTokens: opts.maxTokens || 1500, temperature: 0.2,
        order: (Array.isArray(opts.order) && opts.order.length) ? opts.order : ORDER,
        timeoutMs: 60000, verbose: opts.verbose,
      });
      const parsed = parseJson(res.text);
      if (parsed && typeof parsed === 'object') {
        // G6: optional QA check — log violations but never fail.
        if (keepList.length > 0 && opts.verbose) {
          const srcStr = JSON.stringify(fields);
          const trnStr = JSON.stringify(parsed);
          const violations = checkGlossary(srcStr, trnStr, keepList);
          if (violations.length > 0) {
            console.warn(`   ⚠ [i18n glossary] ${lang} — keep-terms may be altered: ${violations.join(', ')}`);
          }
        }
        if (opts.verbose) console.log(`   ✓ ${lang} çevrildi (${res.provider})`);
        return parsed;
      }
    } catch (e) {
      if (opts.verbose) console.warn(`   ⚠ ${lang} deneme ${attempt}: ${e.message}`);
    }
  }
  return null;
}

/**
 * Bir alan setini TÜM hedef dillere (en/de/ru/fr) PARALEL çevirir.
 * @returns {Promise<{en:object|null, de:object|null, ru:object|null, fr:object|null}>}
 */
export async function translateToAll(fields, opts = {}) {
  const results = await Promise.all(LANGS.map((l) => translateFields(fields, l, opts).then((r) => [l, r])));
  return Object.fromEntries(results);
}

/**
 * Düz metni tek hedef dile çevirir (caption/kısa metin için kolaylık sarmalayıcı).
 * @returns {Promise<string|null>}
 */
export async function translateText(text, lang, opts = {}) {
  if (!text || !String(text).trim()) return null;
  const out = await translateFields({ t: String(text) }, lang, opts);
  return out?.t ?? null;
}
