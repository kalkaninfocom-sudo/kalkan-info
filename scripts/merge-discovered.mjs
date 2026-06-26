#!/usr/bin/env node
/**
 * data/discovered/all-kalkan-*.json içindeki keşfedilen işletmeleri
 * mevcut envantere (restoranlar.json / turlar.json / hizmetler.json) entegre eder.
 *
 * Kurallar:
 *   - Slug çakışırsa MERGE: mevcut item korunur, rating/reviewCount/coordinates güncellenir.
 *   - Yeni slug ise APPEND: source="google_maps", verified=false, featured=false.
 *   - Sponsor mekanlar (source=client) DOKUNULMAZ — bu script onları override etmez.
 *
 * Kullanım:
 *   node scripts/merge-discovered.mjs                # son üretilmiş all-kalkan-*.json
 *   node scripts/merge-discovered.mjs --file=path    # belirli dosya
 *   node scripts/merge-discovered.mjs --dry-run      # JSON'u değiştirmeden raporla
 *
 * Çıktı (her zaman):
 *   data/discovered/_merge-report-<timestamp>.md     # ne eklendi/güncellendi
 *
 * Çıktı (dry-run değilse):
 *   data/restoranlar.json  ←  items[] genişler (restaurant, cafe, bar, beach_club)
 *   data/turlar.json       ←  items[] genişler (diving, boat_tour)
 *   data/hizmetler.json    ←  items[] eklenir (barber, market, pharmacy, bakery, atm, laundry)
 */
import { readFile, writeFile, readdir, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DISC_DIR = join(ROOT, 'data', 'discovered');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.includes('=') ? a.slice(2).split('=') : [a.slice(2), true])
);
const DRY = args['dry-run'] === true;

// Hedef JSON dosyası mapping
const CATEGORY_TO_TARGET = {
  restaurant:  { file: 'restoranlar.json', kind: 'restoran' },
  cafe:        { file: 'restoranlar.json', kind: 'restoran' },
  bar:         { file: 'restoranlar.json', kind: 'restoran' },
  beach_club:  { file: 'restoranlar.json', kind: 'restoran' },
  diving:      { file: 'turlar.json',      kind: 'tur'      },
  boat_tour:   { file: 'turlar.json',      kind: 'tur'      },
  barber:      { file: 'hizmetler.json',   kind: 'hizmet'   },
  market:      { file: 'hizmetler.json',   kind: 'hizmet'   },
  pharmacy:    { file: 'hizmetler.json',   kind: 'hizmet'   },
  bakery:      { file: 'hizmetler.json',   kind: 'hizmet'   },
  atm:         { file: 'hizmetler.json',   kind: 'hizmet'   },
  laundry:     { file: 'hizmetler.json',   kind: 'hizmet'   },
};

// Kategori → bizim sistem etiketi (TR)
const CATEGORY_LABEL_TR = {
  restaurant:  'Restoran',
  cafe:        'Kafe',
  bar:         'Bar & Pub',
  beach_club:  'Plaj Kulübü',
  diving:      'Dalış Merkezi',
  boat_tour:   'Tekne Turu',
  barber:      'Berber & Kuaför',
  market:      'Market & Manav',
  pharmacy:    'Eczane',
  bakery:      'Fırın & Pastane',
  atm:         'ATM',
  laundry:     'Çamaşırhane',
};

// ─── En son üretilmiş all-kalkan-*.json bul ───
async function findLatestDiscovered() {
  if (args.file) return args.file;
  const files = (await readdir(DISC_DIR))
    .filter(f => f.startsWith('all-kalkan-') && f.endsWith('.json'))
    .sort();
  if (!files.length) {
    throw new Error('all-kalkan-*.json yok. Önce discover-all-kalkan.mjs çalıştır.');
  }
  return join(DISC_DIR, files[files.length - 1]);
}

// ─── Discovered item → restoranlar.json items[] formatı ───
function toRestoranItem(d) {
  return {
    id: d.slug,
    name: d.name,
    category: CATEGORY_LABEL_TR[d.category] || d.category,
    cuisine: '',
    priceRange: d.priceLevel || '',
    rating: d.rating,
    reviewCount: d.reviewCount,
    location: d.address || '',
    phone: d.phone || '',
    website: d.website || '',
    instagram: '',
    image: '', // enrich.mjs sonra dolduracak
    gallery: [],
    summary: '', // çeviri sonrası dolacak
    specialties: [],
    hours: typeof d.hours === 'string' ? d.hours : '',
    reservation: false,
    featured: false,
    source: 'google_maps',
    verified: false,
    place_id: d.place_id,
    coordinates: d.coordinates,
    nameI18n: { tr: d.name, en: d.name },
  };
}

// ─── Discovered item → turlar.json items[] formatı (basit varyant) ───
function toTurItem(d) {
  return {
    id: d.slug,
    name: d.name,
    category: CATEGORY_LABEL_TR[d.category] || d.category,
    rating: d.rating,
    reviewCount: d.reviewCount,
    location: d.address || '',
    phone: d.phone || '',
    website: d.website || '',
    image: '',
    gallery: [],
    summary: '',
    duration: '',
    price: d.priceLevel || '',
    source: 'google_maps',
    verified: false,
    place_id: d.place_id,
    coordinates: d.coordinates,
  };
}

// ─── Discovered item → hizmetler.json items[] formatı ───
function toHizmetItem(d) {
  return {
    id: d.slug,
    name: d.name,
    category: CATEGORY_LABEL_TR[d.category] || d.category,
    categoryKey: d.category,
    rating: d.rating,
    reviewCount: d.reviewCount,
    location: d.address || '',
    phone: d.phone || '',
    website: d.website || '',
    hours: typeof d.hours === 'string' ? d.hours : '',
    coordinates: d.coordinates,
    source: 'google_maps',
    verified: false,
    place_id: d.place_id,
  };
}

// ─── Merge logic ───
function mergeItem(existing, fresh) {
  // Sponsor mekanları (source=client) override etme
  if (existing.source === 'client') {
    return { ...existing, _merge_status: 'skipped_client' };
  }
  // Google Maps kaynaklı item: rating/reviewCount/coordinates güncelle
  return {
    ...existing,
    rating: fresh.rating ?? existing.rating,
    reviewCount: fresh.reviewCount ?? existing.reviewCount,
    coordinates: fresh.coordinates ?? existing.coordinates,
    phone: fresh.phone || existing.phone,
    website: fresh.website || existing.website,
    place_id: fresh.place_id || existing.place_id,
    _merge_status: 'updated',
  };
}

// ─── Main ───
const discoveredPath = await findLatestDiscovered();
const discovered = JSON.parse(await readFile(discoveredPath, 'utf8'));
console.log(`📂 Discovered: ${discoveredPath}`);
console.log(`   ${discovered.items.length} işletme, ${Object.keys(discovered.meta.by_category).length} kategori`);

// Hedef dosyaları topla
const fileGroups = new Map(); // filename → items[]
for (const d of discovered.items) {
  const target = CATEGORY_TO_TARGET[d.category];
  if (!target) {
    console.warn(`?? Eşleşmeyen kategori: ${d.category}, atlandı`);
    continue;
  }
  if (!fileGroups.has(target.file)) fileGroups.set(target.file, []);
  fileGroups.get(target.file).push({ d, target });
}

const report = [];
report.push(`# Discovered Merge Report — ${new Date().toISOString()}`);
report.push(`\n**Kaynak:** \`${discoveredPath.split(/[\\/]/).pop()}\``);
report.push(`**Dry-run:** ${DRY ? 'EVET (JSON değiştirilmedi)' : 'HAYIR'}\n`);

for (const [filename, group] of fileGroups) {
  const targetPath = join(ROOT, 'data', filename);
  const target = JSON.parse(await readFile(targetPath, 'utf8'));
  if (!Array.isArray(target.items)) target.items = [];

  const existingBySlug = new Map(target.items.map(it => [it.id, it]));
  let added = 0, updated = 0, skipped = 0;

  for (const { d, target: t } of group) {
    const newItem =
      t.kind === 'restoran' ? toRestoranItem(d) :
      t.kind === 'tur'      ? toTurItem(d) :
                              toHizmetItem(d);

    if (existingBySlug.has(d.slug)) {
      const merged = mergeItem(existingBySlug.get(d.slug), newItem);
      if (merged._merge_status === 'skipped_client') {
        skipped++;
      } else {
        delete merged._merge_status;
        existingBySlug.set(d.slug, merged);
        updated++;
      }
    } else {
      existingBySlug.set(d.slug, newItem);
      added++;
    }
  }

  target.items = [...existingBySlug.values()];
  if (target._meta) {
    target._meta.updated = new Date().toISOString().slice(0, 10);
  }

  report.push(`## ${filename}`);
  report.push(`- ✅ Eklendi:    **${added}**`);
  report.push(`- 🔄 Güncellendi: **${updated}**`);
  report.push(`- ⏭ Atlandı (sponsor): **${skipped}**`);
  report.push(`- 📦 Toplam item: **${target.items.length}**\n`);

  if (!DRY) {
    // Yedek al
    await copyFile(targetPath, targetPath + '.bak');
    await writeFile(targetPath, JSON.stringify(target, null, 2), 'utf8');
    console.log(`✓ ${filename}: +${added} eklendi, ~${updated} güncellendi, ${skipped} atlandı`);
  } else {
    console.log(`[DRY] ${filename}: +${added} eklenecek, ~${updated} güncellenecek, ${skipped} atlanacak`);
  }
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportPath = join(DISC_DIR, `_merge-report-${ts}.md`);
await writeFile(reportPath, report.join('\n'), 'utf8');
console.log(`\n📋 Rapor: ${reportPath}`);
