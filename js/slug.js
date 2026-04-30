/**
 * slug.js — Türkçe slug yardımcıları (ES module)
 * Public API:
 *   slugify(text)        — Türkçe karakterleri dönüştürür, boşluk→tire, max 80 char
 *   randomSuffix(len=4)  — rastgele alfanumerik suffix
 *   uniqueSlug(text)     — slugify(text) + '-' + randomSuffix()
 */

const TR_MAP = {
  ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ç: 'c', Ç: 'c',
  ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u',
};

/**
 * Türkçe metni URL-safe slug'a çevirir.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/**
 * Rastgele alfanumerik suffix üretir.
 * @param {number} len
 * @returns {string}
 */
export function randomSuffix(len = 4) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Benzersiz slug üretir (client-side, 4 char suffix ile).
 * @param {string} text
 * @returns {string}
 */
export function uniqueSlug(text) {
  const base = slugify(text);
  return base ? `${base}-${randomSuffix(4)}` : randomSuffix(8);
}
