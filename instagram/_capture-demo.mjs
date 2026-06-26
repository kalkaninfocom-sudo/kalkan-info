import puppeteer from 'puppeteer';
import path from 'node:path';

const url = process.argv[2];
const out = process.argv[3];
const width = parseInt(process.argv[4] || '1080', 10);
const height = parseInt(process.argv[5] || '1920', 10);
const photoUrl = process.argv[6] || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1080&q=80';

if (!url || !out) {
  console.error('Usage: node _capture-demo.mjs <url> <out.jpg> [w] [h] [photoUrl]');
  process.exit(1);
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate((u) => {
  const el = document.querySelector('.photo');
  if (el) el.style.background = `url('${u}') center center/cover no-repeat`;
}, photoUrl);
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: path.resolve(out), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width, height } });
await browser.close();
console.log('Saved:', out);
