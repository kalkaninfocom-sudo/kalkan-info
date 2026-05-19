/**
 * restructure-restoranlar-i18n.mjs
 * Convert flat suffix fields (name_en, summary_de, specialties_ru[]) into
 * nested xxxI18n dictionaries: { tr, en, de, ru, fr } to match render.js
 * t()/tArray() conventions used by villaCard.
 *
 * Idempotent — re-runs preserve the dicts.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'restoranlar.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const LANGS = ['en', 'de', 'ru', 'fr'];

// --- _meta.titleI18n / subtitleI18n ---
if (data._meta) {
  for (const base of ['title', 'subtitle']) {
    const tr = data._meta[base];
    if (!tr) continue;
    const dict = { tr };
    let any = false;
    LANGS.forEach(lng => {
      const v = data._meta[`${base}_${lng}`];
      if (v) { dict[lng] = v; any = true; }
    });
    if (any) {
      data._meta[`${base}I18n`] = dict;
      // remove flat suffix keys
      LANGS.forEach(lng => delete data._meta[`${base}_${lng}`]);
    }
  }
}

// --- items[].nameI18n / summaryI18n / specialtiesI18n ---
(data.items || []).forEach(it => {
  // name & summary (string fields)
  for (const base of ['name', 'summary']) {
    const tr = it[base];
    if (tr == null) continue;
    const dict = { tr };
    let any = false;
    LANGS.forEach(lng => {
      const v = it[`${base}_${lng}`];
      if (v) { dict[lng] = v; any = true; }
    });
    if (any) {
      it[`${base}I18n`] = dict;
      LANGS.forEach(lng => delete it[`${base}_${lng}`]);
    }
  }
  // specialties (array of strings)
  const sp = it.specialties;
  if (Array.isArray(sp) && sp.length) {
    const dict = { tr: sp.slice() };
    let any = false;
    LANGS.forEach(lng => {
      const arr = it[`specialties_${lng}`];
      if (Array.isArray(arr) && arr.length) {
        dict[lng] = arr.slice();
        any = true;
      }
    });
    if (any) {
      it.specialtiesI18n = dict;
      LANGS.forEach(lng => delete it[`specialties_${lng}`]);
    }
  }
});

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Restructured restoranlar.json — flat suffix keys → nested xxxI18n dicts');
console.log('items:', data.items.length);
console.log('sample _meta.subtitleI18n:', JSON.stringify(data._meta?.subtitleI18n || null, null, 2));
const a = data.items.find(x => x.id === 'aubergine');
console.log('sample aubergine.nameI18n:', JSON.stringify(a?.nameI18n));
console.log('sample aubergine.specialtiesI18n:', JSON.stringify(a?.specialtiesI18n));
