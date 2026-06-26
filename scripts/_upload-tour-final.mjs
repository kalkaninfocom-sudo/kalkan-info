import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

const path = resolve('dist/site-tour/webapp-tour-final.mp4');
const buf = readFileSync(path);
console.log(`☁️  Uploading ${(buf.length / 1024 / 1024).toFixed(2)}MB...`);

const up = await fetch(
  `${SUPA}/storage/v1/object/social-media/site-tour/webapp-tour-final.mp4`,
  {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  }
);
if (!up.ok) { console.error('FAIL', up.status, await up.text()); process.exit(1); }
const url = `${SUPA}/storage/v1/object/public/social-media/site-tour/webapp-tour-final.mp4`;
console.log(`✅ ${url}`);
