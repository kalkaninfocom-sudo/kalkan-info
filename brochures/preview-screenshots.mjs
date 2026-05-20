import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'villa-welcome-guide.html');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();

// A4 ~ 794 x 1123 px @ 96dpi
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.2 });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 60000 });

const pages = await page.$$('.page');
for (let i = 0; i < pages.length; i++) {
  const box = await pages[i].boundingBox();
  await page.screenshot({
    path: path.join(__dirname, `preview-${i + 1}.png`),
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
}

await browser.close();
console.log('Previews:', pages.length, 'pages');
