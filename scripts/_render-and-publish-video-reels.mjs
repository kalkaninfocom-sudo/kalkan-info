// Render AntikKentVideo composition with Pexels clips + upload + publish IG REELS

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const USER_TOKEN = process.argv[2];
const pack = process.argv[3] || 'patara';
if (!USER_TOKEN) { console.error('Usage: ... <user_token> [pack]'); process.exit(1); }

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA_URL = pick('SUPABASE_URL');
const SUPA_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

// Load content pack data
const reelsPacks = JSON.parse(readFileSync('content/antik-reels.json', 'utf8'));
const item = reelsPacks.items.find(i => i.id === pack);
if (!item) { console.error(`pack ${pack} not found`); process.exit(1); }

// Load drone clips manifest
const manifest = JSON.parse(readFileSync(`content/${pack}-drone-clips.json`, 'utf8'));
if (!manifest.clips || manifest.clips.length < 3) {
  console.error(`need 3+ clips, got ${manifest.clips?.length}`);
  process.exit(1);
}

// Build props for AntikKentVideo composition
const taglineMap = {
  patara: 'Where Democracy Was Born',
};
const eraMap = {
  patara: '2,200 years ago',
};
const highlightsMap = {
  patara: [
    "World's first democratic parliament",
    'Birthplace of Saint Nicholas',
    'Capital of the Lycian League',
    "Turkey's longest untouched beach",
  ],
};
const closingMap = {
  patara: 'One ticket. Two ancient wonders.',
};

const props = {
  name: item.name.toUpperCase().replace(/ ANTIK KENTI/, '').replace(/ \(.*\)/, ''),
  tagline: taglineMap[pack] || item.summary?.slice(0, 60) || 'A timeless wonder',
  era: eraMap[pack] || '2,000+ years ago',
  highlights: highlightsMap[pack] || (item.history ? [item.summary?.slice(0, 50)] : ['UNESCO site']).slice(0, 4),
  closingLine: closingMap[pack] || 'A timeless journey.',
  ctaText: 'Save this for your Kalkan trip',
  domain: 'kalkaninfo.com',
  clips: manifest.clips.slice(0, 3).map(c => ({ public_url: c.public_url, photographer: c.photographer })),
  hashtags: item.hashtags.slice(0, 15),
};

// Write props to temp file
const propsPath = resolve(`dist/social/${pack}/_props.json`);
writeFileSync(propsPath, JSON.stringify(props));
console.log('Props ready:', propsPath);

// Render with Remotion
const outMp4 = resolve(`dist/social/${pack}/${pack}-video.mp4`);
console.log('🎬 Rendering...');
const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'AntikKentVideo', outMp4, `--props=${propsPath}`, '--log=error'], {
  cwd: 'remotion', stdio: 'inherit', shell: true,
});
if (r.status !== 0) { console.error('render fail'); process.exit(1); }
console.log(`✅ ${outMp4} · ${(statSync(outMp4).size / 1024 / 1024).toFixed(2)}MB`);

// Upload
console.log('☁️  Upload...');
const buf = readFileSync(outMp4);
const upRes = await fetch(`${SUPA_URL}/storage/v1/object/social-media/${pack}/${pack}-video.mp4`, {
  method: 'POST',
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!upRes.ok) { console.error('upload fail:', upRes.status, await upRes.text()); process.exit(1); }
const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/${pack}/${pack}-video.mp4`;
console.log(`✅ ${videoUrl}`);

// IG REELS publish
const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=access_token&access_token=${USER_TOKEN}`).then(r => r.json());
const PAGE_TOKEN = acc.data?.[0]?.access_token;
const IG_USER = '17841464755523227';

const caption = item.caption_en + '\n\n' + item.hashtags.join(' ') +
  '\n\nFootage: ' + manifest.clips.slice(0, 3).map(c => c.photographer).filter(Boolean).join(', ') + ' (Pexels)';

console.log('📤 REELS container...');
const c1 = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media`, {
  method: 'POST',
  body: new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOKEN }),
}).then(r => r.json());
if (!c1.id) { console.error('container fail:', c1); process.exit(1); }
console.log(`  container: ${c1.id}`);

console.log('⏳ Polling...');
for (let i = 0; i < 50; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const st = await fetch(`https://graph.facebook.com/v21.0/${c1.id}?fields=status_code&access_token=${PAGE_TOKEN}`).then(r => r.json());
  process.stdout.write(`  [${i*3}s] ${st.status_code}\n`);
  if (st.status_code === 'FINISHED') break;
  if (st.status_code === 'ERROR') { console.error('process error:', st); process.exit(1); }
}

console.log('🚀 Publishing...');
const pub = await fetch(`https://graph.facebook.com/v21.0/${IG_USER}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: c1.id, access_token: PAGE_TOKEN }),
}).then(r => r.json());
if (!pub.id) { console.error('publish fail:', pub); process.exit(1); }

console.log(`\n🎬🎬 VIDEO REELS YAYINLANDI! IG Media ID: ${pub.id}`);
console.log(`   https://www.instagram.com/kalkan.info/reels/`);
