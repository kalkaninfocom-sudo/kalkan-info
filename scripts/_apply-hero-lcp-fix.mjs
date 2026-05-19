#!/usr/bin/env node
/**
 * _apply-hero-lcp-fix.mjs (one-shot)
 * For each page in TARGETS, find the *first* <img> tag in the body (the hero)
 * and:
 *   - replace loading="lazy" with loading="eager"
 *   - ensure fetchpriority="high"
 *   - ensure decoding="async"
 * Also injects a <link rel="preload" as="image" href="<hero>" fetchpriority="high">
 * into <head> if not already present.
 *
 * Uses regex (single-pass per file) — no HTML parser needed.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  'index.html',
  'restoranlar.html',
  'villalar.html',
  'plajlar.html',
  'turlar.html',
  'hizmetler.html',
  'hakkimizda.html',
  'antik-kentler.html',
  'haberler.html',
  'aktiviteler.html',
  'tatil-asistani.html',
];

function patchHeroImg(html) {
  // Find first <img ...> tag with src="/assets/img/..."
  const re = /<img\b([^>]*?)\/?>/;
  const m = html.match(re);
  if (!m) return { html, hero: null };
  const fullTag = m[0];
  const attrs = m[1];
  const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]+)"/);
  if (!srcMatch) return { html, hero: null };
  const heroSrc = srcMatch[1];
  if (!heroSrc.startsWith('/assets/img/')) return { html, hero: null };

  let newAttrs = attrs;
  // Replace loading="lazy" -> loading="eager"
  if (/\bloading\s*=\s*"lazy"/.test(newAttrs)) {
    newAttrs = newAttrs.replace(/\bloading\s*=\s*"lazy"/, 'loading="eager"');
  } else if (!/\bloading\s*=/.test(newAttrs)) {
    newAttrs = ' loading="eager"' + newAttrs;
  }
  // Ensure fetchpriority="high"
  if (!/\bfetchpriority\s*=/.test(newAttrs)) {
    newAttrs = newAttrs + ' fetchpriority="high"';
  } else {
    newAttrs = newAttrs.replace(/\bfetchpriority\s*=\s*"[^"]*"/, 'fetchpriority="high"');
  }
  // Ensure decoding="async"
  if (!/\bdecoding\s*=/.test(newAttrs)) {
    newAttrs = newAttrs + ' decoding="async"';
  }
  // Tidy double spaces inside the attribute list
  newAttrs = newAttrs.replace(/\s{2,}/g, ' ');

  const newTag = '<img' + newAttrs + (fullTag.endsWith('/>') ? '/>' : '>');
  const out = html.replace(re, newTag);
  return { html: out, hero: heroSrc };
}

function injectPreload(html, heroSrc) {
  // skip if already present
  const escaped = heroSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reExisting = new RegExp(`<link[^>]+rel=["']preload["'][^>]+href=["']${escaped}["']`, 'i');
  if (reExisting.test(html)) return { html, injected: false };

  const linkTag = `<link rel="preload" as="image" href="${heroSrc}" fetchpriority="high">`;
  // Insert before </head>
  const idx = html.search(/<\/head>/i);
  if (idx < 0) return { html, injected: false };
  return {
    html: html.slice(0, idx) + linkTag + '\n' + html.slice(idx),
    injected: true,
  };
}

async function processOne(file) {
  const filePath = path.join(ROOT, file);
  let html;
  try {
    html = await fs.readFile(filePath, 'utf8');
  } catch {
    console.log(`  skip (missing) ${file}`);
    return;
  }
  const { html: patched, hero } = patchHeroImg(html);
  if (!hero) {
    console.log(`  ${file}: no eligible hero img found`);
    return;
  }
  const { html: final, injected } = injectPreload(patched, hero);
  await fs.writeFile(filePath, final, 'utf8');
  console.log(`  ${file}: hero=${hero}${injected ? ' [+preload]' : ' [preload already there]'}`);
}

async function main() {
  for (const t of TARGETS) await processOne(t);
}
main().catch((e) => { console.error(e); process.exit(1); });
