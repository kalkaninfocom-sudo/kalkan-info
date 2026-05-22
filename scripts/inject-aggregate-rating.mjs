#!/usr/bin/env node
// scripts/inject-aggregate-rating.mjs — AggregateRating JSON-LD static injector
// Build step: fetches reviews_aggregate from Supabase anon, injects schema.org
// AggregateRating JSON-LD into matching detail pages.
//
// Usage:
//   node scripts/inject-aggregate-rating.mjs           # live run
//   node scripts/inject-aggregate-rating.mjs --dry-run # no file writes
//
// Idempotent: removes existing injected block before re-injecting.
// No-op fallback: if Supabase returns 0 rows, exits silently.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// --- Entity → HTML page mapping ---
// entity_type values per migration: villa, restaurant, beach, tour, service, ancient_city, event
const PAGE_MAP = {
  villa:       (id) => [`villalar.html`, `en/villalar.html`, `de/villalar.html`, `ru/villalar.html`, `fr/villalar.html`],
  restaurant:  (id) => [`restoranlar.html`, `en/restoranlar.html`],
  beach:       (id) => [`plajlar.html`, `en/plajlar.html`],
  tour:        (id) => [`turlar.html`, `en/turlar.html`],
  ancient_city:(id) => [
    `antik-kentler/${id}.html`,
    `en/antik-kentler/${id}.html`,
    `de/antik-kentler/${id}.html`,
    `ru/antik-kentler/${id}.html`,
    `fr/antik-kentler/${id}.html`,
  ],
};

const INJECT_MARKER_START = '<!-- aggregate-rating-jsonld:start -->';
const INJECT_MARKER_END   = '<!-- aggregate-rating-jsonld:end -->';

function buildJsonLd(entityType, entityId, ratingValue, reviewCount) {
  const schemaType = entityType === 'ancient_city' ? 'TouristAttraction'
    : entityType === 'villa'       ? 'LodgingBusiness'
    : entityType === 'restaurant'  ? 'Restaurant'
    : entityType === 'beach'       ? 'Beach'
    : entityType === 'tour'        ? 'TouristTrip'
    : 'LocalBusiness';

  return `${INJECT_MARKER_START}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "${schemaType}",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "${Number(ratingValue).toFixed(1)}",
    "reviewCount": "${reviewCount}",
    "bestRating": "5",
    "worstRating": "1"
  }
}
</script>
${INJECT_MARKER_END}`;
}

function injectIntoHtml(html, jsonLdBlock) {
  // Remove existing injected block (idempotent)
  html = html.replace(
    new RegExp(`${INJECT_MARKER_START}[\\s\\S]*?${INJECT_MARKER_END}\\n?`, 'g'),
    ''
  );
  // Inject before </head>
  return html.replace('</head>', `${jsonLdBlock}\n</head>`);
}

async function fetchAggregates() {
  const url  = process.env.SUPABASE_URL?.trim();
  const anon = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !anon) {
    console.warn('[inject-aggregate-rating] SUPABASE_URL or SUPABASE_ANON_KEY not set — skipping');
    return [];
  }

  const endpoint = `${url}/rest/v1/reviews_aggregate?select=entity_type,entity_id,avg_rating,review_count`;
  let res;
  try {
    res = await fetch(endpoint, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    console.warn(`[inject-aggregate-rating] Supabase fetch error: ${err.message} — skipping`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[inject-aggregate-rating] Supabase returned ${res.status} — skipping`);
    return [];
  }

  return res.json();
}

async function main() {
  console.log(`[inject-aggregate-rating] starting${DRY_RUN ? ' (dry-run)' : ''}`);

  const rows = await fetchAggregates();

  if (rows.length === 0) {
    console.log('[inject-aggregate-rating] no aggregate rows — no-op, exiting');
    return;
  }

  let injected = 0;
  let skipped  = 0;

  for (const row of rows) {
    const { entity_type, entity_id, avg_rating, review_count } = row;
    if (!review_count || review_count < 1) continue;

    const pageGetter = PAGE_MAP[entity_type];
    if (!pageGetter) {
      skipped++;
      continue;
    }

    const pages = pageGetter(entity_id);
    const jsonLd = buildJsonLd(entity_type, entity_id, avg_rating, review_count);

    for (const relPath of pages) {
      const absPath = resolve(ROOT, relPath);
      if (!existsSync(absPath)) continue;

      const original = readFileSync(absPath, 'utf8');
      const updated  = injectIntoHtml(original, jsonLd);

      if (updated === original) continue;

      if (DRY_RUN) {
        console.log(`[dry-run] would inject AggregateRating into: ${relPath} (${entity_type}/${entity_id} rating=${avg_rating} count=${review_count})`);
      } else {
        writeFileSync(absPath, updated, 'utf8');
        console.log(`injected: ${relPath}`);
      }
      injected++;
    }
  }

  console.log(
    DRY_RUN
      ? `[dry-run] ${injected} injection(s) would be made, ${skipped} entity type(s) skipped`
      : `[inject-aggregate-rating] done — ${injected} page(s) updated, ${skipped} skipped`
  );
}

main().catch((err) => {
  console.error('[inject-aggregate-rating] fatal:', err.message);
  process.exit(0); // non-critical step — don't break the build
});
