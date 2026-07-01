// scripts/build-ads.mjs
// data/ads.json'daki aktif reklamlar için statik /q/<slug>/index.html üretir.
// Her sayfa: (1) Plausible'a "Ad Click" olayı yollar (slug + venue prop),
//            (2) hedef URL'e yönlendirir (JS + noscript meta-refresh fallback).
// api fonksiyonu / cron GEREKTİRMEZ — saf statik. Vercel cleanUrls ile /q/<slug> çözülür.
//
// Build-all içinde çağrılır; elle: node scripts/build-ads.mjs

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const Q_DIR = join(ROOT, 'q');

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function isActive(ad, todayIso) {
  if (ad.status !== 'active') return false;
  if (ad.starts_at && todayIso < ad.starts_at) return false;
  if (ad.ends_at && todayIso > ad.ends_at) return false;
  return true;
}

function redirectPage(ad) {
  const dest = esc(ad.dest_url);
  const slug = esc(ad.slug);
  const venue = esc(ad.venue || '');
  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Yönlendiriliyor… — Kalkan Info</title>
<meta http-equiv="refresh" content="1;url=${dest}">
<script defer data-domain="kalkaninfo.com" src="https://plausible.io/js/script.manual.js"></script>
<style>html,body{height:100%;margin:0;background:#0a2e4c;color:#fff;font-family:system-ui,sans-serif}
.c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px}
a{color:#F5B301;font-weight:700}.s{opacity:.7;font-size:14px}</style>
</head><body>
<div class="c">
  <div style="font-size:20px;font-weight:800">${venue || 'Kalkan Info'}</div>
  <div class="s">Yönlendiriliyorsunuz…</div>
  <a href="${dest}" id="go">Otomatik açılmazsa buraya dokunun</a>
</div>
<script>
(function(){
  try{
    window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};
    plausible('Ad Click',{props:{slug:'${slug}',venue:'${venue}'}});
  }catch(e){}
  setTimeout(function(){ location.replace(${JSON.stringify(ad.dest_url)}); }, 250);
})();
</script>
</body></html>`;
}

async function main() {
  const adsPath = join(ROOT, 'data', 'ads.json');
  if (!existsSync(adsPath)) { console.log('[build-ads] data/ads.json yok — atlandı'); return; }
  const { ads = [] } = JSON.parse(await readFile(adsPath, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);

  // Temiz kur: eski /q'yu sil (yalnız üretilenler kalsın)
  if (existsSync(Q_DIR)) await rm(Q_DIR, { recursive: true, force: true });

  const active = ads.filter(a => isActive(a, today));
  let n = 0;
  for (const ad of active) {
    if (!ad.slug || !ad.dest_url) { console.warn('[build-ads] eksik slug/dest_url:', ad.slug); continue; }
    const dir = join(Q_DIR, ad.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), redirectPage(ad), 'utf8');
    n++;
  }
  console.log(`[build-ads] ${n}/${ads.length} aktif reklam → /q/<slug> üretildi (${active.map(a => a.slug).join(', ') || 'yok'})`);
}

main().catch(e => { console.error('[build-ads]', e); process.exit(0); }); // fail-safe: build'i kırma
