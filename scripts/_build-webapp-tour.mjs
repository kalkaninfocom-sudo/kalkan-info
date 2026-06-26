// Webapp Tour Reels v2 — Turkce voiceover + sayfa screenshots + Remotion + ffmpeg mix
// v2 değişiklikleri (Berkay feedback):
//   • Sahneler %50 daha uzun (1.5x) — toplam ~61.6s (v1: ~41s)
//   • PWA "Uygulamayı yükle" banner'ı capture sırasında gizli
//   • Voice: Sarah (Mature, Reassuring, Confident) — professional + sakin
//   • Script: "kalkan info nokta com" telaffuz fix + 3 nokta nefes durakları
// Step 1: Run scripts/_capture-webapp-tour.mjs to capture screenshots first.
// Step 2: node scripts/_build-webapp-tour.mjs
// Output: dist/site-tour/webapp-tour-final-v2.mp4 (NOT auto-published to IG/FB)

import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const EL_KEY = pick('ELEVENLABS_API_KEY');
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

if (!EL_KEY) { console.error('ELEVENLABS_API_KEY .env.local\'de yok'); process.exit(1); }

const outDir = resolve('dist/site-tour');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// 1) Make sure screens are in remotion/public/screens/
// ---------------------------------------------------------------------------
const screensSrc = resolve('dist/site-tour/screens');
const screensDst = resolve('remotion/public/screens');
if (!existsSync(screensSrc)) {
  console.error('Screenshot yok. Once: node scripts/_capture-webapp-tour.mjs');
  process.exit(1);
}
if (!existsSync(screensDst)) mkdirSync(screensDst, { recursive: true });
for (const id of ['home','restoranlar','villalar','plajlar','antik','hizmetler','ilanlar','tatil']) {
  cpSync(resolve(screensSrc, `${id}.png`), resolve(screensDst, `${id}.png`), { force: true });
}
console.log('1) Screens copied to remotion/public/screens/');

// ---------------------------------------------------------------------------
// 2) ElevenLabs Turkce voiceover
// ---------------------------------------------------------------------------
// v2: Sarah — Mature, Reassuring, Confident — profesyonel, dingin Reels tonu.
// (v1: Jessica = Playful Bright Warm; Berkay ".com telaffuzu kötü, daha profesyonel" dedi)
// Override: WEBAPP_TOUR_VOICE_ID env ile başka premade seç
const VOICE_ID = process.env.WEBAPP_TOUR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - profesyonel, dingin ton
const MODEL_ID = process.env.WEBAPP_TOUR_MODEL || 'eleven_multilingual_v2';

// v2 SCRIPT — ".com" telaffuzu için "kalkan info nokta com" (iki kelime gibi)
// 3 nokta = doğal nefes durağı. Outro'da tek seferde "kalkan info nokta com".
const SCRIPT_TR = `Kalkan'a tatil planlamak... artık çok daha kolay.

Kalkan info'da her şey, tek bir yerde toplandı.

Yirmi yedi restoran, gerçek Google puanlarıyla.
Üzümlü'den Patara'ya, on altı villa.
Plajlar, gizli koylar, anlık deniz suyu sıcaklığı.
On antik kent, sesli rehberle.
Yerel hizmetler — temizlik, masaj, market, transfer.
İş ilanları... ve yapay zeka destekli tatil planlayıcı.

Hepsi tek bir adreste.

Kalkan info, nokta com.`;

console.log('2) ElevenLabs Turkce voiceover (v2 — Sarah, professional + sakin)...');
const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
  method: 'POST',
  headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: SCRIPT_TR,
    model_id: MODEL_ID,
    // v2 voice settings: profesyonel + dingin ton (Berkay feedback)
    //   stability 0.7   (was 0.45 — daha tutarlı, az çılgın)
    //   similarity 0.85
    //   style 0.05      (was 0.55 — düşük style = sakin, neutral)
    //   speed 0.95      (hafif yavaş — telaffuz net)
    voice_settings: { stability: 0.7, similarity_boost: 0.85, style: 0.05, use_speaker_boost: true, speed: 0.95 },
  }),
});
if (!ttsRes.ok) { console.error('TTS fail:', await ttsRes.text()); process.exit(1); }
const voiceBuf = Buffer.from(await ttsRes.arrayBuffer());
const voicePath = resolve(outDir, 'voice.mp3');
writeFileSync(voicePath, voiceBuf);
console.log(`  ✓ ${(voiceBuf.length / 1024).toFixed(0)}KB`);

// ---------------------------------------------------------------------------
// 3) Remotion render (v2 — 1848 frames @ 30fps = 61.6s)
// ---------------------------------------------------------------------------
console.log('3) Remotion render (1080x1920 @ 30fps, ~61.6s)...');
// v2: silent çıktısını farklı isimle tut (v1 yedek kalsın)
const outSilent = resolve(outDir, 'webapp-tour-silent-v2.mp4');
const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'WebappTour', outSilent, '--log=info'], {
  cwd: 'remotion', stdio: 'inherit', shell: true,
});
if (r.status !== 0) { console.error('render fail'); process.exit(1); }
console.log(`  ✓ ${(statSync(outSilent).size / 1024 / 1024).toFixed(2)}MB`);

// ---------------------------------------------------------------------------
// 4) ffmpeg mix — voice + background music (optional)
// v2: total ~61.6s, music fade-out 60s'de başlasın
// ---------------------------------------------------------------------------
console.log('4) ffmpeg audio mix (v2)...');
const finalMp4 = resolve(outDir, 'webapp-tour-final-v2.mp4');
// Only files larger than 100KB are real audio (smaller = placeholder stubs from old session).
const musicCandidates = ['dist/audio/track1.mp3', 'dist/audio/newdawn.mp3', 'dist/audio/cinematicstrings.mp3', 'dist/audio/epic.mp3'];
const musicPath = musicCandidates
  .map(p => resolve(p))
  .find(p => existsSync(p) && statSync(p).size > 102400) || resolve('dist/audio/track1.mp3');
const hasMusic = existsSync(musicPath) && statSync(musicPath).size > 102400;

// v2 toplam süre: 1848 / 30 = 61.6s — biraz pay bırak
const TOTAL_DURATION = '62';
const MUSIC_FADE_OUT_START = '60';

if (hasMusic) {
  const mix = spawnSync('ffmpeg', [
    '-y', '-i', outSilent, '-i', voicePath, '-i', musicPath,
    '-filter_complex',
    '[1:a]volume=1.5[voice];' +
    `[2:a]volume=0.14,afade=in:st=0:d=1.5,afade=out:st=${MUSIC_FADE_OUT_START}:d=1.5[music];` +
    '[voice][music]amix=inputs=2:duration=longest[mix]',
    '-map', '0:v', '-map', '[mix]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-t', TOTAL_DURATION,
    finalMp4,
  ], { stdio: 'inherit' });
  if (mix.status !== 0) { console.error('mix fail'); process.exit(1); }
} else {
  console.log('  (track1.mp3 yok, sadece voiceover ile mix)');
  const mix = spawnSync('ffmpeg', [
    '-y', '-i', outSilent, '-i', voicePath,
    '-filter_complex', '[1:a]volume=1.4[voice]',
    '-map', '0:v', '-map', '[voice]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-t', TOTAL_DURATION,
    finalMp4,
  ], { stdio: 'inherit' });
  if (mix.status !== 0) { console.error('mix fail'); process.exit(1); }
}
console.log(`  ✓ ${(statSync(finalMp4).size / 1024 / 1024).toFixed(2)}MB`);

// ---------------------------------------------------------------------------
// 5) (Optional) Upload to Supabase storage — IG publish manual
// ---------------------------------------------------------------------------
if (SUPA && KEY) {
  console.log('5) Supabase upload (preview URL)...');
  const buf = readFileSync(finalMp4);
  const up = await fetch(`${SUPA}/storage/v1/object/social-media/site-tour/webapp-tour-final-v2.mp4`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  });
  if (up.ok) {
    const previewUrl = `${SUPA}/storage/v1/object/public/social-media/site-tour/webapp-tour-final-v2.mp4`;
    console.log(`  ✓ ${previewUrl}`);
  } else {
    console.warn(`  ⚠ upload skipped: ${await up.text()}`);
  }
}

console.log(`\n🎬 Webapp Tour Reels v2 hazir:\n   ${finalMp4}\n   IG publish manuel — Berkay onaylasin sonra publish-IG scriptini calistir.`);
