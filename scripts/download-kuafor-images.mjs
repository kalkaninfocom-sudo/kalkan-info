import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const urls = [
  ['hizmet-erkek-berber',  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&fm=jpg'],
  ['hizmet-bayan-kuafor',  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80&fm=jpg'],
  ['hizmet-unisex-kuafor', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80&fm=jpg'],
];

for (const [name, url] of urls) {
  try {
    console.log(`Downloading ${name}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = await res.arrayBuffer();
    const outPath = `assets/img/${name}.webp`;
    await sharp(Buffer.from(buf)).resize(800).webp({ quality: 80 }).toFile(outPath);
    console.log(`✅ ${name}.webp`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    // Pexels fallback
    const fallbacks = {
      'hizmet-erkek-berber': 'https://images.pexels.com/photos/3998422/pexels-photo-3998422.jpeg?auto=compress&w=800',
      'hizmet-bayan-kuafor': 'https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg?auto=compress&w=800',
      'hizmet-unisex-kuafor': 'https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&w=800',
    };
    const fb = fallbacks[name];
    if (fb) {
      try {
        console.log(`  Trying fallback for ${name}...`);
        const fbRes = await fetch(fb);
        if (!fbRes.ok) throw new Error(`HTTP ${fbRes.status}`);
        const fbBuf = await fbRes.arrayBuffer();
        await sharp(Buffer.from(fbBuf)).resize(800).webp({ quality: 80 }).toFile(`assets/img/${name}.webp`);
        console.log(`✅ ${name}.webp (via fallback)`);
      } catch (fbErr) {
        console.error(`❌ Fallback also failed for ${name}: ${fbErr.message}`);
      }
    }
  }
}
