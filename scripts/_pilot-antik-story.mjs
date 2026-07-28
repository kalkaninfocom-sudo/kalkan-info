#!/usr/bin/env node
/**
 * _pilot-antik-story.mjs — "Antik hikâye reel'i" PILOT (narrated + subtitled + cinematic).
 * ---------------------------------------------------------------------------------------
 * Amaç: mevcut SESSİZ AntikReel slayt gösterisinin ötesine geçip, edge-tts anlatımı +
 * senkron altyazı + sinematik renk-grade + Ken Burns ile GERÇEK hikâye reel'i üretmek.
 * Videodaki "voiceover story + pop-in altyazı + tempo" modelini kalkan-info grounded
 * fotoları üstüne uygular. Tamamen ffmpeg + edge-tts (sıfır maliyet).
 *
 * Kullanım: node scripts/_pilot-antik-story.mjs [patara]
 * Çıktı: dist/social/antik/patara-story.mp4
 * Gerektirir: python+edge-tts, ffmpeg/ffprobe, content/antik-reels.json, disk fotoları.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FPS = 30;
const W = 1080, H = 1920;
const id = (process.argv[2] || 'patara').toLowerCase();

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} hata (${r.status}): ${(r.stderr || '').split('\n').slice(-6).join('\n')}`);
  return r;
};
const ff = (args) => sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
const probeDur = (p) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', p]).stdout.trim());

// ── 1. İçerik: anlatım metni + foto havuzları ──────────────────────────────
const packs = JSON.parse(readFileSync(join(ROOT, 'content', 'antik-reels.json'), 'utf8')).items;
const pack = packs.find(x => x.id === id);
if (!pack) { console.error(`❌ content/antik-reels.json'da '${id}' yok`); process.exit(1); }

const abs = (rel) => resolve(ROOT, rel.replace(/^\//, ''));
const exists = (rel) => { try { return existsSync(abs(rel)); } catch { return false; } };
// Grounded gerçek fotolar (diskte doğrulanmış) — harabe & plaj havuzu.
// NOT: Sadece FİLİGRANSIZ/gömülü-yazısız fotolar (kontakt sayfası ile denetlendi 2026-07-28).
// Çıkarılanlar: plaj p2(yazı) p3(VİLLACIM) p5(GÜVEN) p7(seninvillam) · tur at1(kolaj) at3(Villa Patara).
const RUINS = ['/assets/img/d018efe8f905.webp', '/assets/img/488f36a95000.webp', '/assets/img/a1f93ffd6095.webp'].filter(exists);
const BEACH = ['/assets/img/plaj/patara-hero.jpg', '/assets/img/plaj/patara-1.jpg', '/assets/img/plaj/patara-4.jpg',
               '/assets/img/plaj/patara-6.jpg', '/assets/img/plaj/patara-8.jpg', '/assets/img/tur/patara-at-2.jpg'].filter(exists);
if (RUINS.length < 2) { console.error('❌ Yeterli harabe fotosu yok'); process.exit(1); }

const WORK = resolve(ROOT, 'dist', 'social', 'antik', '_story');
try { rmSync(WORK, { recursive: true, force: true }); } catch { /* Windows dosya kilidi — sorun değil, üzerine yazılır */ }
mkdirSync(WORK, { recursive: true });
const outDir = resolve(ROOT, 'dist', 'social', 'antik');
mkdirSync(outDir, { recursive: true });

// ── 2. Anlatım (edge-tts) + cümle-zamanlı altyazı ──────────────────────────
const narrMp3 = join(WORK, 'narration.mp3');
const narrSrt = join(WORK, 'narration.srt');
console.log('── Anlatım üretiliyor (edge-tts, tr-TR-AhmetNeural) ──');
sh(process.platform === 'win32' ? 'python' : 'python3', [
  '-m', 'edge_tts', '--voice', 'tr-TR-AhmetNeural', '--rate', '+6%', '--pitch', '+0Hz',
  '--text', pack.voiceover_tr, '--write-media', narrMp3, '--write-subtitles', narrSrt,
]);
const NARR = probeDur(narrMp3);
console.log(`✓ Anlatım: ${NARR.toFixed(1)}s`);

// SRT parse
const srtToSec = (t) => { const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000; };
const segs = [];
for (const block of readFileSync(narrSrt, 'utf8').split(/\r?\n\r?\n/)) {
  const m = block.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)\s*\n([\s\S]+)/);
  if (m) segs.push({ start: srtToSec(m[1]), text: m[3].replace(/\s+/g, ' ').trim() });
}
if (!segs.length) { console.error('❌ altyazı parse edilemedi'); process.exit(1); }
// Segment süreleri: bir sonrakinin başlangıcına kadar (kesintisiz), son segment anlatım sonuna + kuyruk.
segs.forEach((s, i) => { s.dur = (i < segs.length - 1 ? segs[i + 1].start : NARR + 0.6) - s.start; });
console.log(`✓ ${segs.length} cümle segmenti`);

// ── 3. Segment → foto HAVUZU (grounded): tarih=harabe, deniz/kumsal=plaj ──
// Kelime-BAŞI sınırı (^|\W): Türkçe ekleri yakalar (kumsala) ama "burada"daki "ada"yı YAKALAMAZ.
const beachRe = /(^|\W)(kumsal|sahil|kilometre|deniz|tekne|bilet|mucize|unutulmaz)/i;
for (const s of segs) s.pool = (beachRe.test(s.text) && BEACH.length) ? BEACH : RUINS;

// ── 4. HIZLI KESME: her cümleyi ~2s'lik ÇOKLU sahneye böl (video modeli: "cümlede 2 klip") ──
//     Perceived pace = kesme sıklığı. Uzun cümle → 2-3 farklı foto. İzleyici sıkılmaz.
const MAX_SHOT = 2.3;
const shots = [];
let ri = 0, bi = 0;
for (const s of segs) {
  const n = Math.max(1, Math.round(s.dur / MAX_SHOT));
  const d = s.dur / n;
  for (let k = 0; k < n; k++) {
    const photo = s.pool === BEACH ? BEACH[bi++ % BEACH.length] : RUINS[ri++ % RUINS.length];
    shots.push({ dur: d, photo });
  }
}
console.log(`✓ ${segs.length} cümle → ${shots.length} sahne (ort ${(NARR / shots.length).toFixed(1)}s/sahne)`);

console.log('── Sahneler render ediliyor (hızlı kesme + Ken Burns) ──');
const listFile = join(WORK, 'list.txt');
const lines = [];
shots.forEach((s, i) => {
  const frames = Math.max(18, Math.round(s.dur * FPS));
  const panSign = i % 2 === 0 ? 1 : -1; // dönüşümlü yatay kayma yönü
  const clip = join(WORK, `c${i}.mp4`);
  // FULL-BLEED: fotoyu TAM EKRAN doldur (bant YOK). Yüksekliğe göre ölçekle → yatay taşan geniş manzarayı
  // Ken Burns ile yavaşça KAYDIR (pan) → tüm sahne görünür, telefon boyutunda dolu. + hafif zoom + sinematik grade.
  ff(['-loop', '1', '-i', abs(s.photo),
    '-filter_complex',
    `[0:v]scale=-2:2112,setsar=1,` +
    `eq=contrast=1.12:saturation=1.2:gamma=0.97,colorbalance=rm=0.03:bm=-0.03,unsharp=5:5:0.5,` +
    `zoompan=z='min(1.02+0.00045*on,1.10)':d=${frames}:` +
    `x='iw/2-(iw/zoom/2)+(${panSign})*(iw-${W})*0.30*(on/${frames}-0.5)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
    `vignette=PI/5,format=yuv420p[v]`,
    '-map', '[v]', '-t', s.dur.toFixed(3), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', clip]);
  lines.push(`file '${clip.replace(/\\/g, '/')}'`);
  process.stdout.write(`  ✓ c${i} (${s.dur.toFixed(1)}s, ${s.photo.split('/').pop()})\n`);
});

// Sinematik kapanış kartı (2.6s): harabe fotosu koyulaştırılmış + yavaş zoom → üstüne marka/CTA yakılır.
const OUTRO = 2.6;
const outroClip = join(WORK, 'outro.mp4');
ff(['-loop', '1', '-i', abs(RUINS[0]),
  '-filter_complex',
  `[0:v]scale=1350:2400:force_original_aspect_ratio=increase,crop=1350:2400,eq=contrast=1.06:saturation=0.85:brightness=-0.34,boxblur=3:1,vignette=PI/4,` +
  `zoompan=z='min(1+0.00055*on,1.09)':d=${Math.round(OUTRO * FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v]`,
  '-map', '[v]', '-t', String(OUTRO), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', outroClip]);
lines.push(`file '${outroClip.replace(/\\/g, '/')}'`);

writeFileSync(listFile, lines.join('\n'));

// ── 5. Klipleri birleştir (xfade yerine hızlı concat) ──────────────────────
const montage = join(WORK, 'montage.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', montage]);
const MDUR = probeDur(montage); // anlatım klipleri + kapanış kartı toplam süresi

// ── 6. .ass altyazı + marka overlay (tek libass geçişi) ────────────────────
const cs = (t) => { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = (t % 60); return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
const esc = (t) => t.replace(/\n/g, '\\N');
const cta = pack.id ? `kalkaninfo.com/antik-kentler/${pack.id}` : 'kalkaninfo.com';
const assEvents = [];
// Kicker (üst) — anlatım boyunca; kapanış kartından önce kaybolur.
assEvents.push(`Dialogue: 0,${cs(0)},${cs(NARR + 0.3)},Kicker,,0,0,0,,KALKAN İNFO  ·  LİKYA REHBERİ`);
// Başlık PATARA (0-2.6s, fade)
assEvents.push(`Dialogue: 0,${cs(0)},${cs(1.7)},Title,,0,0,0,,{\\fad(200,250)}${pack.name.toUpperCase().replace(/ ANTİK KENT.*/,'')}`);
// Anlatım altyazıları
for (const s of segs) {
  const end = s.start + s.dur - 0.05;
  assEvents.push(`Dialogue: 0,${cs(s.start)},${cs(end)},Sub,,0,0,0,,{\\fad(120,120)}${esc(s.text)}`);
}
// Kapanış kartı (anlatım bittikten sonra): marka + Likya Rehberi + CTA — altyazıyla ÇAKIŞMAZ.
const oStart = NARR + 0.35;
assEvents.push(`Dialogue: 0,${cs(oStart)},${cs(MDUR)},Title,,0,0,0,,{\\fad(350,0)\\an5\\pos(540,760)\\fs104}KALKAN İNFO`);
assEvents.push(`Dialogue: 0,${cs(oStart + 0.2)},${cs(MDUR)},Kicker,,0,0,0,,{\\fad(400,0)\\an5\\pos(540,900)}LİKYA REHBERİ  ·  ANTİK ANADOLU`);
assEvents.push(`Dialogue: 0,${cs(oStart + 0.4)},${cs(MDUR)},CTA,,0,0,0,,{\\fad(450,0)\\an5\\pos(540,1080)}${cta}`);
// AI şeffaflık (Ticari Reklam Yönetmeliği 2026-08-01): AI seslendirme = insandan ayırt edilemeyen dijital ses → açık ibare.
assEvents.push(`Dialogue: 0,${cs(oStart + 0.6)},${cs(MDUR)},Kicker,,0,0,0,,{\\fad(500,0)\\an5\\pos(540,1190)\\fs24\\alpha&H55&}Yapay zeka destekli anlatım`);

const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kicker,Arial,32,&H003DB5F4,&H00000000,&H80000000,&H00000000,-1,0,0,0,100,100,4,0,1,3,0,8,60,60,70,1
Style: Title,Georgia,150,&H00EAF4F8,&H00000000,&H90000000,&H00000000,-1,0,0,0,100,100,2,0,1,6,4,5,80,80,0,1
Style: Sub,Arial,60,&H00FFFFFF,&H00000000,&H70000000,&H60000000,-1,0,0,0,100,100,0,0,1,5,3,2,90,90,320,1
Style: CTA,Arial,52,&H00102A47,&H00000000,&H003DB5F4,&H003DB5F4,-1,0,0,0,100,100,1,0,3,18,0,2,120,120,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assEvents.join('\n')}
`;
const assFile = join(WORK, 'subs.ass');
writeFileSync(assFile, ass, 'utf8');

// ── 7. Müzik yatağı (kısılmış) + anlatım mix + altyazı yak ─────────────────
const music = ['assets/audio/reel-bed.mp3', 'assets/audio/ambient-bed.mp3'].map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
const finalOut = join(outDir, `${pack.id}-story.mp4`);
console.log('── Final mux (anlatım + müzik + altyazı yakma) ──');

// spawnSync (shell YOK): yolları ileri-slash'a çevir; ass için mutlak+escape'li yol (cwd'ye güvenme).
const fw = (p) => p.replace(/\\/g, '/');
const mMontage = fw(montage), mNarr = fw(narrMp3), mMusic = music ? fw(music) : null, mOut = fw(finalOut);
// libass filtergraph içinde 'C:' iki noktası '\:' olarak escape edilmeli.
const subFilter = `subtitles='${fw(assFile).replace(/:/g, '\\:')}'`;
if (music) {
  ff(['-i', mMontage, '-i', mNarr, '-i', mMusic,
    '-filter_complex',
    `[0:v]${subFilter}[v];` +
    `[1:a]volume=1.9,aformat=sample_rates=44100:channel_layouts=stereo[nar];` +
    `[2:a]volume=0.17,afade=in:st=0:d=1.5,afade=out:st=${(MDUR - 2.5).toFixed(1)}:d=2.5,aformat=sample_rates=44100:channel_layouts=stereo[bed];` +
    `[nar][bed]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]`,
    '-map', '[v]', '-map', '[a]', '-t', MDUR.toFixed(2),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', mOut]);
} else {
  ff(['-i', mMontage, '-i', mNarr, '-filter_complex', `[0:v]${subFilter}[v];[1:a]volume=1.9[a]`,
    '-map', '[v]', '-map', '[a]', '-t', MDUR.toFixed(2),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', mOut]);
}

const kb = Math.round(statSync(finalOut).size / 1024);
console.log(`\n✅ HİKÂYE REEL hazır: dist/social/antik/${pack.id}-story.mp4 (${kb} KB, ${MDUR.toFixed(1)}s)`);
console.log(`   Anlatım: Ahmet (belgesel) · ${segs.length} sahne · müzik: ${music ? 'reel-bed' : 'yok'} · CTA: ${cta}`);
