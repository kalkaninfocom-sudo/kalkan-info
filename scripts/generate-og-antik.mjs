/**
 * Per-page og:image generator for antik kent sub-pages.
 * Reads data/antik-kentler.json, picks featured cities (or all 10 priority slugs),
 * composites the existing kent webp + dark gradient + city name + Kalkan Info logo.
 * Output: assets/og/antik-<slug>.png (1200x630).
 *
 * Run: node scripts/generate-og-antik.mjs
 */
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'data/antik-kentler.json');
const LOGO = resolve(ROOT, 'icons/icon-192.png');
const OUT_DIR = resolve(ROOT, 'assets/og');

const W = 1200, H = 630;
const SEA_900 = '#072136', SUN_400 = '#f4b53d', SUN_500 = '#e89812';

// 10 priority slugs (UNESCO + most-visited + featured)
const PRIORITY = [
  'patara', 'xanthos', 'letoon', 'tlos', 'pinara',
  'simena', 'antiphellos', 'myra', 'andriake', 'aperlae'
];

function escapeXml(s = '') {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
}

async function buildOne(item) {
  const slug = item.id;
  const cityImage = item.image && item.image.startsWith('/')
    ? resolve(ROOT, item.image.slice(1))
    : null;

  // Base: city image, cover-resized to 1200x630, darkened
  let base;
  if (cityImage) {
    try {
      base = await sharp(cityImage)
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .modulate({ brightness: 0.7 })
        .toBuffer();
    } catch (e) {
      base = null;
    }
  }
  if (!base) {
    base = await sharp({
      create: { width: W, height: H, channels: 3, background: SEA_900 }
    }).png().toBuffer();
  }

  const name = escapeXml(item.name || slug);
  const category = escapeXml(item.category || '');
  const summary = escapeXml((item.tags || []).slice(0, 3).join(' · '));

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="darken" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${SEA_900}" stop-opacity="0.25" />
        <stop offset="55%" stop-color="${SEA_900}" stop-opacity="0.55" />
        <stop offset="100%" stop-color="${SEA_900}" stop-opacity="0.92" />
      </linearGradient>
      <filter id="ts" x="-5%" y="-5%" width="110%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="8" flood-color="#000" flood-opacity="0.65"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#darken)"/>
    <rect x="80" y="${H - 340}" width="6" height="180" rx="3" fill="${SUN_500}"/>
    <text x="120" y="${H - 230}" font-family="Montserrat, 'Segoe UI', sans-serif"
          font-size="22" font-weight="700" fill="${SUN_400}" letter-spacing="3" filter="url(#ts)">
      ${category.toUpperCase()}
    </text>
    <text x="120" y="${H - 150}" font-family="Montserrat, 'Segoe UI', sans-serif"
          font-size="78" font-weight="900" fill="#ffffff" letter-spacing="-2" filter="url(#ts)">
      ${name}
    </text>
    <text x="120" y="${H - 95}" font-family="Inter, 'Segoe UI', sans-serif"
          font-size="26" font-weight="500" fill="#cfdfee" filter="url(#ts)">
      ${summary}
    </text>
    <text x="120" y="${H - 40}" font-family="Montserrat, 'Segoe UI', sans-serif"
          font-size="20" font-weight="800" fill="${SUN_400}" letter-spacing="2">
      ◆ KALKAN INFO
    </text>
    <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${SUN_500}"/>
  </svg>`;

  const outPath = join(OUT_DIR, `antik-${slug}.png`);
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
  const byId = new Map(data.items.map(it => [it.id, it]));

  const targets = PRIORITY.map(id => byId.get(id)).filter(Boolean);
  if (targets.length < PRIORITY.length) {
    console.warn(`Missing ids: ${PRIORITY.filter(p => !byId.has(p)).join(', ')}`);
  }

  for (const item of targets) {
    const p = await buildOne(item);
    console.log(`OG: ${p}`);
  }
  console.log(`\nDone — ${targets.length} OG images written to ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
