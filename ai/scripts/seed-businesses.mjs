/**
 * seed-businesses.mjs — Gerçek Kalkan venue verisini ai_businesses tablosuna doldurur.
 * Lyra grounding kaynağı. İdempotent (venue_slug upsert) — veri değişince tekrar çalıştır.
 *
 * Kaynaklar: data/{restoranlar,oteller,plajlar,villalar,turlar}.json
 * Çalıştırma (production'a yazar):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node ai/scripts/seed-businesses.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');   // kalkan-info/
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('HATA: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gerekli'); process.exit(1); }
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const load = (f) => { try { return JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')); } catch (e) { console.warn(`atlandı ${f}: ${e.message}`); return null; }; };
const arr = (d) => Array.isArray(d) ? d : (d?.venues || d?.items || d?.data || d?.restaurants || []);

// Adresten kısa bölge çıkar (bilinen Kalkan mahalleleri)
const AREAS = ['Kalamar', 'Kışla', 'Ortaalan', 'Yalıboyu', 'Kalkan Merkez', 'Merkez', 'Patara', 'İslamlar', 'Üzümlü', 'Bezirgan', 'Kaş', 'Çukurbağ', 'Akbel'];
function area(loc) {
  if (!loc || typeof loc !== 'string') return null;
  const hit = AREAS.find(a => loc.toLowerCase().includes(a.toLowerCase()));
  return hit || loc.split(',')[0].trim().slice(0, 40) || null;
}
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const s = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : null;

const rows = [];
function push(r) { if (r.venue_slug && r.name) rows.push({ active: true, ...r }); }

// RESTORANLAR (telefonlu — Faz 2 için kritik)
for (const r of arr(load('restoranlar.json'))) push({
  venue_slug: s(r.id), name: s(r.name), type: 'restaurant', source: 'restoranlar.json', featured: !!r.featured,
  cuisine: s(r.cuisine) || s(r.category), price: s(r.priceRange), phone: s(r.phone),
  rating: num(r.rating), review_count: num(r.reviewCount), address: s(r.location), area: area(r.location),
  instagram: s(r.instagram), image: s(r.image), summary: s(r.summary),
  tags: [s(r.category)].filter(Boolean),
});

// OTELLER (telefonlu)
for (const r of arr(load('oteller.json'))) push({
  venue_slug: s(r.id), name: s(r.name), type: 'hotel', source: 'oteller.json', featured: !!r.featured,
  price: s(r.priceRange), phone: s(r.phone), rating: num(r.rating), review_count: num(r.reviewCount),
  address: s(r.location), area: area(r.location), instagram: s(r.instagram), image: s(r.image),
  summary: s(r.summary), tags: [s(r.category), r.starRating ? `${r.starRating}★` : null].filter(Boolean),
});

// PLAJLAR
for (const r of arr(load('plajlar.json'))) push({
  venue_slug: s(r.id), name: s(r.name), type: 'beach', source: 'plajlar.json', featured: !!r.featured,
  area: s(r.region), rating: num(r.rating), image: s(r.image), summary: s(r.summary),
  price: r.paid ? 'ücretli' : 'ücretsiz', tags: Array.isArray(r.tags) ? r.tags.filter(Boolean) : [],
});

// VILLALAR
for (const r of arr(load('villalar.json'))) push({
  venue_slug: s(r.id), name: s(r.name), type: 'villa', source: 'villalar.json', featured: !!r.featured,
  area: area(r.location) || s(r.location), rating: num(r.rating), image: s(r.image), summary: s(r.summary),
  tags: [r.seaView ? 'deniz manzarası' : null, r.pool ? 'havuz' : null, s(r.category), ...(Array.isArray(r.tags) ? r.tags : [])].filter(Boolean),
});

// TEKNE TURLARI / AKTİVİTELER
for (const r of arr(load('turlar.json'))) push({
  venue_slug: s(r.id), name: s(r.name), type: 'tour', source: 'turlar.json', featured: !!r.featured,
  price: s(r.price), rating: num(r.rating), image: s(r.image), summary: s(r.summary),
  tags: [s(r.category)].filter(Boolean),
});

// venue_slug tekilleştir (setler arası/içi çakışan id → son kayıt kazanır)
const uniq = new Map();
for (const r of rows) uniq.set(r.venue_slug, r);
const deduped = [...uniq.values()];
const dupes = rows.length - deduped.length;
rows.length = 0; rows.push(...deduped);

console.log(`Hazırlanan kayıt: ${rows.length}${dupes ? ` (${dupes} tekrar eleniyor)` : ''}`);
const byType = rows.reduce((a, r) => (a[r.type] = (a[r.type] || 0) + 1, a), {});
console.log('Tür dağılımı:', JSON.stringify(byType));

// Batch upsert (500'lük)
let done = 0;
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const { error } = await supabase.from('ai_businesses').upsert(batch, { onConflict: 'venue_slug' });
  if (error) { console.error('Upsert hatası:', error.message); process.exit(1); }
  done += batch.length; console.log(`  upsert ${done}/${rows.length}`);
}
const withPhone = rows.filter(r => r.phone).length;
console.log(`✅ Bitti: ${done} işletme seed edildi (${withPhone} telefonlu — Faz 2 arama için).`);
