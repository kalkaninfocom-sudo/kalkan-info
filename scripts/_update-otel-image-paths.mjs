#!/usr/bin/env node
/**
 * data/oteller.json icindeki tum oteller icin image + gallery alanlarini
 * scripts/fetch-otel-photos.mjs'in indirdiği yeni dosya yollarına gore guncelle.
 *
 * - image:   /assets/img/oteller/<slug>-hero.jpg
 * - gallery: [<slug>-1.jpg ... <slug>-8.jpg]
 *
 * Sadece hero dosyasi mevcutsa update eder; eksikse o oteli atlar (warn).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'assets', 'img', 'oteller');

const dataPath = join(ROOT, 'data', 'oteller.json');
const data = JSON.parse(await readFile(dataPath, 'utf8'));

let updated = 0;
let skipped = 0;

for (const it of (data.items || [])) {
  const slug = it.id;
  const heroFs = join(IMG_DIR, `${slug}-hero.jpg`);
  if (!existsSync(heroFs)) {
    console.warn(`  - ${slug}: hero yok, atlandi`);
    skipped++;
    continue;
  }
  it.image = `/assets/img/oteller/${slug}-hero.jpg`;
  const gallery = [];
  for (let i = 1; i <= 8; i++) {
    const f = join(IMG_DIR, `${slug}-${i}.jpg`);
    if (existsSync(f)) gallery.push(`/assets/img/oteller/${slug}-${i}.jpg`);
  }
  it.gallery = gallery;
  updated++;
  console.log(`  + ${slug}: hero + ${gallery.length} galeri`);
}

await writeFile(dataPath, JSON.stringify(data, null, 2));
console.log(`\n${updated} otel guncellendi, ${skipped} atlandi (toplam ${data.items.length}).`);
