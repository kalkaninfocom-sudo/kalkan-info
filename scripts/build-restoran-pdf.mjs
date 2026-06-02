#!/usr/bin/env node
/**
 * Sunum PDF builder — HTML -> A4 print-ready PDF
 * Kullanim: node scripts/build-restoran-pdf.mjs
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const htmlPath = join(root, 'sunum', 'restoran-paketi', 'index.html');
const outPath = join(root, 'sunum', 'restoran-paketi', 'Kalkaninfo-Restoran-Paketi.pdf');

console.log('Puppeteer launching...');
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();

const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
console.log('Loading:', fileUrl);
await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });

// Web fontlari yuklenmesini bekle
await page.evaluateHandle('document.fonts.ready');

console.log('Rendering PDF...');
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log('OK ->', outPath);
