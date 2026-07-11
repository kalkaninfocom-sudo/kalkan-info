#!/usr/bin/env node
/**
 * scripts/agency/line-card.mjs — Marka HATTI içerik kartı (1080×1350 JPEG)
 *
 * Bir hattın kuyruğundaki içerik öğesini o hattın MARKA kimliğiyle (accent renk, emoji, ton) görselleştirir.
 * Haber=mavi/ciddi · Magazin=mor/canlı · TV=kırmızı/cesur · Kalkan Info=altın. Dil verilirse başlık/kanca
 * cheap-llm ile o dile çevrilir (sabit etiketler lokalize). "kalkan info tarzı" görsel — hatlar karışmaz.
 *
 * Kullanım:
 *   node scripts/agency/line-card.mjs magazin           # magazin kuyruğu, tr
 *   node scripts/agency/line-card.mjs haber en          # haber kuyruğu, en
 *   node scripts/agency/line-card.mjs magazin tr 1      # sadece ilk öğe
 * Çıktı: assets/agency-cards/<line>-<itemId>.<lang>.jpg
 */
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLines, isSensitive } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'agency-cards');

try {
  for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LABEL = {
  tr: { cta: 'kalkaninfo.com', more: 'Detaylar kalkaninfo.com' },
  en: { cta: 'kalkaninfo.com', more: 'More at kalkaninfo.com' },
  de: { cta: 'kalkaninfo.com', more: 'Mehr auf kalkaninfo.com' },
  fr: { cta: 'kalkaninfo.com', more: 'Plus sur kalkaninfo.com' },
  ru: { cta: 'kalkaninfo.com', more: 'Подробнее на kalkaninfo.com' },
};

async function tr2lang(text, lang) {
  if (!text || lang === 'tr') return text;
  const names = { en: 'English', de: 'German', fr: 'French', ru: 'Russian' };
  try {
    const { text: out } = await cheapLLM(
      `Translate to ${names[lang]}, keep it punchy and short, keep proper nouns. Return ONLY the translation:\n${text}`,
      { maxTokens: 120, temperature: 0.3, timeoutMs: 30000 });
    return (out || text).replace(/^["']|["']$/g, '').trim();
  } catch { return text; }
}

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

function cardHtml(line, item, lang, title, hook) {
  const a = line.accent || '#f4b53d';
  const [r, g, b] = hex2rgb(a);
  const rgba = (o) => `rgba(${r},${g},${b},${o})`;
  const lab = LABEL[lang] || LABEL.tr;
  const cat = (item.category || '').toLocaleUpperCase('tr');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Playfair+Display:wght@800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1350px;font-family:'Inter',sans-serif;}
  .card{position:relative;width:1080px;height:1350px;overflow:hidden;color:#fff;
    background:
      radial-gradient(ellipse 90% 50% at 50% 6%, ${rgba(0.30)} 0%, transparent 60%),
      radial-gradient(ellipse 120% 65% at 50% 108%, ${rgba(0.22)} 0%, transparent 55%),
      linear-gradient(180deg, #0a2138 0%, #071a2e 48%, #04101d 100%);}
  .grain{position:absolute;inset:0;opacity:.05;background-image:radial-gradient(#fff 1px, transparent 1px);background-size:4px 4px;mix-blend-mode:overlay;}
  .edge{position:absolute;left:0;top:0;bottom:0;width:12px;background:linear-gradient(180deg,${a},${rgba(0.3)});}
  .inner{position:absolute;inset:0;padding:74px 74px 66px;display:flex;flex-direction:column;}
  .top{display:flex;align-items:center;gap:14px;}
  .badge{display:inline-flex;align-items:center;gap:12px;font-family:'Montserrat';font-weight:800;font-size:26px;letter-spacing:2px;
    color:#0a1a2b;background:${a};border-radius:999px;padding:12px 26px;}
  .brandline{font-family:'Montserrat';font-weight:700;font-size:20px;letter-spacing:3px;color:#bcd2e6;}
  .cat{margin-top:56px;font-family:'Montserrat';font-weight:700;font-size:26px;letter-spacing:5px;color:${a};text-transform:uppercase;}
  .title{font-family:'Playfair Display';font-weight:900;font-size:98px;line-height:1.02;letter-spacing:-1.5px;margin-top:20px;text-shadow:0 6px 46px rgba(0,0,0,.5);}
  .hook{font-family:'Inter';font-weight:500;font-size:38px;line-height:1.42;color:#d7e6f2;margin-top:34px;max-width:880px;}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:34px;border-top:1.5px solid rgba(255,255,255,.14);}
  .foot .k{font-family:'Montserrat';font-weight:800;font-size:30px;letter-spacing:1px;}
  .foot .k .d{color:${a};}
  .foot .u{font-family:'Inter';font-weight:500;font-size:24px;color:${a};}
  .type{position:absolute;top:74px;right:74px;font-family:'Montserrat';font-weight:800;font-size:20px;letter-spacing:2px;
    color:#8fb8d6;border:1.5px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 14px;text-transform:uppercase;}
</style></head>
<body>
  <div class="card">
    <div class="grain"></div><div class="edge"></div>
    <div class="type">${esc(item.type || 'POST')}</div>
    <div class="inner">
      <div class="top">
        <div class="badge">${line.emoji} ${esc(line.name.toLocaleUpperCase('tr'))}</div>
      </div>
      ${cat ? `<div class="cat">${esc(cat)}</div>` : '<div style="margin-top:56px"></div>'}
      <div class="title">${esc(title)}</div>
      ${hook ? `<div class="hook">${esc(hook)}</div>` : ''}
      <div class="foot">
        <div class="k">KALKAN <span class="d">INFO</span></div>
        <div class="u">${esc(lab.more)}</div>
      </div>
    </div>
  </div>
</body></html>`;
}

export async function renderLineCards({ lineId, lang = 'tr', limit = 99 } = {}) {
  const line = loadLines().lines.find((l) => l.id === lineId);
  if (!line) throw new Error('Hat yok: ' + lineId);
  let q; try { q = JSON.parse(readFileSync(join(ROOT, line.queue), 'utf8')); } catch { q = { items: [] }; }
  // Hassas/trajedi/PII içerik → OTOMATİK kart YOK; 'hold'a al (insan onayı). Sansasyon üretmeyiz.
  const held = [];
  const safe = (q.items || []).filter((i) => {
    if (!i.title) return false;
    if (isSensitive(i)) { i.status = 'hold'; i._holdReason = 'hassas içerik (trajedi/PII) — insan onayı'; held.push(i.id); return false; }
    return true;
  });
  if (held.length) { q.updated = new Date().toISOString(); writeFileSync(join(ROOT, line.queue), JSON.stringify(q, null, 2), 'utf8'); }
  const items = safe.slice(0, limit);
  if (held.length) console.log(`  ⚠ ${held.length} hassas öğe HOLD'a alındı (kart üretilmedi): ${held.join(', ')}`);
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const out = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    for (const it of items) {
      const title = await tr2lang(it.title, lang);
      const hook = await tr2lang(it.hook || '', lang);
      await page.setContent(cardHtml(line, it, lang, title, hook), { waitUntil: 'load', timeout: 20000 });
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      await new Promise((r) => setTimeout(r, 300));
      const file = join(OUT, `${lineId}-${it.id}.${lang}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
      out.push({ id: it.id, file, kb: Math.round(statSync(file).size / 1024) });
      console.log(`  ✓ ${it.id}.${lang}.jpg (${out[out.length - 1].kb} KB) — ${title.slice(0, 50)}`);
    }
  } finally { await browser.close(); }
  return { line, lang, out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [lineId, lang = 'tr', limitArg] = process.argv.slice(2);
  const limit = limitArg ? parseInt(limitArg, 10) : 99;
  if (!lineId) { console.error('Kullanım: node line-card.mjs <hat> [dil] [adet]'); process.exit(1); }
  console.log(`${lineId} kartları (${lang})…`);
  renderLineCards({ lineId, lang, limit })
    .then((r) => console.log(`✓ ${r.out.length} kart → assets/agency-cards/`))
    .catch((e) => { console.error('✗', e.message); process.exit(1); });
}
