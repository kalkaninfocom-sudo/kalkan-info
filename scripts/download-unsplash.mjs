#!/usr/bin/env node
/**
 * download-unsplash.mjs
 * Scans data/*.json and *.html for Unsplash URLs, downloads + converts to WebP.
 * Output: assets/img/<hash>.webp + assets/img/manifest.json
 * Usage: node scripts/download-unsplash.mjs [--sample N]
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

const CONCURRENCY = 5;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 800;
const QUALITY = 80;

// Parse --sample flag
const sampleArg = process.argv.indexOf('--sample');
const SAMPLE_LIMIT = sampleArg !== -1 ? parseInt(process.argv[sampleArg + 1], 10) : Infinity;

// ── Collect all Unsplash URLs ────────────────────────────────────────────────

function extractUrls(text) {
  const re = /https:\/\/images\.unsplash\.com\/photo-[^\s"'<>)]+/g;
  return [...new Set(text.match(re) || [])];
}

function collectUrls() {
  const urls = new Set();

  // data/*.json
  const dataDir = path.join(ROOT, 'data');
  for (const f of fs.readdirSync(dataDir)) {
    if (!f.endsWith('.json')) continue;
    const text = fs.readFileSync(path.join(dataDir, f), 'utf8');
    extractUrls(text).forEach(u => urls.add(u));
  }

  // *.html in root
  for (const f of fs.readdirSync(ROOT)) {
    if (!f.endsWith('.html')) continue;
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    extractUrls(text).forEach(u => urls.add(u));
  }

  return [...urls];
}

// ── Hash → filename ──────────────────────────────────────────────────────────

function urlToFilename(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  return `${hash}.webp`;
}

// ── Download + convert ───────────────────────────────────────────────────────

async function processUrl(url, manifest) {
  const filename = urlToFilename(url);
  const outPath = path.join(OUT_DIR, filename);
  const localPath = `/assets/img/${filename}`;

  // Already done
  if (manifest[url]) {
    process.stdout.write('.');
    return { url, status: 'skip' };
  }
  if (fs.existsSync(outPath)) {
    manifest[url] = localPath;
    process.stdout.write('.');
    return { url, status: 'skip' };
  }

  try {
    // Dynamic import sharp (devDependency)
    const sharp = (await import('sharp')).default;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (kalkan-info asset pipeline)' }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      process.stdout.write('E');
      return { url, status: 'error', reason: `HTTP ${res.status}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    await sharp(buffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outPath);

    manifest[url] = localPath;
    process.stdout.write('+');
    return { url, status: 'ok', path: localPath };
  } catch (err) {
    process.stdout.write('F');
    return { url, status: 'error', reason: err.message };
  }
}

// ── Concurrency pool ─────────────────────────────────────────────────────────

async function runPool(tasks, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Load existing manifest
  let manifest = {};
  if (fs.existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  }

  let urls = collectUrls();
  console.log(`Found ${urls.length} unique Unsplash URLs`);

  if (SAMPLE_LIMIT < Infinity) {
    urls = urls.slice(0, SAMPLE_LIMIT);
    console.log(`Sample mode: processing first ${SAMPLE_LIMIT}`);
  }

  const toProcess = urls.filter(u => !manifest[u] && !fs.existsSync(path.join(OUT_DIR, urlToFilename(u))));
  console.log(`Already cached: ${urls.length - toProcess.length} | To download: ${toProcess.length}`);
  console.log('Progress: + = downloaded, . = cached, E = HTTP error, F = fetch/convert fail\n');

  const tasks = toProcess.map(url => () => processUrl(url, manifest));
  const results = await runPool(tasks, CONCURRENCY);

  // Save manifest after each batch
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('\n');

  const ok = results.filter(r => r.status === 'ok').length;
  const skip = results.filter(r => r.status === 'skip').length;
  const errors = results.filter(r => r.status === 'error');

  console.log(`Done: ${ok} downloaded, ${skip} skipped`);
  if (errors.length) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.url.slice(0, 70)}... → ${e.reason}`));
  }

  // Disk usage
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.webp'));
  const totalBytes = files.reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`assets/img/: ${files.length} WebP files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => { console.error(err); process.exit(1); });
