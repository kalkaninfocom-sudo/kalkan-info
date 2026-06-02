#!/usr/bin/env node
/**
 * WhatsApp Business katalog için 1080×1080 PNG üretici.
 * Çıktı: kartlar/temel.png, premium.png, vip.png
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const htmlPath = join(root, 'kartlar', 'index.html');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });
await page.evaluateHandle('document.fonts.ready');

// Screen scale'i kaldır — print mode emule et
await page.emulateMediaType('print');
await page.evaluate(() => {
  document.querySelectorAll('.card').forEach(c => { c.style.transform = 'none'; c.style.marginBottom = '0'; c.style.borderRadius = '0'; c.style.boxShadow = 'none'; });
  document.querySelectorAll('.label').forEach(l => l.style.display = 'none');
  document.body.style.padding = '0';
  document.body.style.background = '#000';
});

const targets = [
  ['card-temel', 'temel.png'],
  ['card-premium', 'premium.png'],
  ['card-vip', 'vip.png']
];

for (const [id, file] of targets) {
  const out = join(root, 'kartlar', file);
  const el = await page.$(`#${id}`);
  if (!el) { console.warn('Bulunamadi:', id); continue; }
  await el.screenshot({ path: out, omitBackground: false });
  console.log(`  + ${file}`);
}

await browser.close();
console.log('Tamam.');
