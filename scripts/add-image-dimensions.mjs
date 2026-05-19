#!/usr/bin/env node
/**
 * add-image-dimensions.mjs
 * Add width/height attributes to selected <img> tags in HTML files using
 * sharp metadata. Only updates tags that already point at /assets/img/* and
 * don't already have a width attribute.
 *
 * Strategy:
 *  - For each HTML file in the target list, find <img> tags with src="/assets/img/..."
 *  - Limit to: hero (first img on the page) + first 4 imgs in each grid section + first 4 gallery imgs
 *  - For simplicity we add dims to up to N imgs per page (cap=8) so the total stays around 20-30.
 *
 * Usage:
 *   node scripts/add-image-dimensions.mjs
 *   node scripts/add-image-dimensions.mjs --dry-run
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const TARGETS = [
  { file: 'index.html', cap: 12 },           // hero + featured grids
  { file: 'restoranlar.html', cap: 6 },      // hero + 4 cards
  { file: 'villalar.html', cap: 6 },
  { file: 'plajlar.html', cap: 6 },
  { file: 'turlar.html', cap: 6 },
  { file: 'hizmetler.html', cap: 6 },
  { file: 'hakkimizda.html', cap: 2 },
  { file: 'antik-kentler.html', cap: 6 },
  { file: 'haberler.html', cap: 6 },
  { file: 'aktiviteler.html', cap: 6 },
  { file: 'tatil-asistani.html', cap: 2 },
];

async function getDim(srcPath) {
  // srcPath is like "/assets/img/abc.webp"
  const abs = path.join(ROOT, srcPath.replace(/^\//, ''));
  try {
    const m = await sharp(abs).metadata();
    if (m.width && m.height) return { w: m.width, h: m.height };
  } catch (e) {
    return null;
  }
  return null;
}

async function processFile(target) {
  const filePath = path.join(ROOT, target.file);
  let html;
  try {
    html = await fs.readFile(filePath, 'utf8');
  } catch {
    console.log(`  skip (missing) ${target.file}`);
    return { changed: 0 };
  }

  // Find <img ...> tags
  const imgRe = /<img\b([^>]*?)\/?>/g;
  let match;
  const replacements = [];
  let count = 0;
  while ((match = imgRe.exec(html)) !== null) {
    if (count >= target.cap) break;
    const fullTag = match[0];
    const attrs = match[1];
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]+)"/);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    if (!src.startsWith('/assets/img/')) continue;
    if (/\bwidth\s*=/.test(attrs)) continue; // already has width

    const dim = await getDim(src);
    if (!dim) continue;

    // Insert width/height right after <img
    const newTag = fullTag.replace(/<img\b/, `<img width="${dim.w}" height="${dim.h}"`);
    replacements.push({ from: fullTag, to: newTag, start: match.index });
    count++;
  }

  if (replacements.length === 0) {
    console.log(`  ${target.file}: no eligible img tags`);
    return { changed: 0 };
  }

  // Apply replacements from end to start so indices stay valid
  let out = html;
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.to + out.slice(r.start + r.from.length);
  }

  if (!DRY_RUN) await fs.writeFile(filePath, out, 'utf8');
  console.log(`  ${target.file}: added dims to ${replacements.length} img(s)`);
  return { changed: replacements.length };
}

async function main() {
  let total = 0;
  for (const t of TARGETS) {
    const r = await processFile(t);
    total += r.changed;
  }
  console.log(`\nDone. Total <img> tags updated: ${total}.`);
  if (DRY_RUN) console.log('[DRY RUN — no files written]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
