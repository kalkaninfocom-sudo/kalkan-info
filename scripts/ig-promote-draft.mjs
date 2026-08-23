#!/usr/bin/env node
/**
 * ig-promote-draft.mjs — TASLAĞI canlı kategori JSON'una taşı (dedupe + kalite filtresi).
 * GÜVENLİ: instagram/ad'a göre dedupe, kalite filtresi (kategori-uyum/coğrafya/sinyal),
 * çıktı DRY varsayılan. --apply ile yazar.
 *
 * node scripts/ig-promote-draft.mjs su-sporlari        # DRY
 * node scripts/ig-promote-draft.mjs su-sporlari --apply
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const which = args.find((a) => !a.startsWith('--')) || 'su-sporlari';

// taslak → canlı dosya + kategori meta
const MAP = {
  'su-sporlari': { live: 'su-sporlari.json', category: 'Su Sporları', categoryKey: 'watersports',
    // bu kategoriye AİT OLMAYAN handle işaretleri (yanlış kategori → hariç)
    wrongCat: /\b(bar|lounge|pub|cocktail|restaurant|cafe|hotel|otel)\b/i },
};
const cfg = MAP[which];
if (!cfg) { console.error('Desteklenen: ' + Object.keys(MAP).join(', ')); process.exit(2); }

const NON_KALKAN = /kassiopi|corfu|korfu|rodos|rhodes|bodrum|marmaris|fethiye|gocek|göcek|santorini|mikonos|mykonos/i;

const liveRaw = JSON.parse(readFileSync(join(ROOT, 'data', cfg.live), 'utf8'));
const live = liveRaw.items || [];
const liveIg = new Set(live.map((i) => (i.instagram || '').toLowerCase().replace('@', '').replace(/\/$/, '')));
const liveName = new Set(live.map((i) => (i.name || '').toLowerCase().trim()));
const liveId = new Set(live.map((i) => i.id));

const draft = JSON.parse(readFileSync(join(ROOT, 'data', `${which}-draft.json`), 'utf8')).items || [];

const promoted = [], skipped = [];
for (const it of draft) {
  const ig = (it.instagram || '').toLowerCase();
  const name = (it.name || '').trim();
  const hay = `${ig} ${name} ${it.biography || ''} ${it.type || ''}`;
  // 1) zaten canlıda
  if (liveIg.has(ig) || liveName.has(name.toLowerCase())) { skipped.push([name, 'zaten canlıda']); continue; }
  // 2) yanlış kategori (bar/restoran vb.)
  if (cfg.wrongCat.test(ig) || cfg.wrongCat.test(it.type || '')) { skipped.push([name, 'yanlış kategori (bar/vb.)']); continue; }
  // 3) coğrafya riski (Kalkan dışı)
  if (NON_KALKAN.test(hay)) { skipped.push([name, 'Kalkan-dışı coğrafya işareti']); continue; }
  // 4) çok düşük sinyal (foto yok + takipçi<150 + website yok) → belirsiz, hariç
  if (!(it.gallery || []).length && (it.followers || 0) < 150 && !it.website) { skipped.push([name, 'çok düşük sinyal']); continue; }

  // id çakışması engelle
  let id = `${cfg.categoryKey}-${ig.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  if (liveId.has(id)) id = id + '-2';

  promoted.push({
    id, name, category: cfg.category, categoryKey: cfg.categoryKey,
    type: it.type || null, rating: null, reviewCount: 0,
    location: it.location || 'Kalkan', phone: it.phone || '', website: it.website || '',
    instagram: ig, image: it.image || null, gallery: it.gallery || [],
    summary: it.summary || '', tagline: it.type || it.summary || '',
    followers: it.followers ?? null,
    source: 'ig-business_discovery', verified: false, needsReview: true,
    addedAt: '2026-08-10',
  });
}

console.log(`\n=== ${which}: ${draft.length} taslak → ${promoted.length} PROMOTE ${APPLY ? '(UYGULANIYOR)' : '(DRY)'} · ${skipped.length} atlandı ===\n`);
console.log('PROMOTE EDİLENLER:');
promoted.forEach((p) => console.log(`  + ${p.name} (@${p.instagram}) — ${p.gallery.length} foto`));
console.log('\nATLANANLAR:');
skipped.forEach(([n, r]) => console.log(`  - ${n}: ${r}`));

if (APPLY && promoted.length) {
  liveRaw.items = [...live, ...promoted];
  if (liveRaw._meta) liveRaw._meta.updated = '2026-08-10';
  writeFileSync(join(ROOT, 'data', cfg.live), JSON.stringify(liveRaw, null, 2) + '\n', 'utf8');
  console.log(`\n💾 ${promoted.length} işletme data/${cfg.live}'a eklendi (toplam ${liveRaw.items.length}).`);
} else if (!APPLY) {
  console.log('\n(DRY — uygulamak için: --apply)');
}
