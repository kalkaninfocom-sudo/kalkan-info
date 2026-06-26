import puppeteer from 'puppeteer';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:3000/instagram/story-villa-arama-20260804.html';
const out = process.argv[3] || 'instagram/story-villa-arama-20260804.jpg';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: path.resolve(out), type: 'jpeg', quality: 92, fullPage: false, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
await browser.close();
console.log('Saved:', out);
