#!/usr/bin/env node
/**
 * scripts/ig-news-card.mjs
 * Haber ajansı tarzı 1080×1080 Instagram haber kartı üretici.
 *
 * Yöntem: Puppeteer headless → inline HTML → PNG screenshot (build-restoran-og.mjs ile aynı pattern).
 * Kaynak: data/haberler.json (items[]). Çıktı: assets/ig-news/<id>.png
 *         → yayınlandığında https://www.kalkaninfo.com/assets/ig-news/<id>.png olarak servis edilir.
 *
 * Kullanım:
 *   node scripts/ig-news-card.mjs                 # en yeni haberi al, kart üret
 *   node scripts/ig-news-card.mjs <haber-id>      # belirli haber
 *
 * Export: generateNewsCard({ item, outDir? }) → { outPath, publicPath, kb }
 *   ig-news-post.mjs bu fonksiyonu çağırır.
 */
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR_DEFAULT = join(ROOT, 'assets', 'ig-news');

// Kategori → rozet rengi (haber ajansı paleti, ciddi tonlar)
const CATEGORY_COLOR = {
  'Asayiş':   '#d72631',
  'Belediye': '#2b6cb0',
  'Gündem':   '#d72631',
  'Plaj':     '#0e8aa0',
  'Hava':     '#4a7fb5',
  'Kültür':   '#9b6dc4',
  'Etkinlik': '#e0892a',
  'Turizm':   '#0e8aa0',
};

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Tarihi "27 HAZİRAN 2026" formatına çevir
function formatDateTR(dateStr) {
  const months = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
    'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Görseli base64'e çevir — yerel dosya veya uzak URL (uzaksa fetch).
async function imageToDataUrl(image) {
  if (!image) return null;
  try {
    if (/^https?:\/\//.test(image)) {
      const res = await fetch(image, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:${ct};base64,${buf.toString('base64')}`;
    }
    const localPath = join(ROOT, image.replace(/^\//, ''));
    if (!existsSync(localPath)) return null;
    const buf = await readFile(localPath);
    const ext = image.split('.').pop().toLowerCase();
    const mime = ext === 'webp' ? 'image/webp'
      : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Başlık uzunluğuna göre font boyutu (1080px genişlikte taşmayı önle)
function headlineSize(title) {
  const len = (title || '').length;
  if (len <= 42) return 64;
  if (len <= 70) return 54;
  if (len <= 100) return 46;
  return 40;
}

function buildCardHtml({ title, category, dateStr, source, imageDataUrl }) {
  const catColor = CATEGORY_COLOR[category] || '#d72631';
  const fontPx = headlineSize(title);
  const imgStyle = imageDataUrl
    ? `background-image: url('${imageDataUrl}'); background-size: cover; background-position: center;`
    : 'background: linear-gradient(135deg, #11161f 0%, #1c2533 100%);';

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap');
  body { width: 1080px; height: 1080px; overflow: hidden; font-family: 'Inter', sans-serif; background: #0a0e14; }
  .card { position: relative; width: 1080px; height: 1080px; background: #0a0e14; display: flex; flex-direction: column; }

  /* ── Üst kırmızı SON DAKİKA bandı ── */
  .topbar { height: 96px; background: #d72631; display: flex; align-items: center; justify-content: space-between;
    padding: 0 48px; flex-shrink: 0; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand .diamond { color: #fff; font-size: 26px; line-height: 1; }
  .brand .name { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: 0.16em;
    text-transform: uppercase; color: #fff; }
  .breaking { display: flex; align-items: center; gap: 12px; font-family: 'Inter', sans-serif; font-weight: 700;
    font-size: 22px; letter-spacing: 0.22em; text-transform: uppercase; color: #fff; }
  .breaking .live-dot { width: 13px; height: 13px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 0 5px rgba(255,255,255,0.28); }

  /* ── Haber görseli ── */
  .media { position: relative; height: 600px; flex-shrink: 0; ${imgStyle} }
  .media .scrim { position: absolute; inset: 0;
    background: linear-gradient(to bottom, rgba(10,14,20,0) 45%, rgba(10,14,20,0.55) 78%, rgba(10,14,20,1) 100%); }
  .cat-badge { position: absolute; top: 32px; left: 48px; background: ${catColor}; color: #fff;
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.14em;
    text-transform: uppercase; padding: 11px 22px; border-radius: 4px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.45); }

  /* ── Alt içerik paneli ── */
  .panel { flex: 1; padding: 44px 48px 40px; display: flex; flex-direction: column; justify-content: space-between;
    background: #0a0e14; }
  .accent-rule { width: 88px; height: 5px; background: #d72631; border-radius: 3px; margin-bottom: 26px; }
  .headline { font-family: 'Playfair Display', Georgia, serif; font-weight: 800; font-size: ${fontPx}px;
    line-height: 1.12; color: #f4f6f8; letter-spacing: -0.01em;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .meta { display: flex; align-items: center; justify-content: space-between; margin-top: 30px;
    padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.12); }
  .source { display: flex; align-items: center; gap: 12px; }
  .source .label { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 500;
    letter-spacing: 0.03em; color: rgba(255,255,255,0.62); }
  .source .src-name { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700;
    color: #e0892a; letter-spacing: 0.02em; }
  .date { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; letter-spacing: 0.08em;
    color: rgba(255,255,255,0.55); }
  .domain { position: absolute; bottom: 0; left: 0; right: 0; height: 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="topbar">
      <div class="brand"><span class="diamond">◆</span><span class="name">Kalkan Info</span></div>
      <div class="breaking"><span class="live-dot"></span>Son Dakika</div>
    </div>

    <div class="media">
      <div class="scrim"></div>
      <div class="cat-badge">${escHtml(category || 'Gündem')}</div>
    </div>

    <div class="panel">
      <div>
        <div class="accent-rule"></div>
        <div class="headline">${escHtml(title)}</div>
      </div>
      <div class="meta">
        <div class="source">
          <span class="label">Kaynak:</span>
          <span class="src-name">${escHtml(source || 'Kalkan Info')}</span>
        </div>
        <div class="date">${escHtml(dateStr)} · kalkaninfo.com</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Tek bir haber öğesinden kart PNG üretir.
 * @returns {{ outPath: string, publicPath: string, kb: number }}
 */
export async function generateNewsCard({ item, outDir = OUT_DIR_DEFAULT, browser: sharedBrowser } = {}) {
  if (!item || !item.id) throw new Error('generateNewsCard: geçerli bir haber item gerekli');

  await mkdir(outDir, { recursive: true });
  const imageDataUrl = await imageToDataUrl(item.image);

  const html = buildCardHtml({
    title: item.title || '',
    category: item.category || 'Gündem',
    dateStr: formatDateTR(item.date),
    source: item.source || 'Kalkan Info',
    imageDataUrl,
  });

  const browser = sharedBrowser || await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-web-security'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const outPath = join(outDir, `${item.id}.png`);
    await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    await page.close();

    const st = await stat(outPath);
    const kb = Math.round(st.size / 1024);
    const publicPath = `/assets/ig-news/${item.id}.png`;
    return { outPath, publicPath, kb, hadImage: !!imageDataUrl };
  } finally {
    if (!sharedBrowser) await browser.close();
  }
}

// ── Standalone çalıştırma ─────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];
  const data = JSON.parse(await readFile(join(ROOT, 'data', 'haberler.json'), 'utf8'));
  const items = data.items || [];
  if (!items.length) { console.error('haberler.json boş'); process.exit(1); }

  const item = arg ? items.find((x) => x.id === arg) : items[0];
  if (!item) { console.error(`Haber bulunamadı: ${arg}`); process.exit(1); }

  console.log(`Kart üretiliyor: ${item.title}`);
  console.log(`  Kategori: ${item.category} | Kaynak: ${item.source} | Görsel: ${item.image ? 'var' : 'yok'}`);

  const r = await generateNewsCard({ item });
  console.log(`\n✅ ${r.outPath}`);
  console.log(`   Public: ${r.publicPath} (${r.kb} KB, görsel ${r.hadImage ? 'gömüldü' : 'fallback gradient'})`);
}

// Sadece doğrudan çalıştırıldığında main() — import edildiğinde değil
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ig-news-card.mjs')) {
  main().catch((e) => { console.error('fatal:', e); process.exit(1); });
}
