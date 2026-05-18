// scripts/_publish-patara-reels.mjs — upload existing mp4 + IG REELS publish

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

const mp4Path = resolve('dist/social/patara/patara-reels.mp4');
const sz = statSync(mp4Path).size;
console.log(`MP4: ${(sz / 1024 / 1024).toFixed(2)}MB`);

// Upload
console.log('☁️  Uploading to Supabase Storage...');
const buf = readFileSync(mp4Path);
const upRes = await fetch(`${SUPA_URL}/storage/v1/object/social-media/patara/patara-reels.mp4`, {
  method: 'POST',
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!upRes.ok) { console.error('upload fail:', upRes.status, await upRes.text()); process.exit(1); }
const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/patara/patara-reels.mp4`;
console.log(`✅ ${videoUrl}`);

// Get fresh page token
const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=access_token&access_token=${USER_TOKEN}`).then(r => r.json());
const PAGE_TOKEN = acc.data?.[0]?.access_token;
if (!PAGE_TOKEN) { console.error('no page token', acc); process.exit(1); }

const IG_USER = '17841464755523227';
const caption = `🏛️ Patara — Where democracy was born.

Birthplace of Saint Nicholas. UNESCO World Heritage. 15 minutes from Kalkan. One ticket gets you the ruins AND Turkey's longest untouched beach.

Save this for your Kalkan trip 📌

📍 kalkaninfo.com

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #mediterraneantravel #hiddengems #wanderlust #turkishhistory #likya`;

// Step 1: create REELS container
console.log('1) Creating REELS container...');
const f1 = new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOKEN });
const r1 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, { method: 'POST', body: f1 });
const j1 = await r1.json();
if (!r1.ok || !j1.id) { console.error('container fail:', j1); process.exit(1); }
console.log(`  container: ${j1.id}`);

// Step 2: poll status until FINISHED
console.log('2) Polling upload status (Meta needs to process video)...');
let status = null;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const st = await fetch(`https://graph.facebook.com/v21.0/${j1.id}?fields=status_code,status&access_token=${PAGE_TOKEN}`).then(r => r.json());
  status = st.status_code;
  console.log(`  [${i*3}s] ${status}${st.status ? ' · ' + st.status : ''}`);
  if (status === 'FINISHED') break;
  if (status === 'ERROR') { console.error('process error:', st); process.exit(1); }
}
if (status !== 'FINISHED') { console.error('timeout waiting for FINISHED'); process.exit(1); }

// Step 3: publish
console.log('3) Publishing REELS...');
const f3 = new URLSearchParams({ creation_id: j1.id, access_token: PAGE_TOKEN });
const r3 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media_publish`, { method: 'POST', body: f3 });
const j3 = await r3.json();
if (!r3.ok || !j3.id) { console.error('publish fail:', j3); process.exit(1); }
console.log(`\n🎉 REELS YAYINLANDI! IG Media ID: ${j3.id}`);
console.log(`   Profilden gör: https://www.instagram.com/kalkan.info/reels/`);
