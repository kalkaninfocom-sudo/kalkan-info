/**
 * icon-512.png'den tüm PWA ikon boyutlarını yeniden üret.
 * Tek source-of-truth, tutarlı görsel.
 * Run: node scripts/regen-icons.mjs
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS = resolve(__dirname, '../icons');
const SRC = resolve(ICONS, 'icon-512.png');

const SIZES = [
  { size: 72,  name: 'icon-72.png' },
  { size: 96,  name: 'icon-96.png' },
  { size: 128, name: 'icon-128.png' },
  { size: 144, name: 'icon-144.png' },
  { size: 152, name: 'icon-152.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS
  { size: 192, name: 'icon-192.png' },
  { size: 384, name: 'icon-384.png' },
  { size: 32,  name: 'favicon-32.png' },
];

const src = await readFile(SRC);

for (const { size, name } of SIZES) {
  const out = resolve(ICONS, name);
  await sharp(src).resize(size, size, { fit: 'cover', kernel: 'lanczos3' }).png({ quality: 95 }).toFile(out);
  console.log(`✓ ${name} (${size}×${size})`);
}

console.log('Done.');
