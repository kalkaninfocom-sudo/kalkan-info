/**
 * generate-og-reels.mjs
 *
 * Per-reel og:image generator. Output: assets/og/reels-<slug>.png (1200x630).
 * Reads content/reels.json, takes either the hero image (webp) or the antik OG (png),
 * darkens, adds: "INSTAGRAM REELS" tag + reel title + Kalkan Info wordmark.
 *
 * Run: node scripts/generate-og-reels.mjs
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'content/reels.json');
const OUT_DIR = resolve(ROOT, 'assets/og');

const W = 1200, H = 630;
const SEA_900 = '#072136', SUN_400 = '#f4b53d', SUN_500 = '#e89812';

function escapeXml(s = '') {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
}

async function loadHeroBuffer(reel) {
  const candidates = [
    reel.hero_image_local,
    reel.hero_image
  ].filter(Boolean);
  for (const rel of candidates) {
    try {
      const abs = resolve(ROOT, rel.replace(/^\//, ''));
      return await sharp(abs)
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .modulate({ brightness: 0.65 })
        .toBuffer();
    } catch (e) { /* try next */ }
  }
  return await sharp({
    create: { width: W, height: H, channels: 3, background: SEA_900 }
  }).png().toBuffer();
}

async function buildOne(reel) {
  const base = await loadHeroBuffer(reel);
  const title = escapeXml(reel.title);
  const subtitle = escapeXml((reel.subtitle || '').slice(0, 90));

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="darken" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${SEA_900}" stop-opacity="0.20" />
        <stop offset="55%" stop-color="${SEA_900}" stop-opacity="0.60" />
        <stop offset="100%" stop-color="${SEA_900}" stop-opacity="0.94" />
      </linearGradient>
      <filter id="ts" x="-5%" y="-5%" width="110%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="8" flood-color="#000" flood-opacity="0.65"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#darken)"/>
    <rect x="80" y="${H - 380}" width="6" height="200" rx="3" fill="${SUN_500}"/>
    <text x="120" y="${H - 270}" font-family="Montserrat, 'Segoe UI', sans-serif"
          font-size="22" font-weight="800" fill="${SUN_400}" letter-spacing="4" filter="url(#ts)">
      INSTAGRAM REELS · KALKAN INFO
    </text>
    <text x="120" y="${H - 180}" font-family="Montserrat, 'Segoe UI', sans-serif"
          font-size="64" font-weight="900" fill="#ffffff" letter-spacing="-2" filter="url(#ts)">
      ${title}
    </text>
    <text x="120" y="${H - 120}" font-family="Inter, 'Segoe UI', sans-serif"
          font-size="24" font-weight="500" fill="#cfdfee" filter="url(#ts)">
      ${subtitle}
    </text>
    <text x="120" y="${H - 50}" font-family="Montserrat, 'Segoe UI', sans-serif"
          font-size="20" font-weight="800" fill="${SUN_400}" letter-spacing="2">
      ◆ kalkaninfo.com/p/${escapeXml(reel.slug)}
    </text>
    <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${SUN_500}"/>
  </svg>`;

  const outPath = join(OUT_DIR, `reels-${reel.slug}.png`);
  await sharp(base)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const raw = await readFile(DATA, 'utf8');
  const data = JSON.parse(raw);
  for (const reel of data.reels) {
    try {
      const p = await buildOne(reel);
      console.log(`OG: ${p}`);
    } catch (e) {
      console.warn(`Skip ${reel.slug}: ${e.message}`);
    }
  }
  console.log(`\nDone — ${data.reels.length} reels OG images attempted in ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
