#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GTM_ID = process.env.GTM_ID || 'GTM-PLWTGK2G';
const MARKER = '<!-- Google Tag Manager -->';
const GTM_EVENTS_MARKER = '<!-- GTM Events -->';
const GTM_EVENTS_SNIPPET = `<!-- GTM Events -->
<script src="/js/gtm-events.js" defer></script>
<!-- End GTM Events -->
`;

const HEAD_SNIPPET = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');</script>
<!-- End Google Tag Manager -->
`;

const BODY_SNIPPET = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
`;

const SCAN_DIRS = ['.', 'antik-kentler', 'admin', 'rehber', 'investor-deck'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.vercel', '.git', 'COMPANY', 'docs', 'temporary screenshots']);

function listHtml(dirRel) {
  const dirAbs = join(ROOT, dirRel);
  let entries;
  try {
    entries = readdirSync(dirAbs);
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dirAbs, name);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isFile() && name.endsWith('.html')) {
      out.push(join(dirRel, name));
    }
  }
  return out;
}

function injectInto(html) {
  const alreadyGtm = html.includes(MARKER);
  const alreadyEvents = html.includes(GTM_EVENTS_MARKER);

  if (alreadyGtm && alreadyEvents) {
    return { html, changed: false, reason: 'already injected' };
  }

  const headMatch = html.match(/<head[^>]*>/i);
  if (!headMatch) return { html, changed: false, reason: 'no <head>' };
  const bodyMatch = html.match(/<body[^>]*>/i);
  if (!bodyMatch) return { html, changed: false, reason: 'no <body>' };

  let next = html;

  // Inject GTM head+body snippets if not present
  if (!alreadyGtm) {
    const headEnd = headMatch.index + headMatch[0].length;
    next = next.slice(0, headEnd) + '\n' + HEAD_SNIPPET + next.slice(headEnd);

    const bodyMatch2 = next.match(/<body[^>]*>/i);
    const bodyEnd = bodyMatch2.index + bodyMatch2[0].length;
    next = next.slice(0, bodyEnd) + '\n' + BODY_SNIPPET + next.slice(bodyEnd);
  }

  // Inject GTM Events script after End GTM comment in <head>
  if (!alreadyEvents) {
    const endGtmMarker = '<!-- End Google Tag Manager -->';
    const endGtmIdx = next.indexOf(endGtmMarker);
    if (endGtmIdx !== -1) {
      const insertAt = endGtmIdx + endGtmMarker.length;
      next = next.slice(0, insertAt) + '\n' + GTM_EVENTS_SNIPPET + next.slice(insertAt);
    }
  }

  return { html: next, changed: next !== html };
}

const files = SCAN_DIRS.flatMap(listHtml).sort();
let injected = 0;
let skipped = 0;

for (const rel of files) {
  const abs = join(ROOT, rel);
  const original = readFileSync(abs, 'utf8');
  const result = injectInto(original);
  if (result.changed) {
    writeFileSync(abs, result.html, 'utf8');
    injected++;
    console.log(`  + ${rel}`);
  } else {
    skipped++;
    if (process.env.VERBOSE) console.log(`  - ${rel} (${result.reason})`);
  }
}

console.log(`\nGTM ${GTM_ID}: ${injected} injected, ${skipped} skipped (of ${files.length} HTML files)`);
