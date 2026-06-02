#!/usr/bin/env node
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const htmlPath = join(root, 'sunum', 'wp-katalog-rehberi', 'index.html');
const outPath = join(root, 'sunum', 'wp-katalog-rehberi', 'Kalkaninfo-WhatsApp-Katalog-Rehberi.pdf');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 60_000 });
await page.evaluateHandle('document.fonts.ready');
await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log('OK ->', outPath);
