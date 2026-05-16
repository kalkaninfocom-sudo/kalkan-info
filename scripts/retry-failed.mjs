#!/usr/bin/env node
/**
 * retry-failed.mjs
 * Manifest'te olmayan tüm Wikimedia URL'lerini sıralı (1ms/saniye) UA ile indir.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

const URL_RE = /https?:\/\/(?:upload\.wikimedia\.org|images\.unsplash\.com|images\.pexels\.com|picsum\.photos|placehold\.co)\/[^\s"'<>)]+/g;

function extractUrls(text) {
  return [...new Set(text.match(URL_RE) || [])];
}

function collectUrls() {
  const urls = new Set();
  const dataDir = path.join(ROOT, 'data');
  for (const f of fs.readdirSync(dataDir)) {
    if (!f.endsWith('.json')) continue;
    extractUrls(fs.readFileSync(path.join(dataDir, f), 'utf8')).forEach(u => urls.add(u));
  }
  for (const f of fs.readdirSync(ROOT)) {
    if (!f.endsWith('.html')) continue;
    extractUrls(fs.readFileSync(path.join(ROOT, f), 'utf8')).forEach(u => urls.add(u));
  }
  return [...urls];
}

function urlToFilename(url) {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12) + '.webp';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tryDownload(url, manifest, attempt = 1) {
  const filename = urlToFilename(url);
  const outPath = path.join(OUT_DIR, filename);
  const localPath = `/assets/img/${filename}`;

  if (manifest[url] || fs.existsSync(outPath)) {
    manifest[url] = localPath;
    return { url, status: 'skip' };
  }

  try {
    const sharp = (await import('sharp')).default;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KalkanInfoBot/1.0 (https://kalkaninfo.com; info@kalkan.info)',
        'Accept': 'image/webp,image/jpeg,image/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    if (res.status === 429 && attempt < 4) {
      console.log(`  ⏳ 429, retrying in ${attempt * 3}s (attempt ${attempt}/3): ${url.slice(0, 70)}...`);
      await sleep(attempt * 3000);
      return tryDownload(url, manifest, attempt + 1);
    }
    if (!res.ok) return { url, status: 'error', code: res.status };

    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer)
      .resize(1600, 1000, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
    manifest[url] = localPath;
    return { url, status: 'ok' };
  } catch (err) {
    return { url, status: 'error', reason: err.message };
  }
}

async function main() {
  let manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    : {};

  const urls = collectUrls();
  const todo = urls.filter(u => !manifest[u] && !fs.existsSync(path.join(OUT_DIR, urlToFilename(u))));
  console.log(`Remaining: ${todo.length}`);

  const results = [];
  for (let i = 0; i < todo.length; i++) {
    const url = todo[i];
    process.stdout.write(`[${i + 1}/${todo.length}] `);
    const r = await tryDownload(url, manifest);
    console.log(r.status === 'ok' ? '✓' : `✗ ${r.code || r.reason}`);
    results.push(r);
    // Save manifest after every successful download
    if (r.status === 'ok') fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    // Polite delay between Wikimedia requests
    if (url.includes('wikimedia.org')) await sleep(800);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const ok = results.filter(r => r.status === 'ok').length;
  const errors = results.filter(r => r.status === 'error');
  console.log(`\nDone: ${ok} downloaded`);
  if (errors.length) {
    console.log(`Still failing (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.code || e.reason} ${e.url}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
