/**
 * Generates assets/og-default.png (1200x630) for social previews.
 * Composites icons/icon-512.png onto a sea-900 → sun gradient with brand text.
 * Run: node scripts/generate-og.mjs
 */
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOGO = resolve(ROOT, 'icons/icon-512.png');
const OUT = resolve(ROOT, 'assets/og-default.png');

const W = 1200, H = 630;
const SEA_900 = '#072136', SEA_800 = '#0a2e4c', SUN_400 = '#f4b53d', SUN_500 = '#e89812';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgGrad" cx="60%" cy="40%" r="80%">
      <stop offset="0%" stop-color="${SEA_800}" />
      <stop offset="70%" stop-color="${SEA_900}" />
    </radialGradient>
    <radialGradient id="sunGlow" cx="15%" cy="85%" r="55%">
      <stop offset="0%" stop-color="${SUN_400}" stop-opacity="0.22" />
      <stop offset="100%" stop-color="${SUN_400}" stop-opacity="0" />
    </radialGradient>
    <filter id="textShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="${SEA_900}" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <rect width="${W}" height="${H}" fill="url(#sunGlow)"/>

  <!-- noise overlay -->
  <rect width="${W}" height="${H}" fill="#ffffff" opacity="0.02"/>

  <!-- left accent bar -->
  <rect x="80" y="120" width="6" height="390" rx="3" fill="${SUN_500}"/>

  <!-- brand text -->
  <text x="120" y="240" font-family="Montserrat, 'Segoe UI', system-ui, sans-serif" font-size="96" font-weight="900" fill="#ffffff" letter-spacing="-3" filter="url(#textShadow)">Kalkan Info</text>
  <text x="120" y="310" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="34" font-weight="600" fill="${SUN_400}" letter-spacing="2">ANTALYA KALKAN REHBERİ</text>

  <!-- bullet list -->
  <g font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="26" fill="#cfdfee" font-weight="500">
    <text x="120" y="390">• Plajlar · Villalar · Restoranlar · Aktiviteler</text>
    <text x="120" y="430">• Yerel hizmetler · Antik kentler · Haberler</text>
    <text x="120" y="470">• Tatil asistanı · İş ilanları · 2026</text>
  </g>

  <!-- bottom strip -->
  <rect x="0" y="${H - 12}" width="${W}" height="12" fill="${SUN_500}"/>
</svg>`;

await mkdir(dirname(OUT), { recursive: true });

const logo = await readFile(LOGO);
const logoSized = await sharp(logo).resize(320, 320, { fit: 'contain' }).toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: logoSized, left: W - 320 - 100, top: (H - 320) / 2 }])
  .png()
  .toFile(OUT);

console.log(`OG image written: ${OUT}`);
