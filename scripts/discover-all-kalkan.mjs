#!/usr/bin/env node
/**
 * Kalkan bölgesi için tüm kategorileri sırayla keşfeder ve tek bir consolidated JSON üretir.
 *
 * Kullanım:
 *   SERPAPI_KEY=... node scripts/discover-all-kalkan.mjs
 *
 * Çıktı:
 *   data/discovered/all-kalkan-<timestamp>.json   (tek dosya, tüm kategoriler)
 *   data/discovered/<category>-kalkan-<timestamp>.json   (kategori başına ayrı)
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CATEGORIES = [
  { cat: 'restaurant', limit: 80 },
  { cat: 'cafe',       limit: 40 },
  { cat: 'bar',        limit: 30 },
  { cat: 'beach_club', limit: 15 },
  { cat: 'barber',     limit: 25 },
  { cat: 'market',     limit: 20 },
  { cat: 'pharmacy',   limit: 10 },
  { cat: 'bakery',     limit: 10 },
  { cat: 'atm',        limit: 10 },
  { cat: 'diving',     limit: 10 },
  { cat: 'boat_tour',  limit: 10 },
  { cat: 'laundry',    limit: 5  },
];

function runOne(cat, limit) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [
      join(__dirname, 'discover-businesses.mjs'),
      `--category=${cat}`,
      `--limit=${limit}`,
      `--area=kalkan`,
    ], { stdio: 'inherit' });
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cat} exit=${code}`)));
  });
}

const startedAt = Date.now();
const all = [];

for (const { cat, limit } of CATEGORIES) {
  console.log(`\n━━━ ${cat.toUpperCase()} (max ${limit}) ━━━`);
  try {
    await runOne(cat, limit);
  } catch (e) {
    console.error(`!! ${cat} hatası:`, e.message);
    continue;
  }
}

// En son üretilmiş dosyaları bul ve birleştir
const discoveredDir = join(ROOT, 'data', 'discovered');
const files = (await readdir(discoveredDir))
  .filter(f => f.endsWith('.json') && f.includes('-kalkan-') && !f.startsWith('all-'))
  .sort();

// Her kategori için en son üretilmiş dosyayı al
const latestByCategory = new Map();
for (const f of files) {
  const m = f.match(/^([a-z_]+)-kalkan-(.+)\.json$/);
  if (!m) continue;
  const [, cat] = m;
  latestByCategory.set(cat, f); // sort sayesinde en sonki kazanır
}

for (const [cat, file] of latestByCategory) {
  const path = join(discoveredDir, file);
  const json = JSON.parse(await readFile(path, 'utf8'));
  all.push(...(json.items || []));
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const consolidatedPath = join(discoveredDir, `all-kalkan-${ts}.json`);
await writeFile(consolidatedPath, JSON.stringify({
  meta: {
    area: 'kalkan',
    timestamp: new Date().toISOString(),
    duration_sec: Math.round((Date.now() - startedAt) / 1000),
    total: all.length,
    by_category: Object.fromEntries(
      CATEGORIES.map(c => [c.cat, all.filter(i => i.category === c.cat).length])
    ),
  },
  items: all,
}, null, 2), 'utf8');

console.log(`\n\n✅ TAMAMLANDI`);
console.log(`   Toplam: ${all.length} işletme`);
console.log(`   Süre:   ${Math.round((Date.now() - startedAt) / 1000)}s`);
console.log(`   Dosya:  ${consolidatedPath}`);
console.log(`\n📊 Kategori dağılımı:`);
for (const c of CATEGORIES) {
  const count = all.filter(i => i.category === c.cat).length;
  console.log(`   · ${c.cat.padEnd(12)} ${count.toString().padStart(3)} / ${c.limit}`);
}
