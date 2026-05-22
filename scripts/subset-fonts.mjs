#!/usr/bin/env node
// scripts/subset-fonts.mjs — Google Fonts weight subsetting
// Usage: node scripts/subset-fonts.mjs [--dry-run]
// Reduces Montserrat: 5 weights → 3, Inter: 4 weights → 2
// Estimated saving: 20-30KB per page

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// Normalise Windows path prefix (/C:/ → C:/)
const rootPath = ROOT.startsWith('/') && ROOT[2] === ':' ? ROOT.slice(1) : ROOT;

// Font URL replacement rules (order matters — most specific first)
const REPLACEMENTS = [
  // Montserrat 5 weights → 3 weights
  {
    from: /family=Montserrat:wght@500;600;700;800;900/g,
    to:   'family=Montserrat:wght@600;700;900',
  },
  {
    from: /family=Montserrat:wght@600;700;800;900/g,
    to:   'family=Montserrat:wght@600;700;900',
  },
  // Inter 4 weights → 2 weights
  {
    from: /family=Inter:wght@400;500;600;700/g,
    to:   'family=Inter:wght@400;600',
  },
  // Add subset=latin if missing (only within fonts.googleapis.com hrefs)
  {
    from: /(fonts\.googleapis\.com\/css2\?[^"']*?)(&display=swap)(?!&subset=latin)(?=[&"'])/g,
    to:   '$1&subset=latin$2',
  },
];

function collectHtmlFiles(dir, results = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return results; }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      collectHtmlFiles(full, results);
    } else if (extname(entry) === '.html') {
      results.push(full);
    }
  }
  return results;
}

const files = collectHtmlFiles(rootPath);
let changedCount = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let updated = original;
  for (const rule of REPLACEMENTS) {
    updated = updated.replace(rule.from, rule.to);
  }
  if (updated !== original) {
    changedCount++;
    if (DRY_RUN) {
      console.log(`[dry-run] would update: ${file.replace(rootPath, '')}`);
    } else {
      writeFileSync(file, updated, 'utf8');
      console.log(`updated: ${file.replace(rootPath, '')}`);
    }
  }
}

console.log(
  DRY_RUN
    ? `[dry-run] ${changedCount} file(s) would be updated (${files.length} scanned)`
    : `subset-fonts: ${changedCount} file(s) updated (${files.length} scanned)`
);
