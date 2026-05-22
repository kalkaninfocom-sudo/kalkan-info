#!/usr/bin/env node
// Inject inline SW-killer right after <meta charset> in every HTML.
// Runs synchronously during HEAD parse — does NOT wait for window.load,
// DOMContentLoaded, or any other JS. Last-resort cleanup for users whose
// page is stuck in a service-worker reload loop.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname || '.', '..');
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.vercel', '.omc', '.playwright-mcp',
  'temporary screenshots', 'data', 'scripts', 'icons', 'img', 'assets',
  'js', 'api', 'functions', 'COMPANY', 'brochures', 'tests',
]);

const MARKER = 'KALKAN_SW_KILLER_V4';
const KILLER = `<script id="kalkan-sw-killer">/* ${MARKER} — unregister SW + clear caches + drop stale admin snapshot */
(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){try{r.unregister()}catch(_){}})}).catch(function(){})}if(window.caches&&caches.keys){caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}).catch(function(){})}try{localStorage.removeItem('kalkan_info_admin_v1')}catch(_){}}catch(_){}})();
</script>`;

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

// Strip ANY prior <script id="kalkan-sw-killer">…</script> so we can swap to V4.
const PRIOR_BLOCK = /<script id=["']kalkan-sw-killer["'][\s\S]*?<\/script>\n?/i;

let patched = 0, skipped = 0, missing = 0;
for (const file of collect(ROOT)) {
  let src = readFileSync(file, 'utf8');
  if (src.includes(MARKER)) { skipped++; continue; }

  // Drop older killer block if present (V3 → V4 swap).
  src = src.replace(PRIOR_BLOCK, '');

  // Inject after notranslate meta (preferred chain), else charset, else <head>.
  let out = src.replace(
    /(<meta\s+name=["']google["'][^>]*notranslate[^>]*>)/i,
    `$1\n${KILLER}`
  );
  if (out === src) {
    out = src.replace(
      /(<meta\s+charset=["'][^"']+["']\s*\/?>)/i,
      `$1\n${KILLER}`
    );
  }
  if (out === src) {
    out = src.replace(/(<head[^>]*>)/i, `$1\n${KILLER}`);
  }
  if (out === src) { missing++; continue; }

  writeFileSync(file, out);
  patched++;
}

console.log(JSON.stringify({ patched, skipped, missing }, null, 2));
