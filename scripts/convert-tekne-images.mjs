import sharp from 'sharp';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const SRC = 'C:/Users/socie/OneDrive/Desktop/tekne turları';
const DEST = 'C:/Users/socie/kalkan-info/assets/img';

const mapping = [
  ['Ali Korsan Boat Kalkan.jpg', 'tekne-ali-korsan.webp'],
  ['Ateş Boat.jpg', 'tekne-ates.webp'],
  ['Atlas Boat — Muhammetali Avcı.jpg', 'tekne-atlas.webp'],
  ['Chillout-Trippy Boat.jpg', 'tekne-chillout-trippy.webp'],
  ['Falcon Boat — Mehmet Baynur.jpg', 'tekne-falcon.webp'],
  ['Kalamaki Boats — Cpt. Yusuf.jpg', 'tekne-kalamaki.webp'],
  ['Nirvana Boat Kalkan.jpg', 'tekne-nirvana.webp'],
  ['Serenity Yachting.jpg', 'tekne-serenity.webp'],
  ['Yıldız Tourism — Kalkan.jpg', 'tekne-yildiz.webp'],
  ['Zeus Boat Touring.jpg', 'tekne-zeus.webp'],
  ['whisper-boat.jpg', 'tekne-whisper.webp'],
];

const MAX_W = 1200;

for (const [src, dst] of mapping) {
  const inPath = path.join(SRC, src);
  const outPath = path.join(DEST, dst);
  try {
    const buf = await fs.readFile(inPath);
    const meta = await sharp(buf).metadata();
    const pipeline = sharp(buf).rotate();
    if (meta.width && meta.width > MAX_W) pipeline.resize({ width: MAX_W, withoutEnlargement: true });
    const out = await pipeline.webp({ quality: 82, effort: 5 }).toBuffer();
    await fs.writeFile(outPath, out);
    console.log(`OK  ${dst}  ${(out.length/1024).toFixed(1)}KB  (src ${meta.width}x${meta.height})`);
  } catch (e) {
    console.error(`FAIL ${src}: ${e.message}`);
  }
}
