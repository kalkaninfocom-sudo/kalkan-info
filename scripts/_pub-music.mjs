import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
const PAGE_TOK = process.argv[2];
const IG = '17841464755523227';

const buf = readFileSync('dist/social/patara/patara-music.mp4');
console.log('Upload', (buf.length/1024/1024).toFixed(2)+'MB...');
const up = await fetch(`${SUPA}/storage/v1/object/social-media/patara/patara-music.mp4`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!up.ok) { console.error('upload fail', up.status, await up.text()); process.exit(1); }
const url = `${SUPA}/storage/v1/object/public/social-media/patara/patara-music.mp4`;
console.log('✓', url);

const caption = `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. World's first democratic parliament — 2,200 years old.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

Footage: Pexels · Music: Pixabay

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology`;

const c = await fetch(`https://graph.facebook.com/v21.0/${IG}/media`, {
  method: 'POST',
  body: new URLSearchParams({ media_type: 'REELS', video_url: url, caption, share_to_feed: 'true', access_token: PAGE_TOK }),
}).then(r => r.json());
if (!c.id) { console.error('container', c); process.exit(1); }
console.log('container', c.id);

for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const s = await fetch(`https://graph.facebook.com/v21.0/${c.id}?fields=status_code&access_token=${PAGE_TOK}`).then(r => r.json());
  process.stdout.write(`[${i*3}s] ${s.status_code}\n`);
  if (s.status_code === 'FINISHED') break;
  if (s.status_code === 'ERROR') { console.error(s); process.exit(1); }
}

const p = await fetch(`https://graph.facebook.com/v21.0/${IG}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: c.id, access_token: PAGE_TOK }),
}).then(r => r.json());
if (!p.id) { console.error('publish', p); process.exit(1); }
console.log(`\n🎵 MÜZİKLİ REELS YAYINLANDI! IG: ${p.id}`);
console.log('https://www.instagram.com/kalkan.info/reels/');
