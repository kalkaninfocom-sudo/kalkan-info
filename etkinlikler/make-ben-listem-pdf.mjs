import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = 'file:///' + path.join(__dirname, 'kalkaninfo-ben-listem.html').replace(/\\/g, '/');
const outPath = path.join(__dirname, 'kalkaninfo-ben-listem.pdf');

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.goto(htmlPath, { waitUntil: 'networkidle0' });
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  preferCSSPageSize: false,
});
await browser.close();
console.log('PDF kaydedildi:', outPath);
