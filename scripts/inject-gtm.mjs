#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GTM_ID = process.env.GTM_ID || 'GTM-PLWTGK2G';
const META_PIXEL_ID = process.env.META_PIXEL_ID || '872659329210680';
const MARKER = '<!-- Google Tag Manager -->';
const GTM_EVENTS_MARKER = '<!-- GTM Events -->';
const META_PIXEL_MARKER = '<!-- Meta Pixel Code -->';
const GTM_EVENTS_SNIPPET = `<!-- GTM Events -->
<script src="/js/gtm-events.js" defer></script>
<!-- End GTM Events -->
`;
const META_PIXEL_HEAD = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->
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
  const alreadyPixel = html.includes(META_PIXEL_MARKER);

  if (alreadyGtm && alreadyEvents && alreadyPixel) {
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

  // Inject Meta Pixel after End GTM Events in <head>
  if (!alreadyPixel) {
    const endEventsMarker = '<!-- End GTM Events -->';
    const endEventsIdx = next.indexOf(endEventsMarker);
    if (endEventsIdx !== -1) {
      const insertAt = endEventsIdx + endEventsMarker.length;
      next = next.slice(0, insertAt) + '\n' + META_PIXEL_HEAD + next.slice(insertAt);
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
