#!/usr/bin/env node
/**
 * replace-unsplash.mjs
 * Reads manifest.json and replaces all Unsplash URLs with local WebP paths
 * in data/*.json and *.html files.
 * Usage:
 *   node scripts/replace-unsplash.mjs          # live run
 *   node scripts/replace-unsplash.mjs --dry    # dry-run, only counts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'img', 'manifest.json');

const DRY = process.argv.includes('--dry');

// ── Load manifest ────────────────────────────────────────────────────────────

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('manifest.json not found. Run img:download first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const manifestEntries = Object.entries(manifest); // [originalUrl, localPath]

console.log(`Manifest has ${manifestEntries.length} entries`);
if (DRY) console.log('DRY RUN — no files will be modified\n');

// ── Replace in a single file ─────────────────────────────────────────────────

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let replacements = 0;

  for (const [original, local] of manifestEntries) {
    // Skip if local path already present (idempotent)
    if (content.includes(local)) continue;

    // Escape special regex chars in URL
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    const count = (content.match(re) || []).length;
    if (count > 0) {
      content = content.replace(re, local);
      replacements += count;
    }
  }

  if (replacements > 0 && !DRY) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return replacements;
}

// ── Collect target files ─────────────────────────────────────────────────────

const targets = [];

// data/*.json
const dataDir = path.join(ROOT, 'data');
for (const f of fs.readdirSync(dataDir)) {
  if (f.endsWith('.json')) targets.push(path.join(dataDir, f));
}

// *.html in root
for (const f of fs.readdirSync(ROOT)) {
  if (f.endsWith('.html')) targets.push(path.join(ROOT, f));
}

// ── Run ──────────────────────────────────────────────────────────────────────

let totalFiles = 0;
let totalReplacements = 0;

for (const file of targets) {
  const count = processFile(file);
  if (count > 0) {
    const rel = path.relative(ROOT, file);
    console.log(`  ${rel}: ${count} replacement${count > 1 ? 's' : ''}`);
    totalFiles++;
    totalReplacements += count;
  }
}

console.log(`\nTotal: ${totalReplacements} URL${totalReplacements !== 1 ? 's' : ''} replaced across ${totalFiles} file${totalFiles !== 1 ? 's' : ''}`);

// Verify: count remaining Unsplash refs
if (!DRY) {
  let remaining = 0;
  for (const file of targets) {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(/https:\/\/images\.unsplash\.com/g) || [];
    remaining += matches.length;
  }
  if (remaining > 0) {
    console.log(`\nWarning: ${remaining} Unsplash URLs still remain (not in manifest — run img:download again)`);
  } else {
    console.log('All Unsplash URLs replaced successfully.');
  }
}
