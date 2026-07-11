#!/usr/bin/env node
/**
 * scripts/agency/venue-spotlight.mjs — GROUNDED mekan spotlight (Fix #3: gerçek veri = değer)
 *
 * Jenerik evergreen DEĞİL. GERÇEK küratörlü veriye ground:
 *   - Gerçek DISK fotoğrafı olan (assets/img/**) + yüksek puanlı restoranı rotasyonla seç
 *   - Kart: gerçek foto hero + marka + GERÇEK ad/puan/kategori + CTA (DIY-ChatGPT bunu yapamaz)
 *   - 5 dilde caption, SADECE gerçek veriye dayanarak (rating/kategori/özet) — UYDURMA YOK
 *   - Telegram admin onayına gönderir → onaylanınca yayınlanır (CANLI gate, orphan değil)
 *
 * Kullanım: node scripts/agency/venue-spotlight.mjs [--dry] [--lang tr]
 * Workflow: .github/workflows/venue-spotlight.yml (haftada 2)
 */
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'venue-spotlight');
const STATE = join(ROOT, 'data', 'agency', 'venue-spotlight-state.json');
const LANGS = ['tr', 'en', 'de', 'fr', 'ru'];

for (const f of ['.env.local']) { try { for (const l of readFileSync(join(ROOT, f), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } } catch {} }

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJson = (rel, fb) => { try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return fb; } };

// Gerçek disk fotoğrafını base64 data-URI'ye çevir (Chromium file://+CORS bloklu → data-URI şart).
function photoDataUri(rel) {
  const abs = join(ROOT, rel.startsWith('/') ? rel.slice(1) : rel);
  if (!existsSync(abs)) return null;
  const ext = extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(abs).toString('base64')}`;
}

// Gerçek disk fotosu olan + puanlı restoranları getir (GROUNDING kaynağı).
function eligibleVenues() {
  const d = readJson('data/restoranlar.json', { items: [] });
  const list = d.items || d;
  return list.filter((r) => {
    if (!(r.rating >= 4.3)) return false;
    const g = (r.gallery || []).filter((p) => p && existsSync(join(ROOT, p.startsWith('/') ? p.slice(1) : p)));
    r._photos = g;
    return g.length >= 1;
  });
}

function pickVenue() {
  const venues = eligibleVenues();
  if (!venues.length) return null;
  const state = readJson('data/agency/venue-spotlight-state.json', { done: [] });
  const done = new Set(state.done || []);
  let pool = venues.filter((v) => !done.has(v.slug || v.id));
  if (!pool.length) { pool = venues; state.done = []; } // tur bitti, sıfırla
  // en yüksek puanı önceliklendir + hafif çeşitlilik
  pool.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const v = pool[0];
  return { v, state };
}

// 5 dilde GROUNDED caption — sadece gerçek veriden, uydurma yasak.
async function captions(v) {
  const facts = `Ad: ${v.name} | Puan: ${v.rating} | Kategori: ${v.category || ''} ${v.cuisine || ''} | Konum: ${v.location || 'Kalkan'} | Özet: ${(v.summary || '').slice(0, 200)}`;
  const system = 'Sen Kalkan Info sosyal medya editörüsün. SADECE verilen gerçek bilgiye dayan — puan/tarih/detay UYDURMA. Kısa, sıcak, marka-uyumlu Instagram caption. Emoji ölçülü, en fazla 4 hashtag.';
  const user = `Bu GERÇEK mekan için 5 dilde yayına hazır Instagram caption üret (birebir çeviri değil, her dil doğal). Sadece verilen bilgiyi kullan.\nMEKAN: ${facts}\nCTA: kalkaninfo.com\nSADECE JSON: {"tr":"...","en":"...","de":"...","fr":"...","ru":"..."}`;
  try {
    const { text } = await cheapLLM(user, { system, json: true, maxTokens: 900, temperature: 0.5, timeoutMs: 60000 });
    const m = text.match(/\{[\s\S]*\}/); const o = m ? JSON.parse(m[0]) : {};
    const out = {}; for (const l of LANGS) if (o[l]) out[l] = String(o[l]).trim();
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}

function stars(r) { const f = Math.round(r || 0); return '★'.repeat(f) + '☆'.repeat(Math.max(0, 5 - f)); }

function cardHtml(v, photo, tagline) {
  const cat = [v.category, v.cuisine].filter(Boolean).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box;}html,body{width:1080px;height:1350px;font-family:'Inter',sans-serif;}
.card{position:relative;width:1080px;height:1350px;overflow:hidden;background:#04101d;color:#fff;}
.hero{position:absolute;inset:0;background:#04101d;}
.hero img{width:100%;height:100%;object-fit:cover;}
.grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,16,29,.15) 0%,rgba(4,16,29,.05) 42%,rgba(4,16,29,.75) 74%,rgba(4,16,29,.96) 100%);}
.top{position:absolute;top:56px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;}
.brand{display:flex;align-items:center;gap:9px;font-family:'Montserrat';font-weight:800;font-size:24px;letter-spacing:1px;}
.brand .d{color:#f4b53d;}
.badge{font-family:'Montserrat';font-weight:800;font-size:18px;letter-spacing:2px;color:#0a1a2b;background:#f4b53d;border-radius:999px;padding:8px 18px;}
.rate{position:absolute;top:120px;right:56px;background:rgba(4,16,29,.55);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:10px 16px;text-align:center;}
.rate .s{color:#f4b53d;font-size:22px;letter-spacing:2px;}
.rate .n{font-family:'Montserrat';font-weight:800;font-size:20px;margin-top:2px;}
.bottom{position:absolute;left:56px;right:56px;bottom:64px;}
.cat{font-family:'Montserrat';font-weight:700;font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#f4b53d;}
.name{font-family:'Montserrat';font-weight:900;font-size:76px;line-height:1.03;letter-spacing:-1.5px;margin-top:12px;text-shadow:0 4px 40px rgba(0,0,0,.6);}
.tag{font-family:'Inter';font-weight:500;font-size:34px;line-height:1.4;color:#dbe8f4;margin-top:20px;max-width:900px;}
.cta{display:flex;align-items:center;justify-content:space-between;margin-top:34px;padding-top:26px;border-top:1.5px solid rgba(255,255,255,.16);}
.cta .u{font-family:'Montserrat';font-weight:800;font-size:30px;color:#f4b53d;}
.cta .b{font-family:'Inter';font-size:22px;color:#9db8cf;}
</style></head><body>
<div class="card">
  <div class="hero">${photo ? `<img src="${photo}"/>` : ''}</div>
  <div class="grad"></div>
  <div class="top"><div class="brand">◆ KALKAN <span class="d">INFO</span></div><div class="badge">MEKAN</div></div>
  ${v.rating ? `<div class="rate"><div class="s">${stars(v.rating)}</div><div class="n">${v.rating}</div></div>` : ''}
  <div class="bottom">
    ${cat ? `<div class="cat">${esc(cat)}</div>` : ''}
    <div class="name">${esc(v.name)}</div>
    ${tagline ? `<div class="tag">${esc(tagline)}</div>` : ''}
    <div class="cta"><span class="u">kalkaninfo.com</span><span class="b">${esc(v.location || 'Kalkan · Kaş')}</span></div>
  </div>
</div></body></html>`;
}

async function sendTelegram(caption, imgPath) {
  const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!TG || !CHAT) { console.log('ℹ Telegram env yok — kart dosyada, onaya gönderilmedi.'); return false; }
  const form = new FormData();
  form.append('chat_id', CHAT);
  form.append('caption', caption.slice(0, 1024));
  const buf = await readFile(imgPath);
  form.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'spotlight.jpg');
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) { console.log('▶ Telegram onayına gönderildi'); return true; }
    console.log('⚠ Telegram:', JSON.stringify(j).slice(0, 160)); return false;
  } catch (e) { console.log('⚠ Telegram hata:', e.message); return false; }
}

async function main() {
  const dry = process.argv.includes('--dry');
  const picked = pickVenue();
  if (!picked) { console.log('✗ uygun (fotolu+puanlı) mekan yok'); return; }
  const { v, state } = picked;
  const photo = photoDataUri(v._photos[0]);
  console.log(`🍽️ Spotlight: ${v.name} (${v.rating}★, ${v._photos.length} foto) — GROUNDED`);

  const caps = await captions(v) || { tr: `${v.name} — Kalkan'ın ${v.rating}★ favorilerinden. kalkaninfo.com` };
  const tagline = (v.summary || '').split(/[.!?]/)[0].trim().slice(0, 120) || caps.tr.slice(0, 120);

  await mkdir(OUT, { recursive: true });
  const slug = v.slug || v.id;
  const outPath = join(OUT, `${slug}.jpg`);

  if (!dry) {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
      await page.setContent(cardHtml(v, photo, tagline), { waitUntil: 'load', timeout: 20000 });
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      await new Promise((r) => setTimeout(r, 350));
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
    } finally { await browser.close(); }
    const kb = Math.round((await stat(outPath)).size / 1024);
    console.log(`✓ kart: assets/venue-spotlight/${slug}.jpg (${kb} KB) — GERÇEK foto: ${v._photos[0]}`);

    // 5 dil caption dosyası
    const capTxt = LANGS.map((l) => `── ${l.toUpperCase()} ──\n${caps[l] || caps.tr}`).join('\n\n');
    await writeFile(join(OUT, `${slug}.caption.txt`), capTxt, 'utf8');

    // Rotasyon durumu + Telegram onay
    state.done = [...new Set([...(state.done || []), slug])];
    await writeFile(STATE, JSON.stringify(state, null, 2), 'utf8');
    await sendTelegram(`🍽️ MEKAN SPOTLIGHT (onay bekliyor)\n${v.name} · ${v.rating}★\n\n${caps.tr || ''}`, outPath);
  } else {
    console.log('[dry] üretilmedi. tagline:', tagline);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('[venue-spotlight]', e.message); process.exit(1); });
}
