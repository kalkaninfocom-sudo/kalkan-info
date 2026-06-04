#!/usr/bin/env node
/**
 * Otel mini-site fullPage screenshot. Lazy-loaded images icin scroll-trigger yapar.
 * Kullanim: node scripts/_screenshot-otel.mjs <url> <label>
 */
import puppeteer from 'puppeteer';
import { readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';
const SCREENSHOTS_DIR = join(ROOT, 'temporary screenshots');

await mkdir(SCREENSHOTS_DIR, { recursive: true });

const files = await readdir(SCREENSHOTS_DIR).catch(() => []);
const nums = files
  .filter(f => f.startsWith('screenshot-') && f.endsWith('.png'))
  .map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] || '0'))
  .filter(n => !isNaN(n));
const next = nums.length ? Math.max(...nums) + 1 : 1;
const suffix = label ? `-${label}` : '';
const filepath = join(SCREENSHOTS_DIR, `screenshot-${next}${suffix}.png`);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem('ki-consent-v1', JSON.stringify({ functional: true, analytics: true, marketing: true, ts: new Date().toISOString(), version: 1 }));
    localStorage.setItem('lang', 'tr');
  } catch (_) {}
});

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Scroll through page to trigger lazy loading
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let total = 0;
    const distance = 400;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      total += distance;
      if (total >= document.body.scrollHeight) {
        window.scrollTo(0, 0);
        clearInterval(timer);
        resolve();
      }
    }, 80);
  });
});

// Wait for all lazy <img>'s
await page.evaluate(async () => {
  const imgs = Array.from(document.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
      setTimeout(res, 5000);
    });
  }));
});

await new Promise(r => setTimeout(r, 800));

const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.screenshot({ path: filepath, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${filepath}`);
if (errors.length) {
  console.log(`Console/page errors: ${errors.length}`);
  errors.slice(0, 5).forEach(e => console.log(`  - ${e.slice(0, 200)}`));
}
