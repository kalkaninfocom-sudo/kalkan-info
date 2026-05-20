import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'villa-welcome-onepager.html');
const pdfPath = path.join(__dirname, 'villa-welcome-onepager.pdf');
const pngPath = path.join(__dirname, 'villa-welcome-onepager-preview.png');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
page.setDefaultTimeout(120000);
page.setDefaultNavigationTimeout(120000);
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});
// fontlar + görseller için ek bekleme
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 800));
await page.emulateMediaType('print');

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  preferCSSPageSize: true,
});

// preview screenshot
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.4 });
const el = await page.$('.page');
const box = await el.boundingBox();
await page.screenshot({
  path: pngPath,
  clip: { x: box.x, y: box.y, width: box.width, height: box.height },
});

await browser.close();
console.log('PDF:', pdfPath);
console.log('Preview:', pngPath);
