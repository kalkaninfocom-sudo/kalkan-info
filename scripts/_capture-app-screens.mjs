#!/usr/bin/env node
/**
 * _capture-app-screens.mjs — Reel için GÜNCEL mobil (9:16 genişlikli) ekran görüntüleri.
 * Canlı localhost sayfalarını mobil viewport'ta gezip remotion/public/screens/<lang>/<key>.png üretir.
 * Grounded: gerçek sayfa, gerçek veri. WebappPromo bunları telefon çerçevesinde scroll eder.
 *
 * ⚠️⚠️ REEL EKRAN KAYDI — ATLAMA! (Berkay kuralı, her seferinde kontrol et):
 *  1) SABİT UI GİZLE: fixed/sticky chrome (alt nav #ki-bn, "Uygulamayı Yükle" barı, cookie/consent,
 *     concierge/auth-pill/wa-float widget'ları) telefon içinde ORTADA yüzer → akışı bozar. HEPSİ kaldırılır.
 *  2) DİL EŞLEŞMESİ: reel dili = site dili. EN reel → EN ekran (?lang=en). Türkçe site İng. videoda GÖRÜNMEZ.
 *  3) BOYUT: fullPage DEĞİL (chrome dev görüntüyü decode edemez); üst ~1900px klip.
 *  Bu üçü de aşağıda kodlu — bozmadan koru.
 *
 * Kullanım: PORT=3055 çalışırken → node scripts/_capture-app-screens.mjs [baseUrl] [lang]
 *   node scripts/_capture-app-screens.mjs http://localhost:3055 en
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3055';
const LANG = (process.argv[3] || 'tr').toLowerCase();   // reel diline göre site dili (i18n)
const OUT = join(ROOT, 'remotion', 'public', 'screens', LANG);
mkdirSync(OUT, { recursive: true });

// Reel akışı için sayfalar (grounded, güncel). key → yol
const PAGES = [
  ['home',        '/'],
  ['restoranlar', '/restoranlar.html'],
  ['plajlar',     '/plajlar.html'],
  ['pazarlar',    '/pazarlar.html'],
  ['antik',       '/antik-kentler.html'],
  ['dolmus',      '/dolmus.html'],
  ['tatil',       '/tatil-asistani.html'],
  ['villalar',    '/villalar.html'],
];

const VW = 460, VH = 996; // mobil genişlik; text mobil boyutta görünsün

const run = async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // Sayfa scriptlerinden ÖNCE: install/consent'i "kapatılmış" işaretle → bar HİÇ oluşmasın.
  // (pwa.js dismiss anahtarı = kalkan_install_dismissed; 7 gün içindeyse showInstallBanner erken çıkar.)
  await page.evaluateOnNewDocument((lang) => {
    try {
      localStorage.setItem('lang', lang);   // i18n dili (data-en/tr/... uygular)
      localStorage.setItem('kalkan_install_dismissed', String(Date.now()));
      localStorage.setItem('ki_consent', '1');
      localStorage.setItem('cookieConsent', 'accepted');
      localStorage.setItem('ki_cookie_ok', '1');
    } catch {}
  }, LANG);
  for (const [key, path] of PAGES) {
    try {
      const url = BASE + path + (path.includes('?') ? '&' : '?') + 'lang=' + LANG;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      // consent/install banner'ları kapat (reels-critic dersi: navigasyondan önce dismiss)
      await page.evaluate(() => {
        // ⚠️ REEL EKRAN KAYDI KURALI — HER SEFERİNDE:
        // Sabit (fixed/sticky) UI chrome telefon çerçevesinde ORTADA yüzer → görüntü akışını BOZAR.
        // Bu yüzden TÜM fixed/sticky overlay'leri (alt nav #ki-bn, install barı, cookie, concierge,
        // auth-pill, wa-float, sohbet widget'ı) capture'dan önce KALDIR. Sadece akan içerik kalsın.
        const KILL_IDS = ['ki-bn', 'ki-bn-install', 'kalkan-install-banner', 'kalkan-ios-banner',
          'pwa-update-toast', 'pwa-offline-bar', 'ki-bottomnav-styles'];
        KILL_IDS.forEach((id) => { const e = document.getElementById(id); if (e) e.remove(); });
        document.querySelectorAll('[id*="cookie"],[class*="cookie"],[id*="consent"],[class*="install-ban"],[class*="wa-float"],[id*="concierge"],[id*="auth-pill"],[class*="auth-pill"]').forEach((e) => e.remove());
        // GENEL: kalan tüm fixed/sticky elemanları gizle (en sağlam — yeni widget eklense de yakalar).
        document.querySelectorAll('body *').forEach((e) => {
          const pos = getComputedStyle(e).position;
          if (pos === 'fixed' || pos === 'sticky') e.style.setProperty('display', 'none', 'important');
        });
      });
      await new Promise(r => setTimeout(r, 900)); // lazy img + animasyon otursun
      // hero'ya kaydır ki üst kısım dolu görünsün, sonra başa dön
      await page.evaluate(() => window.scrollTo(0, 0));
      const file = join(OUT, `${key}.png`);
      // fullPage DEĞİL — üst ~1900px bölge (chrome büyük görüntüyü decode edemiyor; scroll için yeterli).
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: VW, height: 1900 } });
      console.log(`✓ ${key} → remotion/public/screens/${key}.png`);
    } catch (e) {
      console.error(`✗ ${key}: ${e.message}`);
    }
  }
  await browser.close();
  console.log('bitti.');
};
run().catch(e => { console.error(e); process.exit(1); });
