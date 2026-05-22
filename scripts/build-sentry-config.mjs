/**
 * Build-time generator for js/sentry-config.js
 * Reads SENTRY_DSN_CLIENT from env (Vercel sets it) and writes a classic
 * script that exposes window.SENTRY_DSN_CLIENT + window.SENTRY_RELEASE
 * before js/sentry-init.js runs.
 *
 * Local dev: file is .gitignored; sentry-init.js short-circuits if DSN missing.
 * Production: this script overwrites it during `vercel build`.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'js', 'sentry-config.js');

const dsn = process.env.SENTRY_DSN_CLIENT?.trim();
const release = (process.env.VERCEL_GIT_COMMIT_SHA?.trim() || 'dev').slice(0, 7);

if (!dsn) {
  writeFileSync(outPath, '// SENTRY_DSN_CLIENT missing — Sentry disabled\n', 'utf8');
  console.log('[build-sentry-config] no DSN in env — wrote disabled stub');
  process.exit(0);
}

const body = `// AUTO-GENERATED at build time — do not edit by hand.
window.SENTRY_DSN_CLIENT = ${JSON.stringify(dsn)};
window.SENTRY_RELEASE = ${JSON.stringify('kalkan-info@' + release)};
`;

writeFileSync(outPath, body, 'utf8');
console.log(`[build-sentry-config] wrote ${outPath} (release=${release})`);
