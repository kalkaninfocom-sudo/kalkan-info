// scripts/_build-patara-reels.mjs
// 3 slide jpg → 30s Reels MP4 (9:16, Ken Burns zoom) + Supabase Storage upload

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA_URL = pick('SUPABASE_URL');
const SUPA_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

const slides = ['slide-1.jpg', 'slide-2.jpg', 'slide-3.jpg'].map(f => resolve('dist/social/patara', f));
for (const s of slides) if (!existsSync(s)) { console.error('Missing:', s); process.exit(1); }

const out = resolve('dist/social/patara/patara-reels.mp4');

// 3 slide × 10s = 30s, Ken Burns zoom 1.0→1.15 over 250 frames @ 25fps
const args = [
  '-y',
  '-loop', '1', '-t', '10', '-i', slides[0],
  '-loop', '1', '-t', '10', '-i', slides[1],
  '-loop', '1', '-t', '10', '-i', slides[2],
  '-filter_complex',
  "[0:v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0006,1.15)':d=250:s=1080x1920:fps=25,setsar=1[v0];" +
  "[1:v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0006,1.15)':d=250:s=1080x1920:fps=25,setsar=1[v1];" +
  "[2:v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0006,1.15)':d=250:s=1080x1920:fps=25,setsar=1[v2];" +
  "[v0][v1][v2]concat=n=3:v=1:a=0[outv];" +
  "anullsrc=channel_layout=stereo:sample_rate=44100[a]",
  '-map', '[outv]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-shortest', '-t', '30',
  out,
];

console.log('🎬 Building reels MP4 (silent, Ken Burns)...');
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) { console.error('ffmpeg fail'); process.exit(1); }
const stats = (await import('node:fs/promises')).then(m => m.stat(out));
console.log(`✅ ${out} created · ${((await stats).size / 1024 / 1024).toFixed(2)}MB`);

// Upload to Supabase Storage
console.log('☁️  Uploading to Supabase Storage...');
const buf = readFileSync(out);
const upRes = await fetch(`${SUPA_URL}/storage/v1/object/social-media/patara/patara-reels.mp4`, {
  method: 'POST',
  headers: {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'video/mp4',
    'x-upsert': 'true',
  },
  body: buf,
});
if (!upRes.ok) {
  console.error('upload fail:', upRes.status, await upRes.text());
  process.exit(1);
}
const publicUrl = `${SUPA_URL}/storage/v1/object/public/social-media/patara/patara-reels.mp4`;
console.log(`✅ Public URL: ${publicUrl}`);
console.log('\n🎯 Sonraki adım: IG REELS publish (publishReels lib içinde hazır)');
