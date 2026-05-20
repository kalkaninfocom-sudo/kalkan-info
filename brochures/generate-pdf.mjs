import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'villa-welcome-guide.html');
const pdfPath = path.join(__dirname, 'villa-welcome-guide.pdf');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), {
  waitUntil: ['load', 'networkidle0'],
  timeout: 60000,
});

await page.emulateMediaType('print');

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  preferCSSPageSize: true,
});

await browser.close();

console.log('PDF üretildi:', pdfPath);
