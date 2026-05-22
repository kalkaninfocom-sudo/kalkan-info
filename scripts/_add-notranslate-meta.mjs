#!/usr/bin/env node
// One-shot patch: add <meta name="google" content="notranslate"> right after <meta charset="utf-8">
// Skipped if already present. Runs over source HTML + multilang outputs (en/de/ru/fr).
//
// Why: Chrome auto-translate widget wipes dynamically-rendered cards (news/tours/restaurants),
// causing apparently-blank sections. Site has its own i18n; Chrome's translator must stay off.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname || '.', '..');
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.vercel', '.omc', '.playwright-mcp',
  'temporary screenshots', 'data', 'scripts', 'icons', 'img', 'assets',
  'js', 'api', 'functions', 'COMPANY', 'brochures', 'tests',
]);

const META_TAG = '<meta name="google" content="notranslate">';
const MARKER = 'name="google"';

function collect(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) collect(p, acc);
    else if (e.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let patched = 0, skipped = 0, missingHead = 0;
for (const file of collect(ROOT)) {
  const src = readFileSync(file, 'utf8');
  if (src.includes(MARKER)) { skipped++; continue; }

  // Inject right after the <meta charset> line; fall back to right after <head>
  let out = src.replace(
    /(<meta\s+charset=["'][^"']+["']\s*\/?>)/i,
    `$1\n${META_TAG}`
  );
  if (out === src) {
    out = src.replace(/(<head[^>]*>)/i, `$1\n${META_TAG}`);
  }
  if (out === src) { missingHead++; continue; }

  writeFileSync(file, out);
  patched++;
}

console.log(JSON.stringify({ patched, skipped, missingHead }, null, 2));
