#!/usr/bin/env node
/**
 * seed-stays.mjs
 *
 * Seeds the `stays` table from data/villalar.json + data/oteller.json.
 * Idempotent: upserts on `slug` column.
 *
 * Usage:
 *   node scripts/seed-stays.mjs --dry        # print rows, no write
 *   node scripts/seed-stays.mjs              # upsert (requires env vars)
 *
 * Env (any of .env, .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (or SUPABASE_SERVICE_KEY)
 *   STAYS_SEED_OWNER_ID         required UUID of the platform host user in auth.users
 *
 * Field mapping decisions (see bottom of file for summary):
 *   villalar → listing_type 'villa'
 *   oteller (whole hotel entity) → listing_type 'whole_building'
 *     Each otel also expands its roomTypes[] → listing_type 'room' rows
 *   price_per_night: no numeric price in source data (only priceRange like "$$")
 *     → left null (logged); must be filled later via admin panel or host login.
 *   capacity: villa uses numeric "8 kişi" string; hotel room uses roomType.sleeps.
 *   amenities: Turkish labels mapped to canonical English keys matching schema comment.
 *   images: gallery[] array from source (local asset paths, publicly served by Vercel).
 *   slug: kebab-case from item.id (already present in source, e.g. "villa-poyraz").
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');

const DRY = process.argv.includes('--dry');

// ── Minimal .env loader (mirrors seed-30day-social.mjs pattern) ──────────────
function loadDotenv(file) {
  if (!existsSync(file)) return;
  const raw = readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadDotenv(resolve(ROOT, '.env'));
loadDotenv(resolve(ROOT, '.env.local'));

// ── Env resolution ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OWNER_ID     = process.env.STAYS_SEED_OWNER_ID;

if (!DRY && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    '[seed-stays] ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    '  Add them to .env.local, or run with --dry to preview rows.'
  );
  process.exit(1);
}

if (!DRY && !OWNER_ID) {
  console.error(
    '[seed-stays] ERROR: STAYS_SEED_OWNER_ID is not set.\n' +
    '  Create a platform host user in Supabase Auth, then:\n' +
    '    STAYS_SEED_OWNER_ID=<uuid> node scripts/seed-stays.mjs\n' +
    '  or add it to .env.local.'
  );
  process.exit(1);
}

// ── Slug helper ───────────────────────────────────────────────────────────────
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Amenity normaliser ────────────────────────────────────────────────────────
// Maps Turkish source labels to canonical English keys used in stays schema comment.
// New labels are passed through as-is (lowercased, spaces→hyphens) with a log.
const AMENITY_MAP = {
  // Turkish → canonical
  'wifi': 'wifi',
  'klima': 'ac',
  'klima (ac)': 'ac',
  'havuz': 'pool',
  'özel havuz': 'pool',
  'yüzme havuzu': 'pool',
  'ısıtmalı havuz': 'pool',
  'deniz manzarası': 'seaview',
  'deniz manzaralı': 'seaview',
  'mutfak': 'kitchen',
  'tam donanımlı mutfak': 'kitchen',
  'amerikan mutfak': 'kitchen',
  'otopark': 'parking',
  'çamaşır makinesi': 'washer',
  'ısıtma': 'heating',
  'jakuzi': 'jacuzzi',
  'jakuzili oda': 'jacuzzi',
  'barbekü': 'bbq',
  'limana yakın': 'near-harbour',
  'teras': 'terrace',
  'çatı teras': 'terrace',
  'restoran': 'restaurant',
  'bar': 'bar',
  'kahvaltı dahil': 'breakfast-included',
  'aile dostu': 'family-friendly',
  'pet-friendly': 'pet-friendly',
  'plaj transferi': 'beach-transfer',
  'concierge': 'concierge',
  'smart tv': 'smart-tv',
  'tv': 'tv',
  'bilardo masası': 'billiards',
};

function normaliseAmenities(rawList) {
  if (!Array.isArray(rawList)) return [];
  const result = new Set();
  for (const raw of rawList) {
    const key = raw.toLowerCase().trim();
    if (AMENITY_MAP[key]) {
      result.add(AMENITY_MAP[key]);
    } else {
      // Pass-through with normalisation, log unknown
      const fallback = toSlug(raw);
      console.log(`[seed-stays] ASSUMPTION: unknown amenity "${raw}" → stored as "${fallback}"`);
      result.add(fallback);
    }
  }
  return [...result];
}

// ── Capacity parser ───────────────────────────────────────────────────────────
// Villa source: "8 kişi" (string), hotel room: numeric sleeps field.
function parseCapacity(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const m = val.match(/\d+/);
    return m ? parseInt(m[0], 10) : 1;
  }
  return 1;
}

// ── Image URL helper ──────────────────────────────────────────────────────────
// Source paths are root-relative ("/assets/img/..."). These are valid public URLs
// when served by Vercel. We keep them as-is; host can replace with Storage URLs later.
function resolveImages(gallery, image) {
  const imgs = [];
  if (Array.isArray(gallery) && gallery.length) {
    imgs.push(...gallery);
  } else if (image) {
    imgs.push(image);
  }
  // Deduplicate while preserving order
  return [...new Set(imgs)];
}

// ── Load source data ──────────────────────────────────────────────────────────
const villalarRaw = JSON.parse(readFileSync(resolve(ROOT, 'data/villalar.json'), 'utf8'));
const otelerRaw   = JSON.parse(readFileSync(resolve(ROOT, 'data/oteller.json'),  'utf8'));

const villas = villalarRaw.items || [];
const hotels = otelerRaw.items   || [];

// ── Map functions ─────────────────────────────────────────────────────────────

function mapVilla(v) {
  // Villas have no numeric price in source. Log and leave null.
  // Schema requires price_per_night NOT NULL, but we use 0 as placeholder
  // so the row can be inserted; host must update via admin panel.
  const hasPrice = false; // confirmed: no numeric price field in villalar.json
  if (!hasPrice) {
    console.log(`[seed-stays] ASSUMPTION: villa "${v.name}" has no numeric price → price_per_night=0 (placeholder, update via admin)`);
  }

  // Derive amenities from boolean fields + tags
  const amenitySource = [];
  if (v.pool)     amenitySource.push('özel havuz');
  if (v.seaView)  amenitySource.push('deniz manzarası');
  // Features often contain wifi/klima/concierge hints
  if (Array.isArray(v.features)) {
    for (const f of v.features) {
      const fl = f.toLowerCase();
      if (fl.includes('wifi') || fl.includes('wi-fi')) amenitySource.push('wifi');
      if (fl.includes('klima'))                          amenitySource.push('klima');
      if (fl.includes('concierge'))                      amenitySource.push('concierge');
      if (fl.includes('jakuzi'))                         amenitySource.push('jakuzi');
      if (fl.includes('barbekü') || fl.includes('barbeque') || fl.includes('bbq')) amenitySource.push('barbekü');
      if (fl.includes('smart tv'))                       amenitySource.push('smart tv');
      if (fl.includes('bilardo'))                        amenitySource.push('bilardo masası');
      if (fl.includes('mutfak'))                         amenitySource.push('amerikan mutfak');
    }
  }

  const slug = v.id ? toSlug(v.id) : toSlug(v.name);

  return {
    owner_id:       OWNER_ID,
    slug,
    title:          v.name,
    listing_type:   'villa',
    capacity:       parseCapacity(v.capacity),
    bedrooms:       v.bedrooms  ?? null,
    beds:           v.bedrooms  ?? null,   // ASSUMPTION: 1 bed per bedroom as minimum proxy
    bathrooms:      v.bathrooms ?? null,
    price_per_night: 0,   // placeholder — no source price; must be set by host
    currency:       'TRY',
    cleaning_fee:   0,
    amenities:      normaliseAmenities(amenitySource),
    location:       v.location ?? null,
    images:         resolveImages(v.gallery, v.image),
    description:    v.summary ?? (Array.isArray(v.description_long) ? v.description_long[0] : null),
    status:         'active',
  };
}

function mapHotelWhole(h) {
  // Whole hotel entity row — listing_type 'whole_building'
  // priceRange ("$$") is symbolic; no numeric price available.
  console.log(`[seed-stays] ASSUMPTION: hotel "${h.name}" (whole_building) has no numeric price → price_per_night=0 (placeholder)`);

  const slug = h.id ? toSlug(h.id) : toSlug(h.name);

  // Max capacity = sum of roomType sleeps, or number of roomTypes * 2 as fallback
  const totalCapacity = Array.isArray(h.roomTypes) && h.roomTypes.length
    ? h.roomTypes.reduce((sum, rt) => sum + (rt.sleeps ?? 2), 0)
    : 2;

  return {
    owner_id:       OWNER_ID,
    slug,
    title:          h.name,
    listing_type:   'whole_building',
    capacity:       totalCapacity,
    bedrooms:       Array.isArray(h.roomTypes) ? h.roomTypes.length : null,
    beds:           Array.isArray(h.roomTypes) ? h.roomTypes.length : null,
    bathrooms:      null,
    price_per_night: 0,
    currency:       'TRY',
    cleaning_fee:   0,
    amenities:      normaliseAmenities(h.amenities),
    location:       h.location ?? null,
    lat:            h.geo?.lat ?? null,
    lng:            h.geo?.lng ?? null,
    images:         resolveImages(h.gallery, h.image),
    description:    h.summary ?? null,
    contact_whatsapp: h.phone ?? null,
    status:         'active',
  };
}

function mapHotelRoom(h, rt, idx) {
  // Each roomType becomes a 'room' listing under the hotel.
  // ASSUMPTION: room price not in source → 0 placeholder.
  const roomSlug = (h.id ? toSlug(h.id) : toSlug(h.name)) + '-room-' + (idx + 1);
  const title    = `${h.name} — ${rt.name}`;

  return {
    owner_id:       OWNER_ID,
    slug:           roomSlug,
    title:          title.slice(0, 120),  // schema max 120
    listing_type:   'room',
    capacity:       rt.sleeps ?? 2,
    bedrooms:       1,
    beds:           1,
    bathrooms:      1,
    price_per_night: 0,
    currency:       'TRY',
    cleaning_fee:   0,
    amenities:      normaliseAmenities(h.amenities),  // inherit hotel amenities
    location:       h.location ?? null,
    lat:            h.geo?.lat ?? null,
    lng:            h.geo?.lng ?? null,
    images:         resolveImages(h.gallery, h.image),
    description:    rt.description
      ? `${h.summary ?? ''}\n\n${rt.description}`.trim().slice(0, 5000)
      : (h.summary ?? null),
    contact_whatsapp: h.phone ?? null,
    status:         'active',
  };
}

// ── Build all rows ─────────────────────────────────────────────────────────────
const rows = [];

// Villas
for (const v of villas) {
  rows.push(mapVilla(v));
}

// Hotels: one whole_building row + one room row per roomType
for (const h of hotels) {
  rows.push(mapHotelWhole(h));
  if (Array.isArray(h.roomTypes)) {
    h.roomTypes.forEach((rt, idx) => rows.push(mapHotelRoom(h, rt, idx)));
  }
}

// ── Dry run ───────────────────────────────────────────────────────────────────
if (DRY) {
  console.log('\n[seed-stays] DRY RUN — rows that would be upserted:\n');
  for (const row of rows) {
    console.log(JSON.stringify(row, null, 2));
    console.log('---');
  }
  const villaCount = villas.length;
  const hotelWholeCount = hotels.length;
  const hotelRoomCount  = hotels.reduce((n, h) => n + (h.roomTypes?.length ?? 0), 0);
  console.log(
    `\n[seed-stays] DRY SUMMARY: ${villaCount} villa(s) + ${hotelWholeCount} hotel(s) [whole_building] ` +
    `+ ${hotelRoomCount} hotel room(s) = ${rows.length} total rows`
  );
  process.exit(0);
}

// ── Upsert ────────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

const { data, error } = await supabase
  .from('stays')
  .upsert(rows, { onConflict: 'slug' })
  .select('slug, listing_type');

if (error) {
  console.error('[seed-stays] Upsert error:', error.message ?? error);
  process.exit(1);
}

const upserted = data?.length ?? rows.length;
const villaCount       = villas.length;
const hotelWholeCount  = hotels.length;
const hotelRoomCount   = hotels.reduce((n, h) => n + (h.roomTypes?.length ?? 0), 0);

console.log(
  `[seed-stays] Done. ${villaCount} villa(s) + ${hotelWholeCount} hotel(s) [whole_building] ` +
  `+ ${hotelRoomCount} hotel room(s) → ${upserted} stays upserted.`
);

/*
 * ── FIELD MAPPING SUMMARY ─────────────────────────────────────────────────────
 * listing_type  villa→'villa'; hotel entity→'whole_building'; roomType→'room'
 * slug          from source item.id (already kebab-case); fallback toSlug(name)
 * capacity      villa: parse int from "8 kişi"; room: roomType.sleeps; whole: sum sleeps
 * bedrooms/beds villa: v.bedrooms; room/whole: roomType count; beds = bedrooms proxy
 * price_per_night 0 (placeholder) — no numeric price in either source file (only "$$" priceRange)
 * amenities     Turkish labels normalised to canonical keys (pool/wifi/ac/seaview…)
 *               + inferred from villa boolean fields (pool, seaView) and features[]
 * images        gallery[] array; falls back to image; paths are root-relative Vercel-served assets
 * description   summary field; room rows prepend hotel summary + roomType.description
 * lat/lng       from hotel.geo (null for villas — no geo in source)
 * contact_whatsapp hotel.phone (null for most; villas have no phone field)
 * owner_id      from env STAYS_SEED_OWNER_ID — must be a real auth.users UUID
 */
