/**
 * lib/i18n-cache.mjs — KALICI içerik-hash'li çeviri cache'i (sağlamlık çekirdeği)
 * ------------------------------------------------------------------------------
 * Sorun: free-tier LLM her gün "hep ya da hiç" çöküyordu — bir alan çevrilmezse tüm dil TR
 * kalıyordu ve ertesi gün SIFIRDAN deneniyordu. Çözüm: her (dil, kaynak-metin) çifti bir kez
 * başarıyla çevrildiğinde DİSKE (git'e) yazılır ve BİR DAHA çevrilmez.
 *
 * Etki:
 *  - UI etiketleri / tekrarlayan ifadeler ömür boyu 1 kez çevrilir (her gün bedava cache-hit).
 *  - Her sayı yalnız YENİ haber metnini çevirir (~8-10 alan) → LLM yükü ~%80 düşer → rate-limit çökmesi biter.
 *  - Kısmi ilerleme BİRİKİR: bir run 3/20 çevirse, cache'lenen 3 kaybolmaz; sonraki run kalanı tamamlar.
 *
 * Depolama: data/i18n-cache/<lang>.json  →  { "<sha1(kaynak)>": { t:"çeviri", s:"kaynak ilk 80" } }
 * Git commit'ine eklenir (workflow) → CI run'ları arası kalıcı.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'data', 'i18n-cache');

const keyOf = (text) => createHash('sha256').update(String(text)).digest('hex');

/**
 * Bir dil için cache örneği aç. Dosya diskten yüklenir; get/set bellek üstünde, flush() diske yazar.
 * @param {string} lang  hedef dil (en/de/ru/fr)
 * @returns {{get:(s:string)=>string|null, set:(s:string,t:string)=>void, size:()=>number, hits:()=>number, misses:()=>number, flush:()=>void}}
 */
export function createCache(lang) {
  const file = join(CACHE_DIR, `${lang}.json`);
  let map = {};
  try { map = JSON.parse(readFileSync(file, 'utf8')) || {}; } catch { map = {}; }
  let dirty = false, hits = 0, misses = 0;

  return {
    get(source) {
      const s = String(source ?? '');
      if (!s.trim()) return null;
      const hit = map[keyOf(s)];
      if (hit && typeof hit.t === 'string' && hit.t.trim()) { hits++; return hit.t; }
      misses++; return null;
    },
    set(source, translation) {
      const s = String(source ?? ''), t = String(translation ?? '');
      if (!s.trim() || !t.trim()) return;
      map[keyOf(s)] = { t, s: s.slice(0, 80) };
      dirty = true;
    },
    size() { return Object.keys(map).length; },
    hits() { return hits; },
    misses() { return misses; },
    flush() {
      if (!dirty) return;
      try { mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
      writeFileSync(file, JSON.stringify(map, null, 0) + '\n', 'utf8');
      dirty = false;
    },
  };
}

export default { createCache };
