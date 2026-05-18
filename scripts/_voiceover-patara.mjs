import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const EL_KEY = 'sk_a2b356c41547bf5e2f406262fa23dbb88d503cdd39bda3f0';
const PAGE_TOK = process.argv[2];
if (!PAGE_TOK) { console.error('Usage: ... <page_token>'); process.exit(1); }

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

// Brian voice (American narrator, cinematic) — fits travel/documentary well
const VOICE_ID = 'nPczCjzI2devNBz1zQrb';
const SCRIPT = `Welcome to Patara. The birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — over two thousand years old. Walk the marble streets where Apollo was worshipped. Stand inside a five-thousand-seat theatre facing the Mediterranean. Then step onto an eighteen-kilometre untouched beach. One ticket. Two ancient wonders. Patara is unforgettable.`;

console.log('🎤 ElevenLabs TTS...');
const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
  method: 'POST',
  headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: SCRIPT,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.30, use_speaker_boost: true },
  }),
});
if (!ttsRes.ok) { console.error('TTS fail:', ttsRes.status, await ttsRes.text()); process.exit(1); }
const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
const voicePath = resolve('dist/audio/patara-voice.mp3');
writeFileSync(voicePath, audioBuf);
console.log(`  ✓ ${(audioBuf.length / 1024).toFixed(0)}KB → ${voicePath}`);

// Get audio duration
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', voicePath], { encoding: 'utf8' });
const voiceDur = parseFloat(probe.stdout.trim());
console.log(`  voice duration: ${voiceDur.toFixed(2)}s`);

// Mix: hybrid video (silent) + voiceover (0dB) + music (-15dB ducking)
console.log('\n🎵 ffmpeg mix (voice + music + video)...');
const videoIn = resolve('dist/social/patara/patara-hybrid.mp4');  // silent hybrid (image-based)
const musicIn = resolve('dist/audio/track1.mp3');
const finalMp4 = resolve('dist/social/patara/patara-voiced.mp4');

// Audio filter: voice on left input, music ducked at -15dB
const mix = spawnSync('ffmpeg', [
  '-y',
  '-i', videoIn,
  '-i', voicePath,
  '-i', musicIn,
  '-filter_complex',
  '[1:a]volume=1.4[voice];' +
  '[2:a]volume=0.22,afade=in:st=0:d=1,afade=out:st=29:d=1[music];' +
  '[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[mix]',
  '-map', '0:v', '-map', '[mix]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-t', '30',
  finalMp4,
], { stdio: 'inherit' });
if (mix.status !== 0) { console.error('mix fail'); process.exit(1); }
console.log(`  ✓ ${(statSync(finalMp4).size / 1024 / 1024).toFixed(2)}MB`);

// Upload + publish
console.log('\n☁️  Upload + IG REELS...');
const buf = readFileSync(finalMp4);
const up = await fetch(`${SUPA}/storage/v1/object/social-media/patara/patara-voiced.mp4`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
  body: buf,
});
if (!up.ok) { console.error('upload fail', up.status, await up.text()); process.exit(1); }
const videoUrl = `${SUPA}/storage/v1/object/public/social-media/patara/patara-voiced.mp4`;
console.log(`  ✓ ${videoUrl}`);

const caption = `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — 2,200 years old.

Walk where Apollo was worshipped. Stand in a 5,000-seat theatre facing the Mediterranean. Step onto Turkey's longest untouched beach.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

Voice: ElevenLabs · Music: Pixabay

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
console.log(`\n🎤🎵🎬 VOICEOVER + MUSIC + VISUALS REELS YAYINLANDI! IG: ${p.id}`);
console.log('   https://www.instagram.com/kalkan.info/reels/');
