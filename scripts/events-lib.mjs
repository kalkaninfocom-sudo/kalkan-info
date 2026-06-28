/**
 * events-lib.mjs — Kalkan etkinlik takvimi motoru
 *
 * recurring (haftalık tekrarlayan) + oneoff (tarihli) etkinlikleri
 * günlük/haftalık takvime açar, restoranlar.json'dan mekan bilgisiyle
 * (koordinat, foto, detay sayfası, kategori) zenginleştirir.
 *
 * Kullanım:
 *   import { eventsForDate, eventsForWeek } from './events-lib.mjs';
 *   const bugun = await eventsForDate('2026-06-28');
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function dayNameTR(iso) {
  return DAYS_TR[new Date(iso + 'T08:00:00').getDay()];
}

async function readJson(name, fallback = null) {
  try {
    return JSON.parse(await readFile(join(DATA, name), 'utf8'));
  } catch {
    return fallback;
  }
}

let _venueIndex = null;
async function venueIndex() {
  if (_venueIndex) return _venueIndex;
  const r = await readJson('restoranlar.json', { items: [] });
  const byId = new Map();
  const byName = new Map();
  for (const v of r.items || []) {
    if (v.id) byId.set(v.id, v);
    if (v.name) byName.set(v.name.toLowerCase().trim(), v);
  }
  _venueIndex = { byId, byName };
  return _venueIndex;
}

function normalizeDay(day) {
  if (typeof day === 'number') return DAYS_TR[day === 7 ? 0 : day];
  return String(day || '').trim();
}

function siteUrl(path) {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `https://kalkaninfo.com/${String(path).replace(/^\//, '')}`;
}

// Mekan bilgisiyle zenginleştir (koordinat / foto / detay / kategori)
async function enrich(ev) {
  const { byId, byName } = await venueIndex();
  const v = (ev.venueId && byId.get(ev.venueId)) ||
            (ev.venueName && byName.get(ev.venueName.toLowerCase().trim())) || null;
  const coordinates = v?.coordinates
    ? { lat: v.coordinates.latitude ?? v.coordinates.lat, lng: v.coordinates.longitude ?? v.coordinates.lng }
    : (ev.coordinates || null);
  const photo = v?.image || (v?.gallery && v.gallery[0]) || ev.photo || null;
  return {
    ...ev,
    day: normalizeDay(ev.day),
    venueName: ev.venueName || v?.name || '',
    venueCategory: v?.category || ev.venueCategory || '',
    coordinates,
    photo: siteUrl(photo),
    detailUrl: siteUrl(v?.detailPath) || v?.customSiteUrl || v?.website || null,
    phone: v?.phone || ev.phone || null,
    instagram: v?.instagram || ev.instagram || null,
  };
}

function byTime(a, b) {
  return String(a.time || '99:99').localeCompare(String(b.time || '99:99'));
}

/**
 * Belirli bir gün için etkinlikler (recurring + oneoff), saate göre sıralı.
 * @param {string} iso  YYYY-MM-DD
 * @param {object} opts { includeUnverified=true }
 */
export async function eventsForDate(iso, opts = {}) {
  const { includeUnverified = true } = opts;
  const tk = await readJson('etkinlik-takvimi.json', { recurring: [], oneoff: [] });
  const dn = dayNameTR(iso);

  const recurring = (tk.recurring || [])
    .filter(e => normalizeDay(e.day) === dn)
    .map(e => ({ ...e, recurring: true, date: iso }));
  const oneoff = (tk.oneoff || [])
    .filter(e => e.date === iso)
    .map(e => ({ ...e, recurring: false }));

  let all = [...oneoff, ...recurring];
  if (!includeUnverified) all = all.filter(e => e.verified);

  all = await Promise.all(all.map(enrich));
  return all.sort(byTime);
}

/**
 * 7 günlük takvim. start verilmezse iso'nun haftası (Pazartesi başlangıç).
 * @returns {Array<{date, day, events}>}
 */
export async function eventsForWeek(startIso, opts = {}) {
  const start = new Date(startIso + 'T08:00:00');
  // Haftanın Pazartesisine çek
  const dow = (start.getDay() + 6) % 7; // Pazartesi=0
  start.setDate(start.getDate() - dow);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    week.push({ date: iso, day: dayNameTR(iso), events: await eventsForDate(iso, opts) });
  }
  return week;
}

// CLI: node scripts/events-lib.mjs 2026-06-28
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('events-lib.mjs')) {
  const iso = process.argv[2] || new Date().toISOString().slice(0, 10);
  const evs = await eventsForDate(iso);
  console.log(`\n${dayNameTR(iso)} ${iso} — ${evs.length} etkinlik\n`);
  for (const e of evs) {
    console.log(`  ${e.time}  ${e.type.padEnd(12)} ${e.venueName} (${e.area})${e.verified ? '' : '  [taslak]'}`);
  }
}
