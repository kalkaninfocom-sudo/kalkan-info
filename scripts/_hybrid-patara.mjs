// Hybrid Patara reels: Patara'nın gerçek webp'leri (zoom-pan) + Pixabay müzik
// 1) Upload 3 Patara webp to Supabase Storage
// 2) Pexels "Patara antik" search — varsa ek B-roll
// 3) Remotion AntikKent (image template) render with REAL Patara assets
// 4) ffmpeg music mix
// 5) IG REELS publish

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PAGE_TOK = process.argv[2];
const PEXELS_KEY = '55915949-dc268c403aa21756b1890f0d3';
if (!PAGE_TOK) { console.error('Usage: ... <page_token>'); process.exit(1); }

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

// 1) Patara'nın gerçek webp'lerini Storage'a upload
console.log('1) Real Patara webp upload to Storage...');
const pataraImgs = [
  '/assets/img/d018efe8f905.webp', // hero (antik kent)
  '/assets/img/488f36a95000.webp', // detay
  '/assets/img/a1f93ffd6095.webp', // detay
];
const uploadedUrls = [];
for (let i = 0; i < pataraImgs.length; i++) {
  const localPath = pataraImgs[i].slice(1);
  const buf = readFileSync(localPath);
  const dest = `patara/real/img-${i + 1}.webp`;
  const r = await fetch(`${SUPA}/storage/v1/object/social-media/${dest}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: buf,
  });
  if (!r.ok) { console.error('upload fail', r.status); continue; }
  const url = `${SUPA}/storage/v1/object/public/social-media/${dest}`;
  uploadedUrls.push(url);
  console.log(`  ✓ ${url}`);
}

// 2) Pexels "Patara antik" search (varsa ek)
console.log('\n2) Pexels Patara search...');
const search = await fetch(
  `https://api.pexels.com/videos/search?query=patara+ancient+turkey&orientation=portrait&size=medium&per_page=3`,
  { headers: { Authorization: PEXELS_KEY } }
).then(r => r.json());
console.log(`  Pexels Patara: ${search.videos?.length || 0} sonuç`);
if (search.videos?.length) {
  for (const v of search.videos.slice(0, 1)) {
    console.log(`  - ${v.url}`);
  }
}

// 3) Render with image-based AntikKent template
console.log('\n3) Remotion render (image-based Patara)...');
const props = {
  name: 'PATARA',
  tagline: 'Where Democracy Was Born',
  era: '2,200 years ago',
  highlights: [
    "World's first democratic parliament",
    'Birthplace of Saint Nicholas',
    'Capital of the Lycian League',
    "Turkey's longest untouched beach",
  ],
  closingLine: 'One ticket. Two ancient wonders.',
  ctaText: 'Save this for your Kalkan trip',
  domain: 'kalkaninfo.com',
  heroImage: uploadedUrls[0],
  scene2Image: uploadedUrls[1] || uploadedUrls[0],
  scene3Image: uploadedUrls[2] || uploadedUrls[0],
  hashtags: ['#kalkan', '#patara', '#lycia', '#unesco', '#turkeytravel'],
};
const propsPath = resolve('dist/social/patara/_props-hybrid.json');
writeFileSync(propsPath, JSON.stringify(props));

const outRender = resolve('dist/social/patara/patara-hybrid.mp4');
const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'AntikKent', outRender, `--props=${propsPath}`, '--log=error'], {
  cwd: 'remotion', stdio: 'inherit', shell: true,
});
if (r.status !== 0) { console.error('render fail'); process.exit(1); }
console.log(`  ✓ ${(statSync(outRender).size / 1024 / 1024).toFixed(2)}MB`);

// 4) Music mix
console.log('\n4) Music mix...');
const finalMp4 = resolve('dist/social/patara/patara-hybrid-music.mp4');
const mix = spawnSync('ffmpeg', [
  '-y', '-i', outRender, '-i', 'dist/audio/track1.mp3',
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k', '-shortest',
  '-af', 'afade=in:st=0:d=1,afade=out:st=29:d=1,volume=0.65',
  finalMp4,
], { stdio: 'inherit' });
if (mix.status !== 0) { console.error('mix fail'); process.exit(1); }
console.log(`  ✓ ${(statSync(finalMp4).size / 1024 / 1024).toFixed(2)}MB`);

// 5) Upload + publish
console.log('\n5) Upload + IG REELS publish...');
const buf = readFileSync(finalMp4);
const up = await fetch(`${SUPA}/storage/v1/object/social-media/patara/patara-hybrid-music.mp4`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!up.ok) { console.error('upload fail', up.status, await up.text()); process.exit(1); }
const videoUrl = `${SUPA}/storage/v1/object/public/social-media/patara/patara-hybrid-music.mp4`;
console.log(`  ✓ ${videoUrl}`);

const caption = `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — 2,200 years old.

Walk where Apollo was worshipped. Stand in a 5,000-seat theatre facing the Mediterranean. Then step onto Turkey's longest untouched beach.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

Music: Pixabay

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #lycianway #hiddenturkey #wanderlust #turkishhistory #likya`;

const IG = '17841464755523227';
const c = await fetch(`https://graph.facebook.com/v21.0/${IG}/media`, {
  method: 'POST',
  body: new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOK }),
}).then(r => r.json());
if (!c.id) { console.error('container', c); process.exit(1); }
console.log(`  container: ${c.id}`);

for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const s = await fetch(`https://graph.facebook.com/v21.0/${c.id}?fields=status_code&access_token=${PAGE_TOK}`).then(r => r.json());
  process.stdout.write(`  [${i*3}s] ${s.status_code}\n`);
  if (s.status_code === 'FINISHED') break;
  if (s.status_code === 'ERROR') { console.error(s); process.exit(1); }
}

const p = await fetch(`https://graph.facebook.com/v21.0/${IG}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: c.id, access_token: PAGE_TOK }),
}).then(r => r.json());
if (!p.id) { console.error('publish', p); process.exit(1); }
console.log(`\n🎬 HYBRID PATARA REELS YAYINLANDI! IG: ${p.id}`);
console.log('   Gerçek Patara görselleri + Cinematic music + Brand template');
console.log('   https://www.instagram.com/kalkan.info/reels/');
