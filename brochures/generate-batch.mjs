#!/usr/bin/env node
// Brochures batch generator — villalar.json'daki her villa için onepager PDF üretir.
// Mevcut villa-welcome-onepager.html'i template olarak okur, {{placeholder}} pattern'leri replace eder.
//
// Kullanım:
//   node brochures/generate-batch.mjs            # tüm villalar
//   node brochures/generate-batch.mjs villa-id   # tek villa
//
// Gereksinim: puppeteer (devDeps).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = resolve(import.meta.dirname || '.', '..');
const TEMPLATE_PATH = resolve(ROOT, 'brochures/villa-welcome-onepager.html');
const OUT_DIR = resolve(ROOT, 'brochures/output');
const VILLAS_PATH = resolve(ROOT, 'data/villalar.json');

const FILTER_ID = process.argv[2];

mkdirSync(OUT_DIR, { recursive: true });

if (!existsSync(TEMPLATE_PATH)) {
  console.error('❌ Template not found:', TEMPLATE_PATH);
  process.exit(1);
}

const template = readFileSync(TEMPLATE_PATH, 'utf-8');
const { items: villas = [] } = JSON.parse(readFileSync(VILLAS_PATH, 'utf-8'));

if (!villas.length) {
  console.error('⚠️  data/villalar.json items[] boş — önce villa ekle.');
  process.exit(0);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fillTemplate(html, villa) {
  // Basit placeholder replacement. Template'te {{name}}, {{capacity}}, vb. olmalı.
  // Mevcut HTML hardcoded — bu generator template halinde gelmesini bekler.
  // İlk versiyon: hardcoded HTML'in başlığını değiştir, ileride genişletilecek.
  const tags = (villa.tags || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');
  const features = (villa.features || []).map(f => `<li>${escapeHtml(f)}</li>`).join('');
  return html
    .replace(/{{name}}/g, escapeHtml(villa.name || 'Villa'))
    .replace(/{{capacity}}/g, escapeHtml(villa.capacity || ''))
    .replace(/{{bedrooms}}/g, escapeHtml(String(villa.bedrooms || '')))
    .replace(/{{bathrooms}}/g, escapeHtml(String(villa.bathrooms || '')))
    .replace(/{{pool}}/g, escapeHtml(villa.pool || ''))
    .replace(/{{image}}/g, escapeHtml(villa.image || '/assets/img/villa-placeholder.webp'))
    .replace(/{{location}}/g, escapeHtml(villa.location || 'Kalkan'))
    .replace(/{{summary}}/g, escapeHtml(villa.summary || ''))
    .replace(/{{tags}}/g, tags)
    .replace(/{{features}}/g, features);
}

async function main() {
  const targets = FILTER_ID ? villas.filter(v => v.id === FILTER_ID) : villas;
  if (!targets.length) {
    console.error('❌ Villa bulunamadı:', FILTER_ID || '(all)');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const t0 = Date.now();

  for (const villa of targets) {
    const html = fillTemplate(template, villa);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const outPath = resolve(OUT_DIR, `${villa.id}-onepager.pdf`);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
    await page.close();
    console.log(`✅ ${villa.id}-onepager.pdf`);
  }

  await browser.close();
  console.log(`\n📊 ${targets.length} PDF üretildi · ${Date.now() - t0}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
