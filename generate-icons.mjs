/* Puppeteer ile SVG → PNG icon generator
   kalkan-info klasöründe çalıştır: node generate-icons.mjs
*/
import puppeteer from 'puppeteer';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = './icons';
const SVG_PATH = './icons/icon.svg';

const svg = await readFile(SVG_PATH, 'utf-8');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

for (const size of SIZES) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">
    <div style="width:${size}px;height:${size}px;">${svg.replace(/width="\\d+"/, `width="${size}"`).replace(/height="\\d+"/, `height="${size}"`)}</div>
  </body></html>`, { waitUntil: 'domcontentloaded' });
  const buf = await page.screenshot({ omitBackground: true, type: 'png', clip: { x:0, y:0, width:size, height:size } });
  await writeFile(join(OUT_DIR, `icon-${size}.png`), buf);
  console.log(`✓ icon-${size}.png`);
}

// Apple touch icon (180x180)
await page.setViewport({ width: 180, height: 180 });
await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">
  <div style="width:180px;height:180px;">${svg.replace(/width="\\d+"/, 'width="180"').replace(/height="\\d+"/, 'height="180"')}</div>
</body></html>`, { waitUntil: 'domcontentloaded' });
const buf180 = await page.screenshot({ omitBackground: true, type: 'png', clip: { x:0, y:0, width:180, height:180 } });
await writeFile(join(OUT_DIR, 'apple-touch-icon.png'), buf180);
console.log('✓ apple-touch-icon.png');

// Favicon 32x32
await page.setViewport({ width: 32, height: 32 });
await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">
  <div style="width:32px;height:32px;">${svg.replace(/width="\\d+"/, 'width="32"').replace(/height="\\d+"/, 'height="32"')}</div>
</body></html>`, { waitUntil: 'domcontentloaded' });
const buf32 = await page.screenshot({ omitBackground: true, type: 'png', clip: { x:0, y:0, width:32, height:32 } });
await writeFile(join(OUT_DIR, 'favicon-32.png'), buf32);
console.log('✓ favicon-32.png');

await browser.close();
console.log('All icons generated.');
