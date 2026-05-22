/**
 * One-shot injector: adds <script src=".../sentry-config.js"></script> +
 * <script src=".../sentry-init.js" defer></script> just before </head>
 * in every source *.html file. Idempotent — skips files already containing
 * "sentry-config.js".
 *
 * Run once: `node scripts/inject-sentry-tags.mjs`
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, relative, dirname, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.vercel', '.next', 'dist', 'build',
  'temporary screenshots', 'COMPANY', 'brochures',
]);

const htmlFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(p);
  }
}
walk(ROOT);

let modified = 0, skipped = 0;
const jsDir = resolve(ROOT, 'js');

for (const file of htmlFiles) {
  const src = readFileSync(file, 'utf8');
  if (src.includes('sentry-config.js')) { skipped++; continue; }
  if (!src.includes('</head>')) { skipped++; continue; }

  // relative path from HTML file's dir to js/ dir
  const fromDir = dirname(file);
  let rel = relative(fromDir, jsDir).split(sep).join(posix.sep);
  if (!rel.startsWith('.')) rel = './' + rel;

  const tags = `  <script src="${rel}/sentry-config.js"></script>\n  <script src="${rel}/sentry-init.js" defer></script>\n`;
  const out = src.replace('</head>', tags + '</head>');
  writeFileSync(file, out, 'utf8');
  modified++;
}

console.log(`[inject-sentry-tags] modified=${modified} skipped=${skipped} total=${htmlFiles.length}`);
