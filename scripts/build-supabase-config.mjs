/**
 * Build-time generator for js/supabase-config.js
 * Reads SUPABASE_URL + SUPABASE_ANON_KEY from env (Vercel sets these) and
 * writes a static ESM module that the browser-side client can import.
 *
 * Local dev: developer keeps a hand-edited js/supabase-config.js (gitignored).
 * Production: this script overwrites it during `vercel build`.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'js', 'supabase-config.js');

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('[build-supabase-config] SUPABASE_URL or SUPABASE_ANON_KEY missing in env — skipping write');
  process.exit(0);
}

const body = `// AUTO-GENERATED at build time — do not edit by hand in production.
// Local dev: replace with your own values; this file is .gitignored.
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(anon)};
`;

writeFileSync(outPath, body, 'utf8');
console.log(`[build-supabase-config] wrote ${outPath}`);
