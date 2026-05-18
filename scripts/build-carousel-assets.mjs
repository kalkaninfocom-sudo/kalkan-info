/**
 * scripts/build-carousel-assets.mjs — Faz 2B Carousel Builder
 *
 * Her antik kent content pack için 3 IG carousel slide üretir:
 *   Slide 1: Cover  — kent görseli + başlık overlay
 *   Slide 2: Vurgu  — highlights / voiceover kısa metni
 *   Slide 3: CTA    — kalkaninfo.com link + logo
 *
 * Çıktı: dist/social/{contentPackId}/slide-{1,2,3}.jpg (1080x1350, IG portrait)
 * Sonra: Supabase Storage'a upload + social_posts.local_assets güncelleme
 *
 * Kullanım:
 *   node scripts/build-carousel-assets.mjs --pack=patara
 *   node scripts/build-carousel-assets.mjs --all
 *   node scripts/build-carousel-assets.mjs --all --dry-run
 */

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { uploadAsset } from '../lib/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// .env.local fallback
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.+?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n/g, '').trim();
  }
} catch {}

// ── Supabase REST helper (social_posts update için) ─────────────────────────
const SUPA_URL = process.env.SUPABASE_URL?.trim();
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SUPA_URL || !SUPA_KEY) { console.error('❌ Supabase env eksik'); process.exit(1); }

const supaFetch = (path, opts = {}) =>
  fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {})
    }
  });

// ── Brand constants ──────────────────────────────────────────────────────────
const BRAND = {
  bg:        '#020510',
  blue:      '#4A9EF5',
  gold:      '#E8A020',
  white:     '#FFFFFF',
  overlay:   'rgba(2, 5, 16, 0.72)',
  slide: {
    width:  1080,
    height: 1350   // 4:5 IG portrait
  },
  jpeg: { quality: 88 }
};

// ── CLI args ─────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY      = args.includes('--dry-run');
const ALL      = args.includes('--all');
const packArg  = (args.find(a => a.startsWith('--pack=')) || '').replace('--pack=', '');

if (!ALL && !packArg) {
  console.error('Kullanım: --pack=<id> veya --all');
  process.exit(1);
}

// ── Load content ─────────────────────────────────────────────────────────────
const contentPath = resolve(ROOT, 'content', 'antik-reels.json');
const { items }   = JSON.parse(readFileSync(contentPath, 'utf8'));

const targets = ALL ? items : items.filter(i => i.id === packArg);
if (targets.length === 0) {
  console.error(`❌ Pack bulunamadı: ${packArg}`);
  process.exit(1);
}

// ── Logo path ────────────────────────────────────────────────────────────────
const LOGO_PATH = resolve(ROOT, 'icons', 'icon.svg');
const HAS_LOGO  = existsSync(LOGO_PATH);

// ── SVG text helper — wrap long text ─────────────────────────────────────────
function wrapText(text, maxChars = 32) {
  const words = text.split(' ');
  const lines = [];
  let line    = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

// ── Slide builders ───────────────────────────────────────────────────────────

/**
 * Slide 1: Cover — kent görseli + koyu overlay + başlık
 */
async function buildSlide1(item, sourceImg) {
  const { width, height } = BRAND.slide;
  const titleLines = wrapText(item.name.toUpperCase(), 20);
  const subtitleLines = wrapText(
    item.voiceover_en.split('.')[0].trim(),   // ilk cümle
    40
  );

  // title SVG satırları
  const titleY   = height - 420;
  const titleSvg = titleLines.map((l, i) =>
    `<text x="540" y="${titleY + i * 90}"
      font-family="Orbitron, Arial Black, sans-serif"
      font-size="80" font-weight="900" fill="${BRAND.gold}"
      text-anchor="middle" letter-spacing="4">${l}</text>`
  ).join('\n');

  // subtitle SVG satırları
  const subY   = titleY + titleLines.length * 90 + 28;
  const subSvg = subtitleLines.map((l, i) =>
    `<text x="540" y="${subY + i * 44}"
      font-family="Inter, Arial, sans-serif"
      font-size="36" fill="${BRAND.white}" opacity="0.9"
      text-anchor="middle">${l}</text>`
  ).join('\n');

  // kalkaninfo.com tag — alt sol
  const tagSvg = `
    <rect x="60" y="${height - 120}" width="340" height="56" rx="28"
      fill="${BRAND.blue}" opacity="0.9"/>
    <text x="230" y="${height - 82}"
      font-family="Inter, Arial, sans-serif"
      font-size="30" font-weight="700" fill="${BRAND.white}"
      text-anchor="middle">kalkaninfo.com</text>`;

  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#020510" stop-opacity="0.1"/>
          <stop offset="55%"  stop-color="#020510" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#020510" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g1)"/>
      ${titleSvg}
      ${subSvg}
      ${tagSvg}
    </svg>`);

  return sharp(sourceImg)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .composite([{ input: overlay, blend: 'over' }])
    .jpeg(BRAND.jpeg);
}

/**
 * Slide 2: Vurgu — gradient bg + voiceover highlights
 */
async function buildSlide2(item) {
  const { width, height } = BRAND.slide;

  // İlk 3 cümleyi al (vurgu)
  const sentences = item.voiceover_en
    .split(/(?<=[.!?])\s+/)
    .slice(0, 3)
    .map(s => s.trim());

  // Her cümleyi satırlara sar
  const allLines = [];
  for (const s of sentences) {
    const lines = wrapText(s, 38);
    allLines.push(...lines, ''); // boş satır arası
  }
  allLines.pop(); // son boş satırı kaldır

  const startY    = (height - allLines.length * 56) / 2;
  const textSvgs  = allLines.map((l, i) => {
    if (!l) return '';
    return `<text x="540" y="${startY + i * 56}"
      font-family="Inter, Arial, sans-serif"
      font-size="${i === 0 ? 40 : 34}" font-weight="${i === 0 ? '700' : '400'}"
      fill="${i === 0 ? BRAND.gold : BRAND.white}" opacity="0.95"
      text-anchor="middle">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`;
  }).join('\n');

  // Dekoratif çizgi
  const lineY  = startY - 32;
  const decSvg = `
    <line x1="180" y1="${lineY}" x2="900" y2="${lineY}"
      stroke="${BRAND.blue}" stroke-width="3" opacity="0.7"/>`;

  // Pack ID — alt sağ küçük etiket
  const labelSvg = `
    <text x="${width - 60}" y="${height - 60}"
      font-family="Orbitron, Arial Black, sans-serif"
      font-size="22" fill="${BRAND.blue}" opacity="0.7"
      text-anchor="end" letter-spacing="2">${item.name.toUpperCase()}</text>`;

  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="bg" cx="30%" cy="40%" r="70%">
          <stop offset="0%"   stop-color="#0a1628" stop-opacity="1"/>
          <stop offset="100%" stop-color="${BRAND.bg}" stop-opacity="1"/>
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="${BRAND.blue}" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="${BRAND.blue}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <ellipse cx="540" cy="${height / 2}" rx="500" ry="400" fill="url(#glow)"/>
      ${decSvg}
      ${textSvgs}
      ${labelSvg}
    </svg>`);

  return sharp(svg).jpeg(BRAND.jpeg);
}

/**
 * Slide 3: CTA — full brand screen + link + logo
 */
async function buildSlide3(item) {
  const { width, height } = BRAND.slide;

  // Logo composite (varsa)
  const logoLayer = HAS_LOGO
    ? `<image href="data:image/svg+xml;base64,${
        Buffer.from(readFileSync(LOGO_PATH)).toString('base64')
      }" x="${(width - 200) / 2}" y="280" width="200" height="200" opacity="0.95"/>`
    : `<circle cx="540" cy="380" r="90" fill="${BRAND.blue}" opacity="0.3"/>
       <text x="540" y="400" font-family="Orbitron, Arial Black, sans-serif"
         font-size="60" font-weight="900" fill="${BRAND.blue}"
         text-anchor="middle">KI</text>`;

  // Hashtag örnekleri (ilk 4)
  const tags    = item.hashtags.slice(0, 4).join('  ');
  const ctaText = 'Tüm antik kentleri keşfet →';

  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="bg3" cx="50%" cy="35%" r="70%">
          <stop offset="0%"   stop-color="#0d1f3c" stop-opacity="1"/>
          <stop offset="100%" stop-color="${BRAND.bg}" stop-opacity="1"/>
        </radialGradient>
        <radialGradient id="glow3" cx="50%" cy="35%" r="45%">
          <stop offset="0%"   stop-color="${BRAND.gold}" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="${BRAND.gold}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg3)"/>
      <ellipse cx="540" cy="420" rx="420" ry="340" fill="url(#glow3)"/>

      <!-- Logo -->
      ${logoLayer}

      <!-- Kalkan Info başlık -->
      <text x="540" y="560"
        font-family="Orbitron, Arial Black, sans-serif"
        font-size="52" font-weight="900" fill="${BRAND.gold}"
        text-anchor="middle" letter-spacing="3">KALKAN INFO</text>

      <!-- CTA pill -->
      <rect x="140" y="640" width="800" height="88" rx="44"
        fill="${BRAND.blue}" opacity="0.95"/>
      <text x="540" y="696"
        font-family="Inter, Arial, sans-serif"
        font-size="36" font-weight="700" fill="${BRAND.white}"
        text-anchor="middle">${ctaText}</text>

      <!-- URL -->
      <text x="540" y="810"
        font-family="Inter, Arial, sans-serif"
        font-size="44" font-weight="800" fill="${BRAND.white}"
        text-anchor="middle" letter-spacing="1">kalkaninfo.com</text>

      <!-- Divider -->
      <line x1="180" y1="880" x2="900" y2="880"
        stroke="${BRAND.blue}" stroke-width="2" opacity="0.4"/>

      <!-- Hashtags -->
      <text x="540" y="950"
        font-family="Inter, Arial, sans-serif"
        font-size="26" fill="${BRAND.blue}" opacity="0.8"
        text-anchor="middle">${tags.replace(/&/g,'&amp;')}</text>

      <!-- Item name küçük -->
      <text x="540" y="${height - 80}"
        font-family="Orbitron, Arial Black, sans-serif"
        font-size="24" fill="${BRAND.white}" opacity="0.35"
        text-anchor="middle" letter-spacing="4">${item.name.toUpperCase()}</text>
    </svg>`);

  return sharp(svg).jpeg(BRAND.jpeg);
}

// ── Build + upload for one item ───────────────────────────────────────────────
async function processItem(item) {
  if (item.local_assets.length === 0) {
    console.warn(`⚠️  SKIP ${item.id} — local_assets boş (Faz 3'e bırakıldı)`);
    return null;
  }

  console.log(`\n🔨 Building: ${item.id} (${item.local_assets.length} source assets)`);

  const outDir = resolve(ROOT, 'dist', 'social', item.id);
  if (!DRY) mkdirSync(outDir, { recursive: true });

  // Kaynak görsel: ilk local_asset
  const srcRelPath = item.local_assets[0];
  const srcAbs     = resolve(ROOT, srcRelPath.replace(/^\//, ''));

  if (!existsSync(srcAbs)) {
    console.warn(`⚠️  SKIP ${item.id} — kaynak görsel bulunamadı: ${srcAbs}`);
    return null;
  }

  // Slaytları oluştur
  const slide1 = await buildSlide1(item, srcAbs);
  const slide2 = await buildSlide2(item);
  const slide3 = await buildSlide3(item);

  const out1 = join(outDir, 'slide-1.jpg');
  const out2 = join(outDir, 'slide-2.jpg');
  const out3 = join(outDir, 'slide-3.jpg');

  if (!DRY) {
    await slide1.toFile(out1);
    await slide2.toFile(out2);
    await slide3.toFile(out3);
    console.log(`  ✅ Slaytlar yazıldı: ${outDir}`);
  } else {
    console.log(`  [dry-run] Slaytlar yazılacaktı: ${outDir}`);
    return { id: item.id, urls: ['(dry-run)', '(dry-run)', '(dry-run)'] };
  }

  // Supabase Storage'a yükle
  console.log(`  ☁️  Storage upload: social-media/${item.id}/`);
  const remote1 = `${item.id}/slide-1.jpg`;
  const remote2 = `${item.id}/slide-2.jpg`;
  const remote3 = `${item.id}/slide-3.jpg`;

  const [url1, url2, url3] = await Promise.all([
    uploadAsset(out1, remote1),
    uploadAsset(out2, remote2),
    uploadAsset(out3, remote3)
  ]);

  console.log(`  🔗 ${url1}`);
  console.log(`  🔗 ${url2}`);
  console.log(`  🔗 ${url3}`);

  // social_posts tablosunu güncelle: bu content_pack_id için local_assets güncelle
  const urls = [url1, url2, url3];
  const res = await supaFetch(
    `/social_posts?content_pack_id=eq.${item.id}&select=id`,
    { headers: { Prefer: 'return=representation' } }
  );

  if (res.ok) {
    const rows = await res.json();
    if (rows.length > 0) {
      // Her matching row'u güncelle
      await supaFetch(
        `/social_posts?content_pack_id=eq.${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ local_assets: urls })
        }
      );
      console.log(`  📝 social_posts güncellendi (${rows.length} satır)`);
    } else {
      console.log(`  ℹ️  social_posts'ta ${item.id} için kayıt yok — atlandı`);
    }
  }

  return { id: item.id, urls };
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`\n🚀 build-carousel-assets.mjs başlıyor`);
console.log(`   Mod: ${ALL ? 'ALL' : `pack=${packArg}`}${DRY ? ' [DRY-RUN]' : ''}`);
console.log(`   Hedef: ${targets.length} item\n`);

const results = [];
for (const item of targets) {
  try {
    const r = await processItem(item);
    if (r) results.push(r);
  } catch (err) {
    console.error(`❌ ${item.id} hata: ${err.message}`);
  }
}

console.log('\n── Özet ─────────────────────────────────────────────────────');
console.log(`Başarılı: ${results.length} / ${targets.length}`);
results.forEach(r => {
  console.log(`  ${r.id}:`);
  r.urls.forEach((u, i) => console.log(`    slide-${i + 1}: ${u}`));
});
console.log('─────────────────────────────────────────────────────────────\n');
