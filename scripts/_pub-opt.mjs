import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const USER_TOKEN = process.argv[2];
const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA_URL = pick('SUPABASE_URL');
const SUPA_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

const mp4 = resolve('dist/social/patara/patara-video-opt.mp4');
console.log(`MP4: ${(statSync(mp4).size / 1024 / 1024).toFixed(2)}MB`);

const buf = readFileSync(mp4);
const upRes = await fetch(`${SUPA_URL}/storage/v1/object/social-media/patara/patara-drone-cinematic.mp4`, {
  method: 'POST',
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!upRes.ok) { console.error('upload fail:', upRes.status, await upRes.text()); process.exit(1); }
const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/patara/patara-drone-cinematic.mp4`;
console.log(`✅ ${videoUrl}`);

const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=access_token&access_token=${USER_TOKEN}`).then(r => r.json());
const PAGE_TOKEN = acc.data?.[0]?.access_token;
const IG_USER = '17841464755523227';

const caption = `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — 2,200 years old.

Walk where Apollo was worshipped. Stand in a 5,000-seat theatre facing the Mediterranean. Then step onto Turkey's longest untouched beach.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

Footage: Pexels (Samir Smier, Nirjhar Basak, Kenan Turguç)

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #mediterraneantravel #hiddengems #wanderlust #turkishhistory #likya`;

const c1 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, {
  method: 'POST',
  body: new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOKEN }),
}).then(r => r.json());
if (!c1.id) { console.error('container fail:', c1); process.exit(1); }
console.log(`container: ${c1.id}`);

for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const st = await fetch(`https://graph.facebook.com/v21.0/${c1.id}?fields=status_code&access_token=${PAGE_TOKEN}`).then(r => r.json());
  process.stdout.write(`[${i*3}s] ${st.status_code}\n`);
  if (st.status_code === 'FINISHED') break;
  if (st.status_code === 'ERROR') { console.error('process error:', st); process.exit(1); }
}

const pub = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: c1.id, access_token: PAGE_TOKEN }),
}).then(r => r.json());
if (!pub.id) { console.error('publish fail:', pub); process.exit(1); }

console.log(`\n🎬🎬 DRONE CINEMATIC REELS YAYINLANDI! IG: ${pub.id}`);
console.log(`https://www.instagram.com/kalkan.info/reels/`);
