#!/usr/bin/env node
/**
 * scripts/ig-event-card.mjs — Kalkan Info tarzı ETKİNLİK reklam kartı (1080×1350 JPEG), ÇOK DİLLİ
 *
 * Puppeteer → inline HTML → JPEG (IG feed PNG'i reddediyor: 9004 → JPEG şart).
 * Sabit etiketler locale tablosundan, tarih/gün Intl ile lokalize, etkinlik alt-başlığı cheap-llm ile çevrilir.
 * Site 5 dilli: tr, en, de, fr, ru.
 *
 * Kullanım:
 *   node scripts/ig-event-card.mjs oneoff-indigo-movie-20260716            # tr
 *   node scripts/ig-event-card.mjs oneoff-indigo-movie-20260716 en         # tek dil
 *   node scripts/ig-event-card.mjs oneoff-indigo-movie-20260716 --all      # 5 dil birden
 * Çıktı: assets/ig-events/<id>.<lang>.jpg
 */
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cheapLLM } from '../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'ig-events');
const STATE_PATH = join(ROOT, 'data', 'ig-event-card-state.json');
const LANGS = ['tr', 'en', 'de', 'fr', 'ru'];

// Tekrar-dedup durumu (4 reel üreticisindeki *-reel-state.json deseniyle aynı):
// id'siz çalıştırıldığında hep AYNI en-yakın etkinliği basmayı önler.
async function loadUsedIds() {
  try { const s = JSON.parse(await readFile(STATE_PATH, 'utf8')); return Array.isArray(s.used) ? s.used : []; }
  catch { return []; }
}
async function recordUsedId(id) {
  const used = await loadUsedIds();
  const next = [...used.filter((x) => x !== id), id].slice(-30); // son 30, tekrarsız
  try { await writeFile(STATE_PATH, JSON.stringify({ used: next }, null, 2) + '\n'); } catch {}
}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Sabit UI dizeleri (marka kalitesi için elle çeviri; makine çevirisi değil).
const L = {
  tr: { intl: 'tr-TR', brand: 'ETKİNLİK', thisPrefix: 'Bu', date: 'Tarih', time: 'Saat', day: 'Gün',
        ctaSub: "Kalkan'da bu hafta neler var?", cinema: 'AÇIK HAVA SİNEMA', event: 'ETKİNLİK', ctaUrl: 'kalkaninfo.com/etkinlikler' },
  en: { intl: 'en-GB', brand: 'EVENT', thisPrefix: 'This', date: 'Date', time: 'Time', day: 'Day',
        ctaSub: "What's on in Kalkan this week?", cinema: 'OPEN-AIR CINEMA', event: 'EVENT', ctaUrl: 'kalkaninfo.com/events' },
  de: { intl: 'de-DE', brand: 'EVENT', thisPrefix: 'Diesen', date: 'Datum', time: 'Uhrzeit', day: 'Tag',
        ctaSub: 'Was ist diese Woche in Kalkan los?', cinema: 'FREILUFTKINO', event: 'EVENT', ctaUrl: 'kalkaninfo.com/events' },
  fr: { intl: 'fr-FR', brand: 'ÉVÉNEMENT', thisPrefix: 'Ce', date: 'Date', time: 'Heure', day: 'Jour',
        ctaSub: 'Que faire à Kalkan cette semaine ?', cinema: 'CINÉMA EN PLEIN AIR', event: 'ÉVÉNEMENT', ctaUrl: 'kalkaninfo.com/events' },
  ru: { intl: 'ru-RU', brand: 'СОБЫТИЕ', thisPrefix: 'В этот', date: 'Дата', time: 'Время', day: 'День',
        ctaSub: 'Что происходит в Калкане на этой неделе?', cinema: 'КИНО ПОД ОТКРЫТЫМ НЕБОМ', event: 'СОБЫТИЕ', ctaUrl: 'kalkaninfo.com/events' },
};

// Etkinlik tipi → ikon + lokalize etiket.
function typeInfo(ev, s) {
  const map = { 'Sinema Gecesi': { icon: '🎬', tag: s.cinema }, 'Canlı Müzik': { icon: '🎸', tag: s.event },
    DJ: { icon: '🎧', tag: s.event }, Parti: { icon: '🎉', tag: s.event }, Festival: { icon: '🎪', tag: s.event } };
  return map[ev.type] || { icon: '🎫', tag: s.event };
}

// Etkinlik alt-başlığını hedef dile çevir (cheap-llm angarya; hata olursa orijinali koru).
async function translateSub(text, lang) {
  if (!text || lang === 'tr') return text;
  const names = { en: 'English', de: 'German', fr: 'French', ru: 'Russian' };
  try {
    const { text: out } = await cheapLLM(
      `Translate this short event tagline to ${names[lang]}. Keep proper nouns (Grease) as-is. Return ONLY the translation, no quotes:\n${text}`,
      { maxTokens: 120, temperature: 0.3, timeoutMs: 30000 });
    return (out || text).replace(/^["']|["']$/g, '').trim();
  } catch { return text; }
}

function cardHtml(ev, lang, subTitle) {
  const s = L[lang] || L.tr;
  const d = new Date(ev.date + 'T12:00:00');
  const dayName = new Intl.DateTimeFormat(s.intl, { weekday: 'long' }).format(d);
  const dayUpper = dayName.toLocaleUpperCase(s.intl);
  const dateStr = new Intl.DateTimeFormat(s.intl, { day: 'numeric', month: 'long' }).format(d).toLocaleUpperCase(s.intl);
  const t = typeInfo(ev, s);
  const raw = ev.title || '';
  const mainTitle = (raw.split(/[:—–-]/)[0] || 'Movie Night').trim();

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,700;0,900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1350px;font-family:'Inter',sans-serif;}
  .card{position:relative;width:1080px;height:1350px;overflow:hidden;color:#fff;
    background:
      radial-gradient(ellipse 90% 55% at 50% 8%, rgba(232,152,18,.28) 0%, transparent 60%),
      radial-gradient(ellipse 120% 70% at 50% 105%, rgba(232,80,30,.35) 0%, transparent 55%),
      linear-gradient(180deg, #0a2138 0%, #071a2e 45%, #04101d 100%);}
  .grain{position:absolute;inset:0;opacity:.06;background-image:radial-gradient(#fff 1px, transparent 1px);background-size:4px 4px;mix-blend-mode:overlay;}
  .stars{position:absolute;inset:0;opacity:.5;background-image:
    radial-gradient(1.5px 1.5px at 15% 12%, #fff, transparent),
    radial-gradient(1px 1px at 32% 8%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 68% 15%, #ffe9c2, transparent),
    radial-gradient(1px 1px at 84% 9%, #fff, transparent),
    radial-gradient(1px 1px at 50% 5%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 90% 20%, #fff, transparent);}
  .sea{position:absolute;left:0;right:0;bottom:0;height:360px;background:linear-gradient(180deg, transparent 0%, rgba(232,120,40,.10) 30%, rgba(10,33,56,0) 100%);}
  .sea::after{content:'';position:absolute;left:50%;top:40px;transform:translateX(-50%);width:520px;height:2px;background:linear-gradient(90deg,transparent,rgba(244,181,61,.9),transparent);filter:blur(1px);}
  .strip{position:absolute;top:0;bottom:0;width:34px;background:#05101c;background-image:repeating-linear-gradient(180deg,#05101c 0 44px,#e8a012 44px 66px);opacity:.9;}
  .strip.l{left:0;} .strip.r{right:0;}
  .inner{position:absolute;inset:0;padding:70px 70px;display:flex;flex-direction:column;}
  .brand{display:flex;align-items:center;gap:10px;font-family:'Montserrat';font-weight:800;font-size:26px;letter-spacing:2px;}
  .brand .d{color:#f4b53d;} .brand .sep{margin:0 6px;opacity:.4;} .brand .k{font-weight:600;letter-spacing:3px;font-size:20px;color:#bcd2e6;}
  .tag{margin-top:44px;display:inline-flex;align-items:center;gap:12px;align-self:flex-start;font-family:'Montserrat';font-weight:800;font-size:22px;letter-spacing:3px;color:#f4b53d;background:rgba(232,152,18,.12);border:1.5px solid rgba(244,181,61,.5);border-radius:999px;padding:12px 24px;}
  .headwrap{margin-top:auto;margin-bottom:auto;}
  .kicker{font-family:'Montserrat';font-weight:700;font-size:30px;letter-spacing:6px;color:#8fb8d6;text-transform:uppercase;}
  .title{font-family:'Playfair Display';font-weight:900;font-size:150px;line-height:.92;letter-spacing:-2px;margin-top:10px;text-shadow:0 6px 50px rgba(0,0,0,.5);}
  .title em{font-style:italic;font-weight:700;color:#f4b53d;display:block;font-size:120px;}
  .sub{font-family:'Inter';font-weight:500;font-size:34px;line-height:1.4;color:#d7e6f2;margin-top:28px;max-width:820px;}
  .venue{display:flex;align-items:center;gap:14px;margin-top:34px;font-family:'Montserrat';font-weight:800;font-size:40px;color:#fff;}
  .venue .pin{color:#f4b53d;font-size:34px;}
  .infobar{margin-top:44px;display:flex;border-top:1.5px solid rgba(255,255,255,.14);border-bottom:1.5px solid rgba(255,255,255,.14);}
  .info{flex:1;padding:26px 10px;text-align:center;}
  .info + .info{border-left:1.5px solid rgba(255,255,255,.14);}
  .info .l{font-family:'Inter';font-weight:500;font-size:22px;letter-spacing:2px;color:#8fb8d6;text-transform:uppercase;}
  .info .v{font-family:'Montserrat';font-weight:800;font-size:44px;color:#fff;margin-top:6px;}
  .cta{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:20px;}
  .cta .u{font-family:'Montserrat';font-weight:800;font-size:30px;letter-spacing:1px;color:#f4b53d;white-space:nowrap;}
  .cta .b{font-family:'Inter';font-weight:500;font-size:22px;color:#9db8cf;text-align:right;}
</style></head>
<body>
  <div class="card">
    <div class="stars"></div><div class="sea"></div><div class="grain"></div>
    <div class="strip l"></div><div class="strip r"></div>
    <div class="inner">
      <div class="brand"><span class="d">◆</span> KALKAN <span class="d">INFO</span><span class="sep">·</span><span class="k">${esc(s.brand)}</span></div>
      <div class="tag">${t.icon} ${esc(t.tag)}</div>
      <div class="headwrap">
        <div class="kicker">${esc(ev.area || 'Kalkan')} · ${esc(s.thisPrefix)} ${esc(dayName)}</div>
        <div class="title">${esc(mainTitle.split(' ')[0] || mainTitle)}<em>${esc(mainTitle.split(' ').slice(1).join(' '))}</em></div>
        ${subTitle ? `<div class="sub">${esc(subTitle)}</div>` : ''}
        <div class="venue"><span class="pin">◉</span> ${esc(ev.venueName)}</div>
      </div>
      <div class="infobar">
        <div class="info"><div class="l">${esc(s.date)}</div><div class="v">${esc(dateStr)}</div></div>
        <div class="info"><div class="l">${esc(s.time)}</div><div class="v">${esc(ev.time)}</div></div>
        <div class="info"><div class="l">${esc(s.day)}</div><div class="v">${esc(dayUpper)}</div></div>
      </div>
      <div class="cta"><span class="u">${esc(s.ctaUrl)}</span><span class="b">${esc(s.ctaSub)}</span></div>
    </div>
  </div>
</body></html>`;
}

async function loadEvent(id) {
  const cal = JSON.parse(await readFile(join(ROOT, 'data', 'etkinlik-takvimi.json'), 'utf8'));
  const all = cal.oneoff || [];
  if (id) return all.find((e) => e.id === id) || null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  // Kullanılmamış ilk yaklaşan etkinliği seç; hepsi kullanıldıysa havuzu sıfırla (ilk yaklaşan).
  const used = await loadUsedIds();
  return upcoming.find((e) => !used.includes(e.id)) || upcoming[0];
}

export async function generateEventCard({ id, langs = ['tr'], outDir = OUT_DIR } = {}) {
  const ev = await loadEvent(id);
  if (!ev) throw new Error('Etkinlik bulunamadı: ' + (id || '(yaklaşan yok)'));
  await mkdir(outDir, { recursive: true });
  const rawSub = (ev.title || '').replace((ev.title || '').split(/[:—–-]/)[0], '').replace(/^[\s:—–-]+/, '').trim();

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    for (const lang of langs) {
      const sub = await translateSub(rawSub, lang);
      await page.setContent(cardHtml(ev, lang, sub), { waitUntil: 'load', timeout: 20000 });
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      await new Promise((r) => setTimeout(r, 300));
      const outPath = join(outDir, `${ev.id}.${lang}.jpg`);
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
      const kb = Math.round((await stat(outPath)).size / 1024);
      results.push({ lang, outPath, publicPath: `/assets/ig-events/${ev.id}.${lang}.jpg`, kb });
      console.log(`  ✓ ${lang}: ${ev.id}.${lang}.jpg (${kb} KB)`);
    }
  } finally {
    await browser.close();
  }
  await recordUsedId(ev.id); // rotasyon: sonraki id'siz çalıştırmada bu etkinlik atlanır
  return { ev, results };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  const arg = process.argv[3] || process.argv[2] || '';
  const langs = arg === '--all' || process.argv.includes('--all') ? LANGS : (LANGS.includes(arg) ? [arg] : ['tr']);
  console.log(`Kart üretiliyor (${langs.join(', ')})…`);
  generateEventCard({ id, langs })
    .then((r) => console.log(`✓ ${r.results.length} dil · ${r.ev.venueName} — ${r.ev.title}`))
    .catch((e) => { console.error('✗', e.message); process.exit(1); });
}
