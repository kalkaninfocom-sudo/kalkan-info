import puppeteer from 'puppeteer';
import path from 'node:path';

const url = process.argv[2];
const out = process.argv[3];
const width = parseInt(process.argv[4] || '1080', 10);
const height = parseInt(process.argv[5] || '1920', 10);

if (!url || !out) {
  console.error('Usage: node _capture.mjs <url> <out.jpg> [width] [height]');
  process.exit(1);
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: path.resolve(out), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width, height } });
await browser.close();
console.log('Saved:', out);
