#!/usr/bin/env node
/**
 * Kartvizit PDF builder — 85x55mm + 3mm bleed (91x61mm baski)
 * Kullanim: node scripts/build-kartvizit-pdf.mjs
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const htmlPath = join(root, 'kartvizit', 'index.html');
const outPath = join(root, 'kartvizit', 'Kalkaninfo-Kartvizit.pdf');

console.log('Puppeteer launching...');
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();

const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
console.log('Loading:', fileUrl);
await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });
await page.evaluateHandle('document.fonts.ready');

console.log('Rendering PDF...');
await page.pdf({
  path: outPath,
  width: '91mm',
  height: '61mm',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
});

await browser.close();
console.log('OK ->', outPath);
