#!/usr/bin/env node
/**
 * convert-jpg-to-webp.mjs
 * Convert all *.jpg files under assets/img/ to *.webp (quality 85),
 * preserving width. Old .jpg files are KEPT (other code may still reference them).
 * Then update JSON files in data/ to point any .jpg paths to .webp.
 *
 * Usage:
 *   node scripts/convert-jpg-to-webp.mjs
 *   node scripts/convert-jpg-to-webp.mjs --dry-run
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'assets', 'img');
const DATA_DIR = path.join(ROOT, 'data');
const DRY_RUN = process.argv.includes('--dry-run');

const QUALITY = 85;

async function listJpgs() {
  const entries = await fs.readdir(IMG_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.(jpe?g)$/i.test(e.name))
    .map((e) => path.join(IMG_DIR, e.name));
}

async function convertOne(jpgPath) {
  const webpPath = jpgPath.replace(/\.(jpe?g)$/i, '.webp');
  let existed = false;
  try {
    await fs.access(webpPath);
    existed = true;
  } catch {}
  if (existed) {
    return { jpgPath, webpPath, skipped: true };
  }
  if (DRY_RUN) {
    return { jpgPath, webpPath, dryRun: true };
  }
  await sharp(jpgPath).webp({ quality: QUALITY }).toFile(webpPath);
  const stat = await fs.stat(webpPath);
  return { jpgPath, webpPath, bytes: stat.size };
}

async function updateJsonFiles(jpgBasenames) {
  // jpgBasenames: Set of "/assets/img/foo.jpg" => "/assets/img/foo.webp"
  let touched = 0;
  const files = await fs.readdir(DATA_DIR, { withFileTypes: true });
  for (const f of files) {
    if (!f.isFile() || !f.name.endsWith('.json')) continue;
    const p = path.join(DATA_DIR, f.name);
    const raw = await fs.readFile(p, 'utf8');
    let out = raw;
    for (const [jpgPath, webpPath] of jpgBasenames.entries()) {
      // match both "/assets/img/x.jpg" and "assets/img/x.jpg"
      const escaped = jpgPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      out = out.replace(re, webpPath);
    }
    if (out !== raw) {
      try {
        JSON.parse(out);
      } catch (e) {
        console.error(`SKIP ${f.name} — JSON invalid after rewrite: ${e.message}`);
        continue;
      }
      if (!DRY_RUN) await fs.writeFile(p, out, 'utf8');
      touched++;
      console.log(`  updated data/${f.name}`);
    }
  }
  return touched;
}

async function main() {
  const jpgs = await listJpgs();
  console.log(`Found ${jpgs.length} JPG files under assets/img/`);
  const results = [];
  const map = new Map();
  for (const jpg of jpgs) {
    const r = await convertOne(jpg);
    results.push(r);
    const rel = '/assets/img/' + path.basename(r.jpgPath);
    const relWebp = '/assets/img/' + path.basename(r.webpPath);
    map.set(rel, relWebp);
    if (r.skipped) console.log(`  skip (webp exists) ${path.basename(r.jpgPath)}`);
    else if (r.dryRun) console.log(`  would convert ${path.basename(r.jpgPath)}`);
    else console.log(`  converted ${path.basename(r.jpgPath)} -> ${(r.bytes / 1024).toFixed(1)}KB`);
  }
  console.log('');
  console.log('Updating data/*.json references...');
  const touched = await updateJsonFiles(map);
  console.log('');
  console.log(`Done. Converted: ${results.filter((r) => !r.skipped && !r.dryRun).length}, Skipped: ${results.filter((r) => r.skipped).length}, JSON files updated: ${touched}.`);
  if (DRY_RUN) console.log('[DRY RUN — no files written]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
