#!/usr/bin/env node
/**
 * Satış PDF üreteci — her mekana özel "Dijital Durum Raporu".
 * İçerik: teklif-data.json (before/after) + restoranlar.json (foto/Google verisi).
 * Çıktı: dist/satis-pdf/<slug>.pdf  (+ ilk mekan için önizleme PNG).
 *
 * Kullanım:
 *   node scripts/agency/build-satis-pdf.mjs --today          # bugünkü 5 mekan
 *   node scripts/agency/build-satis-pdf.mjs zeugma-restorant  # tek mekan
 *   node scripts/agency/build-satis-pdf.mjs --all            # arama listesindeki hepsi
 *   ...ekle --preview  → ilk mekan için PNG önizleme de üret
 *
 * Marka (MARKA_STRATEJISI): zemin #FAF6EF · metin #0E1A24 · altın #E8A020 · teal vurgu.
 * Gerçek foto zorunlu (stok yok). Vercel'e dokunmaz — yerel/CI script.
 */
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'dist', 'satis-pdf');
mkdirSync(OUT, { recursive: true });

const TODAY = ['zeugma-restorant', 'adams-restaurant-kalkan', 'rose-restaurant', 'mantici-guru-guru-s-placee', 'luna-restaurant-bar'];
const WA = '+90 553 898 87 61'; // Kalkan Info iletişim (SATIS_HEDEF deseni)

const slugify = s => String(s || '').replace(/[çğıİöşüÇĞÖŞÜ]/g, m => ({ç:'c',ğ:'g',ı:'i',İ:'i',ö:'o',ş:'s',ü:'u',Ç:'c',Ğ:'g',Ö:'o',Ş:'s',Ü:'u'}[m] || m)).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const restRaw = JSON.parse(readFileSync(join(ROOT, 'data', 'restoranlar.json'), 'utf8'));
const rest = Array.isArray(restRaw) ? restRaw : (restRaw.items || restRaw.restoranlar || Object.values(restRaw)[0]);
const byId = new Map(rest.map(r => [r.id, r]));

const teklifRaw = JSON.parse(readFileSync(join(ROOT, 'satis-demo', 'teklif-data.json'), 'utf8'));
const teklifArr = Array.isArray(teklifRaw) ? teklifRaw : (teklifRaw.isletmeler || Object.values(teklifRaw));
const teklifBySlug = new Map(teklifArr.map(b => [slugify(b.name), b]));

const args = process.argv.slice(2);
const preview = args.includes('--preview');
let slugs;
if (args.includes('--today')) slugs = TODAY;
else if (args.includes('--all')) {
  slugs = readdirSync(join(ROOT, 'demo'), { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(ROOT, 'demo', d.name, 'index.html')))
    .map(d => d.name).filter(s => !['ciku', 'assets'].includes(s) && !s.startsWith('_'));
} else slugs = args.filter(a => !a.startsWith('--'));
if (!slugs.length) slugs = TODAY;

function imgDataUri(imgPath) {
  try {
    const p = join(ROOT, imgPath.replace(/^\//, ''));
    if (!existsSync(p)) return null;
    const b64 = readFileSync(p).toString('base64');
    const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${b64}`;
  } catch { return null; }
}

function html(slug) {
  const r = byId.get(slug) || {};
  const t = teklifBySlug.get(slug);
  const name = r.name || (t && t.name) || slug.replace(/-/g, ' ');
  const rating = r.rating || '';
  const reviews = r.reviewCount || 0;
  const price = r.priceRange || '';
  const loc = r.location || (t && t.facts && t.facts.beforeNote) || 'Kalkan, Kaş/Antalya';
  const heroImg = imgDataUri(r.image || (r.gallery && r.gallery[0]) || '');
  const f = (t && t.facts) || { before: [], after: [] };
  const before = (f.before || []).slice(0, 5);
  const after = (f.after || []).slice(0, 6);
  const demoUrl = `kalkaninfo.com/demo/${slug}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&color=0E1A24&bgcolor=FAF6EF&data=${encodeURIComponent('https://' + demoUrl)}`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:0}
html,body{width:210mm;background:#FAF6EF;color:#0E1A24;font-family:'Inter',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;padding:14mm 15mm 12mm;display:flex;flex-direction:column;background:
  radial-gradient(120% 80% at 100% 0%, rgba(232,160,32,.10), transparent 55%),
  radial-gradient(90% 60% at 0% 100%, rgba(20,120,120,.06), transparent 50%), #FAF6EF}
.brandbar{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(14,26,36,.12);padding-bottom:9px;margin-bottom:16px}
.brand{font-family:'Fraunces',serif;font-weight:700;font-size:15px;letter-spacing:-.01em}
.brand b{color:#E8A020}
.kicker{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#7a6a4e;font-weight:600}
.hero{position:relative;width:100%;height:74mm;border-radius:16px;overflow:hidden;
  box-shadow:0 20px 44px -16px rgba(14,26,36,.5),0 4px 12px -4px rgba(232,160,32,.22)}
.hero img{width:100%;height:100%;object-fit:cover;filter:saturate(1.06) contrast(1.03)}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(14,26,36,.82),rgba(14,26,36,.15) 55%,rgba(14,26,36,.32))}
.hero-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0E1A24;color:#E8A020;font-family:'Fraunces',serif;font-size:40px}
.hero-txt{position:absolute;left:24px;right:24px;bottom:20px;color:#F7F1E4;z-index:2}
.hero-txt h1{font-family:'Fraunces',serif;font-weight:700;font-size:40px;line-height:1;letter-spacing:-.03em;margin-bottom:10px;text-shadow:0 2px 20px rgba(0,0,0,.4)}
.hero-txt .meta{display:flex;gap:16px;align-items:center;font-size:13px;font-weight:500}
.hero-txt .meta .star{color:#F2C24B;font-weight:700}
.hero-txt .loc{font-size:11px;opacity:.82;margin-top:5px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
.card{border-radius:14px;padding:16px 17px}
.card.now{background:#fff;border:1px solid rgba(14,26,36,.08);box-shadow:0 10px 26px -18px rgba(14,26,36,.35)}
.card.with{background:linear-gradient(180deg,#141F27,#0E1A24);color:#F3ECDD;box-shadow:0 16px 34px -16px rgba(14,26,36,.55)}
.card h2{font-family:'Fraunces',serif;font-size:15px;font-weight:600;margin-bottom:11px;display:flex;align-items:center;gap:7px}
.card.now h2{color:#b04a2f}
.card.with h2{color:#E8A020}
.tag{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:20px}
.card.now .tag{background:#fbeae4;color:#b04a2f}
.card.with .tag{background:rgba(232,160,32,.18);color:#E8A020}
ul{list-style:none}
li{font-size:11.5px;line-height:1.5;padding:7px 0 7px 20px;position:relative}
.card.now li{border-bottom:1px solid rgba(14,26,36,.06)}
.card.with li{border-bottom:1px solid rgba(255,255,255,.07)}
li:last-child{border-bottom:none}
.card.now li:before{content:"—";position:absolute;left:0;color:#c07a5f}
.card.with li:before{content:"✓";position:absolute;left:0;color:#E8A020;font-weight:700}
li strong{font-weight:600}
.note{font-size:9.5px;margin-top:9px;opacity:.75}
.cta{margin-top:20px;background:linear-gradient(100deg,#E8A020,#f2b53d);border-radius:16px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;box-shadow:0 14px 30px -14px rgba(232,160,32,.6)}
.cta-txt .ct-k{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#5a3d05;font-weight:700}
.cta-txt .ct-t{font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:#22160a;margin-top:2px;letter-spacing:-.02em}
.cta-txt .ct-u{font-size:13px;font-weight:600;color:#3a2a0a;margin-top:4px}
.cta-txt .ct-s{font-size:10.5px;color:#5a3d05;margin-top:6px;max-width:340px}
.qr{width:74px;height:74px;border-radius:10px;background:#FAF6EF;padding:5px;flex:0 0 auto}
.qr img{width:100%;height:100%}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}
.step{background:#fff;border:1px solid rgba(14,26,36,.08);border-radius:12px;padding:14px 15px;box-shadow:0 8px 22px -18px rgba(14,26,36,.35)}
.step .num{font-family:'Fraunces',serif;font-weight:700;font-size:15px;color:#E8A020;margin-bottom:5px}
.step .st{font-family:'Fraunces',serif;font-size:12.5px;font-weight:600;margin-bottom:3px}
.step .sd{font-size:10px;color:#6a7580;line-height:1.45}
.foot{margin-top:auto;padding-top:14px;border-top:1px solid rgba(14,26,36,.12);display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#5a6570}
.foot b{color:#0E1A24}
</style></head>
<body><div class="page">
  <div class="brandbar"><div class="brand">KALKAN<b>INFO</b></div><div class="kicker">İşletmenize Özel · Dijital Durum Raporu</div></div>
  <div class="hero">${heroImg ? `<img src="${heroImg}" alt="">` : `<div class="hero-fallback">${name.slice(0,2).toUpperCase()}</div>`}
    <div class="hero-txt"><h1>${name}</h1><div class="meta">${rating ? `<span class="star">★ ${rating}</span>` : ''}${reviews ? `<span>${reviews} Google yorumu</span>` : ''}${price ? `<span>${price}</span>` : ''}</div><div class="loc">${loc}</div></div>
  </div>
  <div class="cols">
    <div class="card now"><h2><span class="tag">Şu an</span> Dijitalde eksik</h2><ul>${before.map(b => `<li>${b}</li>`).join('')}</ul>${f.beforeNote ? `<div class="note">${f.beforeNote}</div>` : ''}</div>
    <div class="card with"><h2><span class="tag">Kalkan Info ile</span> Ne değişir</h2><ul>${after.map(a => `<li>${a}</li>`).join('')}</ul>${f.afterNote ? `<div class="note">${f.afterNote}</div>` : ''}</div>
  </div>
  <div class="cta">
    <div class="cta-txt"><div class="ct-k">Demonuz hazır — bugün canlı</div><div class="ct-t">Sizin için bir site hazırladık</div><div class="ct-u">${demoUrl}</div><div class="ct-s">Karekodu okutun ya da linke girin. Satın alma zorunluluğu yok — önce bir bakın.</div></div>
    <div class="qr"><img src="${qr}" alt="QR"></div>
  </div>
  <div class="steps">
    <div class="step"><div class="num">01</div><div class="st">Demoyu inceleyin</div><div class="sd">Yukarıdaki linkten sizin için hazırladığımız siteyi açın.</div></div>
    <div class="step"><div class="num">02</div><div class="st">Birlikte uyarlayalım</div><div class="sd">Menü, foto ve iletişimi gerçek bilgilerinizle güncelleriz.</div></div>
    <div class="step"><div class="num">03</div><div class="st">3 günde yayında</div><div class="sd">Kendi adınıza canlı — tıpkı lamorakalkan.com gibi.</div></div>
  </div>
  <div class="foot"><span>Örnek canlı işimiz: <b>lamorakalkan.com</b></span><span>Berkay · Kalkan Info · WhatsApp <b>${WA}</b></span></div>
</div></body></html>`;
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
let n = 0;
for (const slug of slugs) {
  const page = await browser.newPage();
  await page.setContent(html(slug), { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.evaluateHandle('document.fonts.ready');
  const pdfPath = join(OUT, `${slug}.pdf`);
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (preview && n === 0) {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.screenshot({ path: join(OUT, `_preview-${slug}.png`), fullPage: true });
    console.log('  önizleme →', join(OUT, `_preview-${slug}.png`));
  }
  await page.close();
  n++;
  console.log('PDF →', pdfPath);
}
await browser.close();
console.log(`\n${n} PDF üretildi → ${OUT}`);
