// Site Tanıtım Reels — Pexels drone + ElevenLabs Charlotte + Pixabay upbeat + IG publish

import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PAGE_TOK = process.argv[2];
if (!PAGE_TOK) { console.error('Usage: ... <page_token>'); process.exit(1); }
const CHARLOTTE = 'EXAVITQu4vr4xnSDxMaL'; // Sarah (free female narrator, American)
const IG = '17841464755523227';

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const EL_KEY = pick('ELEVENLABS_API_KEY');  // secret koddan çıkarıldı → .env.local
if (!EL_KEY) { console.error('ELEVENLABS_API_KEY .env.local\'de yok'); process.exit(1); }
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

if (!existsSync('dist/site-intro')) mkdirSync('dist/site-intro', { recursive: true });

// 1) Reuse existing Pexels drone clips from Storage (Patara'da indirilenler)
console.log('1) Reuse existing drone clips from Storage...');
const clips = [
  { url: `${SUPA}/storage/v1/object/public/social-media/patara/drone/clip-02.mp4`, photographer: 'Samir Smier' },
  { url: `${SUPA}/storage/v1/object/public/social-media/patara/drone/clip-03.mp4`, photographer: 'Nirjhar Basak' },
  { url: `${SUPA}/storage/v1/object/public/social-media/patara/drone/clip-04.mp4`, photographer: 'Kenan Turguç' },
];
clips.forEach(c => console.log(`  ✓ ${c.url.slice(-40)}`));

// 2) Pixabay upbeat music search via Playwright is complex; reuse existing track1.mp3 or fetch new
// For now, use existing track1.mp3 if available
const musicPath = resolve('dist/audio/track1.mp3');
console.log('2) Music: dist/audio/track1.mp3 (reuse)');

// 3) ElevenLabs Charlotte UK voiceover
console.log('3) ElevenLabs Charlotte voiceover...');
const SCRIPT = `Planning a trip to Kalkan? Skip the fake reviews and outdated guides. Welcome to kalkaninfo dot com — your local guide to villas, beaches, restaurants, ancient cities, and twenty-four-seven concierge. Trusted recommendations from people who actually live here. One website. Your Kalkan, your way.`;

const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${CHARLOTTE}?output_format=mp3_44100_128`, {
  method: 'POST',
  headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: SCRIPT,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.50, similarity_boost: 0.80, style: 0.35, use_speaker_boost: true },
  }),
});
if (!ttsRes.ok) { console.error('TTS fail:', await ttsRes.text()); process.exit(1); }
const voiceBuf = Buffer.from(await ttsRes.arrayBuffer());
const voicePath = resolve('dist/site-intro/voice.mp3');
writeFileSync(voicePath, voiceBuf);
console.log(`  ✓ ${(voiceBuf.length / 1024).toFixed(0)}KB`);

// 4) Render with Remotion SiteIntro composition
console.log('4) Remotion render...');
const propsPath = resolve('dist/site-intro/_props.json');
const props = { clips: clips.map(c => ({ url: c.url, photographer: c.photographer })) };
writeFileSync(propsPath, JSON.stringify(props));

const outRender = resolve('dist/site-intro/site-intro-silent.mp4');
const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'SiteIntro', outRender, `--props=${propsPath}`, '--log=error'], {
  cwd: 'remotion', stdio: 'inherit', shell: true,
});
if (r.status !== 0) { console.error('render fail'); process.exit(1); }
console.log(`  ✓ ${(statSync(outRender).size / 1024 / 1024).toFixed(2)}MB`);

// 5) Mix: voice + music + video
console.log('5) ffmpeg mix...');
const finalMp4 = resolve('dist/site-intro/site-intro-final.mp4');
const mix = spawnSync('ffmpeg', [
  '-y', '-i', outRender, '-i', voicePath, '-i', musicPath,
  '-filter_complex',
  '[1:a]volume=1.4[voice];' +
  '[2:a]volume=0.18,afade=in:st=0:d=1,afade=out:st=29:d=1[music];' +
  '[voice][music]amix=inputs=2:duration=longest[mix]',
  '-map', '0:v', '-map', '[mix]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-t', '30',
  finalMp4,
], { stdio: 'inherit' });
if (mix.status !== 0) { console.error('mix fail'); process.exit(1); }
console.log(`  ✓ ${(statSync(finalMp4).size / 1024 / 1024).toFixed(2)}MB`);

// 6) Upload + IG publish
console.log('6) Upload + publish...');
const buf = readFileSync(finalMp4);
const up = await fetch(`${SUPA}/storage/v1/object/social-media/site-intro/site-intro-final.mp4`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
const videoUrl = `${SUPA}/storage/v1/object/public/social-media/site-intro/site-intro-final.mp4`;
console.log(`  ✓ ${videoUrl}`);

const caption = `📍 Planning a trip to Kalkan, Turkey?

Skip the fake reviews. Welcome to kalkaninfo.com — your local guide to:
🏡 Villas
🏖️ Beaches
🍽️ Restaurants
🏛️ Ancient cities
💬 24/7 Concierge

Trusted recommendations from people who actually live in Kalkan.

One website. Your Kalkan, your way.

👉 kalkaninfo.com

Voice: ElevenLabs · Footage: Pexels · Music: Pixabay

#kalkan #kalkaninfo #kalkanrehberi #turkeytravel #lycia #turkishriviera #travelguide #hiddengems #mediterranean #wanderlust #kalkanvillas #patara #kas #antalya #turkey2026`;

const c = await fetch(`https://graph.facebook.com/v21.0/${IG}/media`, {
  method: 'POST',
  body: new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: PAGE_TOK }),
}).then(r => r.json());
if (!c.id) { console.error('container', c); process.exit(1); }
console.log(`  container: ${c.id}`);

for (let i = 0; i < 60; i++) {
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
if (!p.id) { console.error('IG publish', p); process.exit(1); }
console.log(`\n🎬 IG REELS YAYINLANDI! IG: ${p.id}`);
console.log('   https://www.instagram.com/kalkan.info/reels/');

// 7) Facebook Reel publish (same page, same token)
console.log('\n7) Facebook Reel publish...');
try {
  const { publishFacebookReel } = await import('../lib/facebook-publish.js');
  const FB_PAGE_ID = '1140537645805138';
  const fb = await publishFacebookReel(FB_PAGE_ID, PAGE_TOK, videoUrl, caption);
  console.log(`   ✓ FB Reel video_id: ${fb.videoId}`);
  console.log('   https://www.www.facebook.com/profile.php?id=61590126832715');
} catch (e) {
  console.error('   ❌ FB publish fail (IG OK):', e.message);
}
