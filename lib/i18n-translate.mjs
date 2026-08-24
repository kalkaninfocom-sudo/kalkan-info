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
 *   import { translateFields, translateToAll, LANGS } from './i18n-translate.mjs';
 *   const en = await translateFields({ baslik, deck, govde }, 'en');       // tek dil
 *   const all = await translateToAll({ baslik, deck }, { context:'gazete manşeti' }); // {en,de,ru,fr}
 *
 * DÜRÜSTLÜK: LLM'e "SADECE çevir; olgu/isim/rakam UYDURMA; JSON yapısını birebir koru".
 * Başarısızsa o dil için null döner (çağıran graceful atlar) — asla TR sızdırmaz sessizce.
 */
import { cheapLLM } from './cheap-llm.mjs';

// Kaynak TR; hedef diller. (Web/IG 5-dil: tr + bunlar.)
export const LANGS = ['en', 'de', 'ru', 'fr'];

export const LANG_NAMES = {
  en: 'English (British)',
  de: 'German',
  ru: 'Russian',
  fr: 'French',
};

// Ücretsiz hakemler önce (CI'da ollama yok → groq/cerebras); claude son çare. Token tasarrufu.
const ORDER = (process.env.I18N_LLM_ORDER || 'groq,cerebras,nvidia,gemini,claude').split(',');

function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  for (const c of [t, t.replace(/\\"/g, '"')]) {
    try { return JSON.parse(c); } catch {}
  }
  return null;
}

function systemFor(lang, context) {
  const name = LANG_NAMES[lang] || lang;
  return (
    `You are the ${name} sub-editor of Kalkan İnfo, a media brand for the Kalkan/Kaş/Patara region (Antalya, Turkey), serving international visitors.\n` +
    (context ? `CONTEXT: ${context}\n` : '') +
    `TASK: Translate the given Turkish JSON fields into natural, concise ${name}.\n` +
    `RULES:\n` +
    `1. TRANSLATE ONLY — never invent, add, embellish or omit facts, names, dates or numbers.\n` +
    `2. Keep a calm, honest, non-clickbait tone (brand voice: warm, curious, no hype/sales talk).\n` +
    `3. Keep proper nouns as in the source; do NOT localise Kalkan/Kaş/Patara/venue names.\n` +
    `4. NEVER translate BRAND NAMES — keep EXACTLY as-is: "Kalkan İnfo", "Kalkan Info", "Kalkan Today", "Kalkan Today Editor". Do NOT translate "Today" to your language.\n` +
    `5. Keep any HTML tags (<li>, <b>, <span>, etc.) EXACTLY as in the source — translate only the text between tags.\n` +
    `6. Preserve the JSON structure EXACTLY: same keys, arrays stay arrays with the same number of items.\n` +
    `OUTPUT: return ONLY the valid JSON object, nothing else.`
  );
}

/**
 * Bir alan setini (obje) TEK hedef dile çevirir. JSON yapısı korunur.
 * @param {object} fields - çevrilecek TR alanlar (string / string[] / iç içe obje).
 * @param {('en'|'de'|'ru'|'fr')} lang - hedef dil.
 * @param {{context?:string, maxTokens?:number, verbose?:boolean}} [opts]
 * @returns {Promise<object|null>} çevrilmiş obje (aynı anahtarlar) ya da başarısızsa null.
 */
export async function translateFields(fields, lang, opts = {}) {
  if (!fields || typeof fields !== 'object') return null;
  if (!LANGS.includes(lang)) throw new Error(`Desteklenmeyen hedef dil: ${lang}`);
  const prompt =
    `Translate the VALUES of this JSON into ${LANG_NAMES[lang]}. Keep keys and structure identical.\n\n` +
    `${JSON.stringify(fields, null, 2)}\n\n` +
    `Return ONLY the translated JSON object.`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await cheapLLM(prompt, {
        system: systemFor(lang, opts.context), json: true,
        maxTokens: opts.maxTokens || 1500, temperature: 0.2,
        order: (Array.isArray(opts.order) && opts.order.length) ? opts.order : ORDER, // eskalasyon: çağrı-bazlı sıra override
        timeoutMs: 60000, verbose: opts.verbose,
      });
      const parsed = parseJson(res.text);
      if (parsed && typeof parsed === 'object') {
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
