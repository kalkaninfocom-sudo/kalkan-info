// Capture Reels-ready (1080x1920) portrait screenshots of kalkaninfo.com pages.
// Output: dist/site-tour/screens/*.png
// Usage: node scripts/_capture-webapp-tour.mjs

import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://www.kalkaninfo.com';

// fullPage=true → tüm sayfanın ekran görüntüsü (uzun PNG). Reels'te phone içinde scroll efekti.
// Max height clipped at 3200px so file size stays reasonable.
const PAGES = [
  { id: 'home',         path: '/',                wait: 2000, fullPage: true,  maxHeight: 3200 },
  { id: 'restoranlar',  path: '/restoranlar',     wait: 2400, fullPage: true,  maxHeight: 3200 },
  { id: 'villalar',     path: '/villalar',        wait: 2400, fullPage: true,  maxHeight: 3200 },
  { id: 'plajlar',      path: '/plajlar',         wait: 2400, fullPage: true,  maxHeight: 3200 },
  { id: 'antik',        path: '/antik-kentler',   wait: 2400, fullPage: true,  maxHeight: 3200 },
  { id: 'hizmetler',    path: '/hizmetler',       wait: 2400, fullPage: true,  maxHeight: 3200 },
  { id: 'ilanlar',      path: '/ilanlar',         wait: 2400, fullPage: true,  maxHeight: 3200 },
  { id: 'tatil',        path: '/tatil-planla',    wait: 2400, fullPage: true,  maxHeight: 3200 },
];

const outDir = resolve('dist/site-tour/screens');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Lazy import puppeteer — it's globally installed
const puppeteer = await import('puppeteer').catch(() =>
  import('puppeteer-core').catch(() => null)
);
if (!puppeteer) {
  console.error('puppeteer not found. Run: npm i -g puppeteer');
  process.exit(1);
}

const browser = await puppeteer.default.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const p of PAGES) {
  console.log(`📸 ${p.id} ${BASE}${p.path}`);
  const page = await browser.newPage();
  // Mobile portrait, retina-ish for crisp Reels frames
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

  try {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle2', timeout: 25000 });
  } catch (e) {
    console.warn(`  ⚠ goto: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, p.wait));

  // PWA install banner + cookie banner + sticky overlay gizleme (video çekimi için)
  // Hem CSS injection (her case için sigorta) hem de DOM remove (mevcut elementler için).
  try {
    await page.addStyleTag({ content: `
      /* PWA install banner / app prompt — video için gizle */
      #kalkan-install-banner, #kalkan-ios-banner,
      #pwa-update-toast, #pwa-offline-bar,
      [data-pwa-install], .pwa-install-prompt, .install-app-banner,
      #pwa-install, #install-app, .install-promote,
      [class*="install-banner"], [id*="install-banner"],
      .a2hs-banner, [aria-label*="yükle"], [aria-label*="Yükle"], [aria-label*="install"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
      }
    `});
  } catch {}

  try {
    await page.evaluate(() => {
      const sels = ['#cookie-banner', '.cookie-banner', '[data-cookie-banner]', '#cookie-consent',
                    '#bottom-nav', '[data-bottom-nav]', '#site-drawer', '.toast', '#concierge-fab',
                    '#kalkan-install-banner', '#kalkan-ios-banner', '#pwa-update-toast', '#pwa-offline-bar'];
      for (const s of sels) document.querySelector(s)?.remove();
      // Setup a MutationObserver to nuke install banners injected after our cleanup
      const killSels = ['#kalkan-install-banner', '#kalkan-ios-banner', '#pwa-update-toast', '#pwa-offline-bar'];
      const obs = new MutationObserver(() => {
        for (const s of killSels) document.querySelector(s)?.remove();
      });
      obs.observe(document.body, { childList: true, subtree: true });
      // localStorage dismiss flag — PWA scriptinin banner'ı tekrar açmasını engelle
      try { localStorage.setItem('kalkan_install_dismissed', String(Date.now())); } catch {}
    });
  } catch {}

  // KRİTİK: Lazy-load tetiklemek için en alta scroll et, görsellerin yüklenmesini bekle, sonra başa dön.
  // Aksi halde restoran/plaj kartlarının görselleri beyaz çıkıyor.
  console.log(`  · lazy-load trigger…`);
  await page.evaluate(async (maxH) => {
    // Doğal scroll — adım adım, lazy IntersectionObserver'lar tetiklensin
    const target = maxH || document.body.scrollHeight;
    let y = 0;
    while (y < target) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 90));
      y += 600;
    }
    window.scrollTo({ top: target, behavior: 'instant' });
  }, p.maxHeight || 0);

  await new Promise(r => setTimeout(r, 1500));

  // img'lerin tamamlanmasını bekle
  await page.evaluate(() => new Promise((resolve) => {
    const imgs = Array.from(document.images).filter(i => i.src && !i.src.startsWith('data:'));
    const pending = imgs.filter(i => !i.complete || (i.naturalWidth === 0 && i.naturalHeight === 0));
    if (pending.length === 0) return resolve();
    let remaining = pending.length;
    const done = () => { remaining--; if (remaining <= 0) resolve(); };
    pending.forEach(i => {
      i.addEventListener('load', done, { once: true });
      i.addEventListener('error', done, { once: true });
    });
    setTimeout(resolve, 7000); // hard timeout
  }));

  // En başa dön — capture'ı buradan başlatacağız
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 700));

  // Page height clamp (çok uzun sayfaları kes)
  if (p.maxHeight) {
    try {
      await page.evaluate((maxH) => {
        document.body.style.maxHeight = maxH + 'px';
        document.body.style.overflow = 'hidden';
      }, p.maxHeight);
    } catch {}
  }

  const outPath = resolve(outDir, `${p.id}.png`);
  await page.screenshot({ path: outPath, fullPage: !!p.fullPage, type: 'png' });
  const fs = await import('node:fs');
  const sz = fs.statSync(outPath).size;
  console.log(`  ✓ ${(sz / 1024).toFixed(0)}KB`);
  await page.close();
}

await browser.close();
console.log('\n✅ all screens captured to', outDir);
