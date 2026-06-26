// Upload webapp tour screenshots to Supabase Storage: social-media/site-tour/screens/*.png
// Returns the public URLs for use in WebappTour.tsx defaults.

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
if (!SUPA || !KEY) { console.error('SUPABASE env missing'); process.exit(1); }

const ids = ['home', 'restoranlar', 'villalar', 'plajlar', 'antik', 'hizmetler', 'ilanlar', 'tatil'];
const urls = {};

for (const id of ids) {
  const path = resolve(`dist/site-tour/screens/${id}.png`);
  const buf = readFileSync(path);
  process.stdout.write(`☁️  ${id}.png (${(buf.length / 1024).toFixed(0)}KB) ... `);
  const up = await fetch(
    `${SUPA}/storage/v1/object/social-media/site-tour/screens/${id}.png`,
    {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: buf,
    }
  );
  if (!up.ok) {
    console.error('FAIL:', await up.text());
    process.exit(1);
  }
  const url = `${SUPA}/storage/v1/object/public/social-media/site-tour/screens/${id}.png`;
  urls[id] = url;
  console.log('✓');
}

console.log('\n📋 URLs (paste into WebappTour.tsx defaults):\n');
console.log(JSON.stringify(urls, null, 2));
