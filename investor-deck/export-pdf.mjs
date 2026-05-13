import puppeteer from 'puppeteer';
import { resolve } from 'path';

const URL = process.argv[2] || 'http://localhost:3000/investor-deck/index.html';
const OUT = resolve('investor-deck/kalkan-info-pre-seed-deck.pdf');

console.log('Yatırımcı sunumu PDF üretiliyor...');
console.log('URL:', URL);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

// Wait for fonts to render
await new Promise(r => setTimeout(r, 1500));

await page.pdf({
  path: OUT,
  width: '1920px',
  height: '1080px',
  printBackground: true,
  preferCSSPageSize: false,
  pageRanges: '1-16',
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser.close();
console.log('✓ PDF:', OUT);
