import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const USER_TOKEN = process.argv[2];
if (!USER_TOKEN) { console.error('Usage: ... <user_token>'); process.exit(1); }

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA_URL = pick('SUPABASE_URL');
const SUPA_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

const mp4Path = resolve('dist/social/patara/patara-cinematic.mp4');
console.log(`MP4: ${(statSync(mp4Path).size / 1024 / 1024).toFixed(2)}MB`);

console.log('☁️  Uploading...');
const buf = readFileSync(mp4Path);
const upRes = await fetch(`${SUPA_URL}/storage/v1/object/social-media/patara/patara-cinematic.mp4`, {
  method: 'POST',
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!upRes.ok) { console.error('upload fail:', upRes.status, await upRes.text()); process.exit(1); }
const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/patara/patara-cinematic.mp4`;
console.log(`✅ ${videoUrl}`);

const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=access_token&access_token=${USER_TOKEN}`).then(r => r.json());
const PAGE_TOKEN = acc.data?.[0]?.access_token;
const IG_USER = '17841464755523227';

const caption = `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — 2,200 years old.

Walk where Apollo was worshipped. Stand in a 5,000-seat theatre facing the Mediterranean. Then step onto Turkey's longest untouched beach.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #mediterraneantravel #hiddengems #wanderlust #turkishhistory #likya`;

console.log('1) REELS container...');
const f1 = new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOKEN });
const r1 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, { method: 'POST', body: f1 });
const j1 = await r1.json();
if (!r1.ok || !j1.id) { console.error('container fail:', j1); process.exit(1); }
console.log(`  container: ${j1.id}`);

console.log('2) Polling...');
let status = null;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const st = await fetch(`https://graph.facebook.com/v21.0/${j1.id}?fields=status_code,status&access_token=${PAGE_TOKEN}`).then(r => r.json());
  status = st.status_code;
  process.stdout.write(`  [${i*3}s] ${status}\n`);
  if (status === 'FINISHED') break;
  if (status === 'ERROR') { console.error('process error:', st); process.exit(1); }
}
if (status !== 'FINISHED') { console.error('timeout'); process.exit(1); }

console.log('3) Publishing...');
const r3 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: j1.id, access_token: PAGE_TOKEN }),
});
const j3 = await r3.json();
if (!r3.ok || !j3.id) { console.error('publish fail:', j3); process.exit(1); }
console.log(`\n🎬 CINEMATIC REELS YAYINLANDI! IG Media ID: ${j3.id}`);
console.log(`   https://www.instagram.com/kalkan.info/reels/`);
