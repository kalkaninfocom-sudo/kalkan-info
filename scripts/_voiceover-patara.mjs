import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ttsFree, VOICES } from './lib/tts-free.mjs';

const PAGE_TOK = process.argv[2];
const LANG = (process.argv[3] || 'tr').toLowerCase();  // 'tr' | 'en' — TR varsayılan (native ses, bedava)
if (!PAGE_TOK) { console.error('Usage: node scripts/_voiceover-patara.mjs <page_token> [tr|en]'); process.exit(1); }

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA = pick('SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

// Ücretsiz nöral ses (edge-tts). TR native destekli; ElevenLabs/kart/secret gerekmez.
const SCRIPTS = {
  en: `Welcome to Patara. The birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — over two thousand years old. Walk the marble streets where Apollo was worshipped. Stand inside a five-thousand-seat theatre facing the Mediterranean. Then step onto an eighteen-kilometre untouched beach. One ticket. Two ancient wonders. Patara is unforgettable.`,
  tr: `Patara'ya hoş geldiniz. Aziz Nikolaos'un doğduğu topraklar. Likya Birliği'nin başkenti. İki bin yıldan eski, dünyanın ilk demokratik parlamentosuna ev sahipliği yapan antik kent. Apollon'a tapılan mermer sokaklarda yürüyün. Akdeniz'e bakan beş bin kişilik tiyatroda durun. Ardından on sekiz kilometrelik el değmemiş kumsala adım atın. Tek bilet. İki antik harika. Patara unutulmaz.`,
};
const VOICE = LANG === 'tr' ? VOICES.tr_male : VOICES.en_male;
const SCRIPT = SCRIPTS[LANG] || SCRIPTS.tr;

console.log(`🎤 Ücretsiz TTS (edge-tts · ${VOICE})...`);
const voicePath = resolve(`dist/audio/patara-voice-${LANG}.mp3`);
ttsFree(SCRIPT, voicePath, { voice: VOICE });
const audioBuf = readFileSync(voicePath);
console.log(`  ✓ ${(audioBuf.length / 1024).toFixed(0)}KB → ${voicePath}`);

// Get audio duration
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', voicePath], { encoding: 'utf8' });
const voiceDur = parseFloat(probe.stdout.trim());
console.log(`  voice duration: ${voiceDur.toFixed(2)}s`);

// Mix: hybrid video (silent) + voiceover (0dB) + music (-15dB ducking)
console.log('\n🎵 ffmpeg mix (voice + music + video)...');
const videoIn = resolve('dist/social/patara/patara-hybrid.mp4');  // silent hybrid (image-based)
// Müzik: varsa özel track, yoksa committed telifsiz ambient bed (assets/audio/ambient-bed.mp3)
const musicIn = [resolve('dist/audio/track1.mp3'), resolve('assets/audio/ambient-bed.mp3')]
  .find(p => existsSync(p)) || resolve('assets/audio/ambient-bed.mp3');
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

const CAPTIONS = {
  en: `🏛️ PATARA — Where democracy was born.

Birthplace of Saint Nicholas. Capital of the Lycian League. Home to the world's first democratic parliament — 2,200 years old.

Walk where Apollo was worshipped. Stand in a 5,000-seat theatre facing the Mediterranean. Step onto Turkey's longest untouched beach.

One ticket. Two ancient wonders.

📍 kalkaninfo.com

#kalkan #patara #lycia #unescoworldheritage #turkeytravel #ancientcities #mediterranean #santaclaus #turkishriviera #archaeology #lycianway #hiddenturkey #wanderlust #turkishhistory #likya`,
  tr: `🏛️ PATARA — Demokrasinin doğduğu yer.

Aziz Nikolaos'un doğduğu topraklar. Likya Birliği'nin başkenti. Dünyanın ilk demokratik parlamentosu — 2.200 yıllık.

Apollon'a tapılan mermer sokaklarda yürüyün. Akdeniz'e bakan 5.000 kişilik tiyatroda durun. Türkiye'nin en uzun el değmemiş kumsalına adım atın.

Tek bilet. İki antik harika.

📍 kalkaninfo.com

#kalkan #patara #likya #antikkent #kaş #antalya #tatil #gezi #akdeniz #aziznikolaos #türkiye #patarason #likyayolu #kalkaninfo #gezgin`,
};
const caption = CAPTIONS[LANG] || CAPTIONS.tr;

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
