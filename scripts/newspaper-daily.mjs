// scripts/newspaper-daily.mjs
// Günlük gazete orkestratörü: üret → index → sosyal kart (4:5) → onay kuyruğu.
// Web + Instagram/Facebook tek akış. Otomatik YAYIN yok — insan onayından geçer.
//
// Kullanım:
//   node scripts/newspaper-daily.mjs                # bugün
//   node scripts/newspaper-daily.mjs 2026-07-01     # belirli tarih
//   node scripts/newspaper-daily.mjs --no-social    # sadece web (kart+onay atla)
//
// Adımlar:
//   1. morning + magazine üret (build.mjs)
//   2. data/newspaper-index.json güncelle
//   3. Her edisyon için 1080x1350 (4:5) sosyal kart PNG render et
//   4. Supabase social_posts'a tek carousel satırı (status=pending_approval) ekle
//      → api/telegram-webhook onayı → api/social-publish-queue IG/FB yayını
//
// Env (adım 4 için): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_BASE(ops)

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const argv = process.argv.slice(2);
const NO_SOCIAL = argv.includes('--no-social');
const date = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);
const SITE_BASE = process.env.SITE_BASE || 'https://www.kalkaninfo.com';

// .env.local yükle (yerel çalıştırma)
try {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

function run(args, label) {
  console.log(`\n── ${label} ──`);
  const r = spawnSync('node', args, { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
}

async function renderCards(chromePath) {
  const require = (await import('node:module')).createRequire(import.meta.url);
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch { try { puppeteer = require('C:/Users/socie/AppData/Roaming/npm/node_modules/puppeteer'); } catch { console.warn('⚠ puppeteer yok — kart render atlandı'); return []; } }

  const browser = await puppeteer.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}), args: ['--no-sandbox'] });
  const cards = [];
  try {
    for (const type of ['morning', 'magazine']) {
      const htmlPath = join(ROOT, 'newspaper', 'archive', date, `${type}.html`);
      if (!existsSync(htmlPath)) continue;
      const page = await browser.newPage();
      // A4 sayfayı çek
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 });
      const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 794, height: 1123 } });
      // 9:16 (1080x1920) Instagram HİKAYE — markalı navy zemin, gazete sayfası ortalı
      const label = type === 'morning' ? 'GÜNLÜK GAZETE · ÖN SAYFA' : 'GÜNLÜK GAZETE · MAGAZİN';
      const dTR = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      const wrapper = `<!doctype html><html><head><meta charset="utf-8">
        <style>
        html,body{margin:0}
        #c{width:1080px;height:1920px;overflow:hidden;position:relative;
           background:radial-gradient(120% 80% at 50% 0%,#0f4066 0%,#0a2e4c 45%,#072136 100%);
           display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif}
        .top{position:absolute;top:0;left:0;right:0;height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
        .brand{font-family:Georgia,'Times New Roman',serif;font-weight:900;font-size:46px;color:#fff;letter-spacing:1px}
        .brand span{color:#f4b53d}
        .kicker{font-size:20px;font-weight:700;letter-spacing:6px;color:#f4b53d;text-transform:uppercase}
        #c img{width:1000px;border:1px solid #e6ddcb;border-radius:8px;box-shadow:0 30px 80px rgba(0,0,0,.55)}
        .bot{position:absolute;bottom:0;left:0;right:0;height:130px;display:flex;align-items:center;justify-content:center;gap:14px;color:#cfe2f2;font-size:24px;font-weight:600}
        .bot b{color:#fff}.dot{color:#f4b53d}
        </style></head>
        <body><div id="c">
          <div class="top"><div class="brand">KALKAN <span>INFO</span></div><div class="kicker">${label}</div></div>
          <img src="data:image/png;base64,${shot.toString('base64')}">
          <div class="bot"><b>${dTR}</b><span class="dot">•</span>kalkaninfo.com/gazete</div>
        </div></body></html>`;
      await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
      await page.setContent(wrapper, { waitUntil: 'load' });
      const outRel = `newspaper/archive/${date}/${type}-card.png`;
      await page.screenshot({ path: join(ROOT, outRel), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
      await page.close();
      cards.push({ type, path: `/${outRel}` });
      console.log(`  ✓ ${outRel}`);
    }
  } finally { await browser.close(); }
  return cards;
}

async function queueSocial(cards) {
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!SUPA_URL || !SUPA_KEY) { console.warn('⚠ Supabase env yok — onay kuyruğu atlandı (web hazır). Prod env\'de çalışır.'); return; }
  if (!cards.length) { console.warn('⚠ kart yok — sosyal kuyruk atlandı'); return; }

  const assets = cards.map(c => c.path);
  const caption = `Kalkan Today — ${date} sayısı yayında.\n` +
    `Ön sayfa güncel haber & hava; arka yüz gece hayatı magazini.\n` +
    `Tüm sayı: ${SITE_BASE}/gazete`;
  const hashtags = ['#kalkan', '#kalkaninfo', '#kalkantoday', '#kaş', '#gündem', '#gecehayatı', '#antalya'];

  const row = {
    content_pack_id: `gazete-${date}`,
    content_type: cards.length >= 2 ? 'carousel' : 'post',
    language: 'tr',
    caption, hashtags,
    local_assets: assets,
    status: 'pending_approval',
    scheduled_at: new Date().toISOString(),
    telegram_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID ? Number(process.env.TELEGRAM_ADMIN_CHAT_ID) : null,
  };
  const res = await fetch(`${SUPA_URL}/rest/v1/social_posts?on_conflict=content_pack_id`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (res.ok) console.log(`  ✓ social_posts kuyruğa alındı (gazete-${date}) → Telegram onayı bekliyor`);
  else console.error('  ✗ social_posts insert fail:', res.status, await res.text());
}

async function main() {
  console.log(`\n════ Kalkan Today — ${date} ════`);
  run(['newspaper/generator/build.mjs', 'morning', date], 'Ön Sayfa (morning) üret');
  run(['newspaper/generator/build.mjs', 'magazine', date], 'Arka Yüz (magazine) üret');
  run(['scripts/build-newspaper-index.mjs'], 'Arşiv index güncelle');

  if (NO_SOCIAL) { console.log('\n--no-social: sosyal adımlar atlandı. Web hazır.'); return; }

  console.log('\n── Sosyal kart (4:5) render ──');
  const chrome = process.env.PUPPETEER_EXECUTABLE_PATH ||
    'C:/Users/socie/.cache/puppeteer/chrome/win64-149.0.7827.22/chrome-win64/chrome.exe';
  const cards = await renderCards(existsSync(chrome) ? chrome : null);

  console.log('\n── Onay kuyruğu (IG/FB) ──');
  await queueSocial(cards);

  console.log(`\n✅ ${date} hazır. Web: ${SITE_BASE}/gazete · Sosyal: Telegram onayından sonra IG/FB.`);
}

main().catch(e => { console.error('[newspaper-daily]', e); process.exit(1); });
