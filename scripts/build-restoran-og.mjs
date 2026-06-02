#!/usr/bin/env node
/**
 * 27 restoran icin 1200x630 Open Graph PNG uretici.
 * Yontem: Puppeteer headless → inline HTML → screenshot.
 * Cikti: assets/og/restoran/<slug>.png
 * Kullanim: node scripts/build-restoran-og.mjs [slug1 slug2 ...]
 */
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
const data = JSON.parse(await readFile(join(root, 'data', 'restoranlar.json'), 'utf8'));
const targets = args.length ? args : (data.items || []).map(it => it.id);

const REVIEWS_DIR = join(root, 'data', 'restoran-reviews');
const OUT_DIR = join(root, 'assets', 'og', 'restoran');
await mkdir(OUT_DIR, { recursive: true });

// Tema renkleri — build-restoran-pages.mjs ile esit
function theme(category) {
  const map = {
    'Fine Dining':    { bg: '#0d0610', accent: '#d4af37', text: '#e8e2d4' },
    'Deniz Ürünleri': { bg: '#061826', accent: '#4eb1b3', text: '#e1ecf2' },
    'Cafe & Bar':     { bg: '#1a120a', accent: '#e8a55a', text: '#f0e5d6' },
    'Türk Mutfağı':   { bg: '#1a0e0a', accent: '#d97757', text: '#f0e2d4' },
    'Dünya Mutfağı':  { bg: '#0f0f10', accent: '#c9b87f', text: '#e8e3d8' },
    'Pub & Lounge':   { bg: '#0a0d10', accent: '#e8c46c', text: '#e6e4dc' },
    'Gece Kulübü':    { bg: '#0a0410', accent: '#c47ae0', text: '#ecdcf0' },
  };
  return map[category] || map['Dünya Mutfağı'];
}

// Review cache oku
async function loadReview(slug) {
  const p = join(REVIEWS_DIR, `${slug}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}

// Hero image'i base64'e cevir (yerel dosya)
async function heroBase64(imgPath) {
  if (!imgPath) return null;
  const localPath = join(root, imgPath.replace(/^\//, ''));
  if (!existsSync(localPath)) return null;
  const buf = await readFile(localPath);
  const ext = imgPath.split('.').pop().toLowerCase();
  const mime = ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// 1200x630 OG HTML template olustur
function buildOgHtml({ name, category, cuisine, rating, reviewCount, heroDataUrl, t }) {
  const ratingText = rating ? `★ ${Number(rating).toFixed(1)}` : null;
  const reviewText = reviewCount ? `· ${reviewCount} Google yorumu` : null;
  const pillText = ratingText ? (reviewText ? ratingText + ' ' + reviewText : ratingText) : null;
  const cuisineDisplay = cuisine || category;

  // Hero: gercek gorsel veya tema rengi gradient fallback
  const bgStyle = heroDataUrl
    ? `background-image: url('${heroDataUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, ${t.bg} 0%, #1a1a2e 100%);`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600&display=swap');
  body {
    width: 1200px;
    height: 630px;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
    background: ${t.bg};
  }
  .wrap {
    position: relative;
    width: 1200px;
    height: 630px;
    ${bgStyle}
  }
  /* Karanlık overlay */
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      rgba(0,0,0,0.82) 0%,
      rgba(0,0,0,0.65) 45%,
      rgba(0,0,0,0.35) 100%
    );
  }
  /* Blur efekti sadece arka plan icin — clip-path ile sol tarafa */
  .blur-layer {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    mask-image: linear-gradient(to right, black 55%, transparent 80%);
    -webkit-mask-image: linear-gradient(to right, black 55%, transparent 80%);
  }
  /* Sol alt: dikey accent cizgi */
  .accent-bar {
    position: absolute;
    left: 72px;
    top: 80px;
    bottom: 80px;
    width: 4px;
    border-radius: 2px;
    background: ${t.accent};
    opacity: 0.9;
  }
  /* Icerik blogu */
  .content {
    position: absolute;
    left: 104px;
    top: 0;
    bottom: 0;
    width: 740px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0;
  }
  /* Ust sol: KALKAN INFO badge */
  .badge {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.65);
    margin-bottom: 22px;
  }
  /* Restoran adi */
  .restaurant-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 72px;
    font-weight: 800;
    line-height: 1.05;
    color: #ffffff;
    text-shadow: 0 4px 24px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5);
    margin-bottom: 16px;
    max-width: 680px;
    word-break: break-word;
  }
  /* Kategori satiri */
  .category-line {
    font-size: 17px;
    font-weight: 500;
    color: ${t.accent};
    letter-spacing: 0.04em;
    margin-bottom: 0;
  }
  /* Sag alt: rating pill */
  .rating-pill {
    position: absolute;
    right: 72px;
    bottom: 72px;
    background: ${t.accent};
    color: ${t.bg};
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 40px;
    white-space: nowrap;
    letter-spacing: 0.02em;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  /* Sag ust: kucuk logo mark */
  .logo-mark {
    position: absolute;
    right: 72px;
    top: 60px;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .logo-mark .diamond {
    font-size: 14px;
    color: ${t.accent};
  }
  /* kalkaninfo.com alt sag */
  .site-domain {
    position: absolute;
    right: 72px;
    bottom: 120px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.35);
  }
</style>
</head>
<body>
<div class="wrap">
  ${heroDataUrl ? '<div class="blur-layer"></div>' : ''}
  <div class="overlay"></div>
  <div class="accent-bar"></div>

  <div class="content">
    <div class="badge">KALKAN INFO</div>
    <div class="restaurant-name">${escHtml(name)}</div>
    <div class="category-line">${escHtml(cuisineDisplay)}${category !== cuisineDisplay ? ' · ' + escHtml(category) : ''}</div>
  </div>

  ${pillText ? `<div class="rating-pill">${escHtml(pillText)}</div>` : ''}
  <div class="site-domain">kalkaninfo.com</div>
  <div class="logo-mark"><span class="diamond">◆</span> KALKAN INFO</div>
</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Puppeteer baslatma — bir kez aciyor
console.log('Puppeteer baslatiliyor...');
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-web-security'],
});

const results = [];

for (const slug of targets) {
  const r = (data.items || []).find(x => x.id === slug);
  if (!r) { console.warn(`  ATLANDI: ${slug} bulunamadi`); continue; }

  const t = theme(r.category);
  const reviewCache = await loadReview(slug);
  const rating = reviewCache?.place?.rating ?? r.rating ?? null;
  const reviewCount = reviewCache?.place?.reviews ?? r.reviewCount ?? null;
  const heroDataUrl = await heroBase64(r.image);

  const html = buildOgHtml({
    name: r.name,
    category: r.category,
    cuisine: r.cuisine || r.category,
    rating,
    reviewCount,
    heroDataUrl,
    t,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

  // HTML'i data URL olarak yukle (dosya sistemi yerine — font CDN icin network gerekiyor)
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

  // Font yuklenmesini bekle (max 2s)
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // JPEG quality 85 — ~80KB hedef (PNG ~500KB olur)
  const outPath = join(OUT_DIR, `${slug}.jpg`);
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await page.close();

  const stat = await import('node:fs').then(m => m.statSync(outPath));
  const kb = Math.round(stat.size / 1024);
  results.push({ slug, name: r.name, kb });
  console.log(`  + ${r.name} (${kb} KB) → assets/og/restoran/${slug}.jpg`);
}

await browser.close();

console.log(`\n=== TAMAMLANDI: ${results.length}/${targets.length} PNG ===`);
const avgKb = results.length ? Math.round(results.reduce((s, r) => s + r.kb, 0) / results.length) : 0;
console.log(`Ortalama boyut: ${avgKb} KB`);
