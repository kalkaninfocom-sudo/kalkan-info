#!/usr/bin/env node
/**
 * scripts/ig-event-card.mjs — Kalkan Info tarzı ETKİNLİK reklam kartı (1080×1350 JPEG)
 *
 * Puppeteer → inline HTML → JPEG (IG feed PNG'i reddediyor: 9004 → JPEG şart).
 * Etkinlik takvimindeki bir oneoff kaydından kalkan-info markalı gece/sinema temalı promo kartı üretir.
 *
 * Kullanım:
 *   node scripts/ig-event-card.mjs oneoff-indigo-movie-20260716
 *   node scripts/ig-event-card.mjs            # takvimdeki ilk yaklaşan oneoff
 * Çıktı: assets/ig-events/<id>.jpg  → https://www.kalkaninfo.com/assets/ig-events/<id>.jpg
 */
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'ig-events');

const MONTHS = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
const DAYS = ['PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ'];
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Etkinlik tipine göre ikon/etiket (kart üst rozeti).
const TYPE = {
  'Sinema Gecesi': { icon: '🎬', tag: 'AÇIK HAVA SİNEMA' },
  'Canlı Müzik':   { icon: '🎸', tag: 'CANLI MÜZİK' },
  DJ:              { icon: '🎧', tag: 'DJ GECESİ' },
  Parti:           { icon: '🎉', tag: 'PARTİ' },
  Festival:        { icon: '🎪', tag: 'FESTİVAL' },
};

function cardHtml(ev) {
  const d = new Date(ev.date + 'T12:00:00');
  const dayName = DAYS[d.getDay()];
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const t = TYPE[ev.type] || { icon: '🎫', tag: (ev.type || 'ETKİNLİK').toLocaleUpperCase('tr') };
  const timeStr = ev.endTime ? `${ev.time} – ${ev.endTime}` : ev.time;
  // Başlıktan ana ad + alt açıklama ayır ("Movie Night: Grease — ...").
  const raw = ev.title || '';
  const mainTitle = (raw.split(/[:—–-]/)[0] || 'ETKİNLİK').trim();
  const subTitle = raw.replace(mainTitle, '').replace(/^[\s:—–-]+/, '').trim();

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,700;0,900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1350px;font-family:'Inter',sans-serif;}
  .card{position:relative;width:1080px;height:1350px;overflow:hidden;color:#fff;
    background:
      radial-gradient(ellipse 90% 55% at 50% 8%, rgba(232,152,18,.28) 0%, transparent 60%),
      radial-gradient(ellipse 120% 70% at 50% 105%, rgba(232,80,30,.35) 0%, transparent 55%),
      linear-gradient(180deg, #0a2138 0%, #071a2e 45%, #04101d 100%);}
  /* film grain */
  .grain{position:absolute;inset:0;opacity:.06;background-image:radial-gradient(#fff 1px, transparent 1px);background-size:4px 4px;mix-blend-mode:overlay;}
  /* yıldızlar */
  .stars{position:absolute;inset:0;opacity:.5;background-image:
    radial-gradient(1.5px 1.5px at 15% 12%, #fff, transparent),
    radial-gradient(1px 1px at 32% 8%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 68% 15%, #ffe9c2, transparent),
    radial-gradient(1px 1px at 84% 9%, #fff, transparent),
    radial-gradient(1px 1px at 50% 5%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 90% 20%, #fff, transparent);}
  /* deniz ufku parıltısı */
  .sea{position:absolute;left:0;right:0;bottom:0;height:360px;
    background:linear-gradient(180deg, transparent 0%, rgba(232,120,40,.10) 30%, rgba(10,33,56,.0) 100%);}
  .sea::after{content:'';position:absolute;left:50%;top:40px;transform:translateX(-50%);width:520px;height:2px;
    background:linear-gradient(90deg,transparent,rgba(244,181,61,.9),transparent);filter:blur(1px);}
  /* film şeridi kenarları */
  .strip{position:absolute;top:0;bottom:0;width:34px;background:#05101c;
    background-image:repeating-linear-gradient(180deg,#05101c 0 44px,#e8a012 44px 66px);opacity:.9;}
  .strip.l{left:0;} .strip.r{right:0;}
  .inner{position:absolute;inset:0;padding:70px 70px;display:flex;flex-direction:column;}

  .brand{display:flex;align-items:center;gap:10px;font-family:'Montserrat';font-weight:800;font-size:26px;letter-spacing:2px;}
  .brand .d{color:#f4b53d;}
  .brand .sep{margin:0 6px;opacity:.4;}
  .brand .k{font-weight:600;letter-spacing:3px;font-size:20px;color:#bcd2e6;}

  .tag{margin-top:44px;display:inline-flex;align-items:center;gap:12px;align-self:flex-start;
    font-family:'Montserrat';font-weight:800;font-size:22px;letter-spacing:3px;color:#f4b53d;
    background:rgba(232,152,18,.12);border:1.5px solid rgba(244,181,61,.5);border-radius:999px;padding:12px 24px;}

  .headwrap{margin-top:auto;margin-bottom:auto;}
  .kicker{font-family:'Montserrat';font-weight:700;font-size:30px;letter-spacing:6px;color:#8fb8d6;text-transform:uppercase;}
  .title{font-family:'Playfair Display';font-weight:900;font-size:150px;line-height:.92;letter-spacing:-2px;margin-top:10px;
    text-shadow:0 6px 50px rgba(0,0,0,.5);}
  .title em{font-style:italic;font-weight:700;color:#f4b53d;display:block;font-size:120px;}
  .sub{font-family:'Inter';font-weight:500;font-size:34px;line-height:1.4;color:#d7e6f2;margin-top:28px;max-width:800px;}

  .venue{display:flex;align-items:center;gap:14px;margin-top:34px;font-family:'Montserrat';font-weight:800;font-size:40px;color:#fff;}
  .venue .pin{color:#f4b53d;font-size:34px;}

  .infobar{margin-top:44px;display:flex;gap:0;border-top:1.5px solid rgba(255,255,255,.14);border-bottom:1.5px solid rgba(255,255,255,.14);}
  .info{flex:1;padding:26px 10px;text-align:center;}
  .info + .info{border-left:1.5px solid rgba(255,255,255,.14);}
  .info .l{font-family:'Inter';font-weight:500;font-size:22px;letter-spacing:2px;color:#8fb8d6;text-transform:uppercase;}
  .info .v{font-family:'Montserrat';font-weight:800;font-size:46px;color:#fff;margin-top:6px;}

  .cta{margin-top:auto;display:flex;align-items:center;justify-content:space-between;}
  .cta .u{font-family:'Montserrat';font-weight:800;font-size:30px;letter-spacing:1px;color:#f4b53d;}
  .cta .b{font-family:'Inter';font-weight:500;font-size:22px;color:#9db8cf;}
</style></head>
<body>
  <div class="card">
    <div class="stars"></div>
    <div class="sea"></div>
    <div class="grain"></div>
    <div class="strip l"></div><div class="strip r"></div>
    <div class="inner">
      <div class="brand"><span class="d">◆</span> KALKAN <span class="d">INFO</span><span class="sep">·</span><span class="k">ETKİNLİK</span></div>

      <div class="tag">${t.icon} ${esc(t.tag)}</div>

      <div class="headwrap">
        <div class="kicker">${esc(ev.area || 'Kalkan')} · Bu ${esc(dayName.charAt(0) + dayName.slice(1).toLocaleLowerCase('tr'))}</div>
        <div class="title">${esc(mainTitle.split(' ')[0] || mainTitle)}<em>${esc(mainTitle.split(' ').slice(1).join(' '))}</em></div>
        ${subTitle ? `<div class="sub">${esc(subTitle)}</div>` : ''}
        <div class="venue"><span class="pin">◉</span> ${esc(ev.venueName)}</div>
      </div>

      <div class="infobar">
        <div class="info"><div class="l">Tarih</div><div class="v">${esc(dateStr)}</div></div>
        <div class="info"><div class="l">Saat</div><div class="v">${esc(ev.time)}</div></div>
        <div class="info"><div class="l">Gün</div><div class="v">${esc(dayName)}</div></div>
      </div>

      <div class="cta"><span class="u">kalkaninfo.com/etkinlikler</span><span class="b">Kalkan'da bu hafta neler var?</span></div>
    </div>
  </div>
</body></html>`;
}

async function loadEvent(id) {
  const cal = JSON.parse(await readFile(join(ROOT, 'data', 'etkinlik-takvimi.json'), 'utf8'));
  const all = cal.oneoff || [];
  if (id) return all.find((e) => e.id === id) || null;
  const today = new Date().toISOString().slice(0, 10);
  return all.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export async function generateEventCard({ id, outDir = OUT_DIR } = {}) {
  const ev = await loadEvent(id);
  if (!ev) throw new Error('Etkinlik bulunamadı: ' + (id || '(yaklaşan yok)'));
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    await page.setContent(cardHtml(ev), { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 350)); // font yerleşsin
    const outPath = join(outDir, `${ev.id}.jpg`);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 92, fullPage: false });
    const kb = Math.round((await stat(outPath)).size / 1024);
    return { outPath, publicPath: `/assets/ig-events/${ev.id}.jpg`, kb, ev };
  } finally {
    await browser.close();
  }
}

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2] || null;
  generateEventCard({ id })
    .then((r) => console.log(`✓ ${r.outPath} (${r.kb} KB)\n  public: ${r.publicPath}\n  etkinlik: ${r.ev.venueName} — ${r.ev.title}`))
    .catch((e) => { console.error('✗', e.message); process.exit(1); });
}
