#!/usr/bin/env node
/**
 * build-tailwind.mjs
 * Scans all HTML + JS files, runs tailwindcss CLI to produce dist/tw.css
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── 1. Ensure dist/ exists ────────────────────────────────────────────────────
const distDir = join(ROOT, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
  console.log('[tailwind] Created dist/');
}

// ── 2. Quick class-frequency audit (top 10, informational only) ───────────────
const classRegex = /class(?:Name)?=["']([^"']+)["']/g;
const freq = {};

function scanFile(filePath) {
  const src = readFileSync(filePath, 'utf8');
  let m;
  while ((m = classRegex.exec(src)) !== null) {
    for (const cls of m[1].split(/\s+/)) {
      if (cls) freq[cls] = (freq[cls] || 0) + 1;
    }
  }
}

// Scan root HTML
for (const f of readdirSync(ROOT)) {
  if (f.endsWith('.html')) scanFile(join(ROOT, f));
}

// Scan js/*.js
const jsDir = join(ROOT, 'js');
if (existsSync(jsDir)) {
  for (const f of readdirSync(jsDir)) {
    if (f.endsWith('.js')) scanFile(join(jsDir, f));
  }
}

// Scan admin/ HTML
const adminDir = join(ROOT, 'admin');
if (existsSync(adminDir)) {
  for (const f of readdirSync(adminDir)) {
    if (f.endsWith('.html')) scanFile(join(adminDir, f));
  }
}

const top10 = Object.entries(freq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log('[tailwind] Top 10 classes by frequency:');
for (const [cls, count] of top10) {
  console.log(`  ${String(count).padStart(4)}x  ${cls}`);
}

// ── 3. Run tailwindcss CLI ────────────────────────────────────────────────────
const input  = join(ROOT, 'scripts', 'tw-input.css');
const output = join(ROOT, 'dist', 'tw.css');
const config = join(ROOT, 'tailwind.config.mjs');

const cmd = `npx tailwindcss -c "${config}" -i "${input}" -o "${output}" --minify`;
console.log(`[tailwind] Running: ${cmd}`);

execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

// ── 4. Report output size ─────────────────────────────────────────────────────
import { statSync } from 'node:fs';
const bytes = statSync(output).size;
const kb    = (bytes / 1024).toFixed(1);
console.log(`[tailwind] Output: dist/tw.css  ${kb} KB  (${bytes.toLocaleString()} bytes)`);
