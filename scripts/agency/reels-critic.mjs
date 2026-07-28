#!/usr/bin/env node
/**
 * scripts/agency/reels-critic.mjs — REELS ELEŞTİRMEN / STAJER (zorunlu QA kapısı)
 * ------------------------------------------------------------------------------
 * Berkay'ın kuralı (2026-07-03): Hiçbir reels/hikaye, ELEŞTİRİLMEDEN kurucunun
 * onayına GİTMEZ. Bu kapı, üretilen videoyu bir checklist'e göre denetler; geçmezse
 * onaya çıkmaz — düzeltilir/yeniden render edilir.
 *
 * Kontroller:
 *   [DETERMİNİSTİK] 9:16 (1080x1920) mi? Süre makul mü? Dosya boyutu IG limitinde mi?
 *   [GÖRSEL — kare örnekleme] ffmpeg ile N kare çıkarılır → görsel denetime sunulur:
 *       • Çerez/consent bannerı GÖRÜNÜYOR mu? (görünmemeli)
 *       • "Uygulamayı Yükle / Ana Ekrana Ekle" bannerı GÖRÜNÜYOR mu? (görünmemeli)
 *       • 404 / hata / boş sayfa var mı?
 *       • İçerik 9:16 kareyi DOLDURUYOR mu, yoksa küçük/letterbox mı?
 *       • Metin okunur mu, marka tutarlı mı?
 *   Görsel denetim vision-yetenekli denetçi (Claude / vision agent) tarafından yapılır;
 *   bu script kareleri çıkarır + deterministik kontrolü verir + checklist basar.
 *
 * Kullanım: node scripts/agency/reels-critic.mjs <video.mp4> [frameSayısı=6]
 * Çıkış kodu: 0 = deterministik geçti, 1 = deterministik kaldı (görsel denetim ayrıca şart).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

const VID = process.argv[2];
const N = Number(process.argv[3]) || 6;
if (!VID || !existsSync(VID)) { console.error('Kullanım: reels-critic.mjs <video.mp4> [kareSayısı]'); process.exit(2); }

const has = (cmd) => spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0;
const FFPROBE = has('ffprobe'), FFMPEG = has('ffmpeg');

const issues = [];
const ok = [];

// ---- Deterministik: boyut + süre + dosya boyutu ----
let W = 0, H = 0, dur = 0;
if (FFPROBE) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', VID], { encoding: 'utf8' });
  const nums = (r.stdout || '').match(/[\d.]+/g) || [];
  W = +nums[0] || 0; H = +nums[1] || 0; dur = +nums[2] || 0;
} else {
  issues.push('ffprobe yok — boyut/süre otomatik doğrulanamadı (kur: ffmpeg).');
}

if (W && H) {
  if (W === 1080 && H === 1920) ok.push(`Boyut 1080x1920 (9:16) ✓`);
  else issues.push(`❌ BOYUT HATASI: ${W}x${H} — beklenen 1080x1920 (9:16). Letterbox/küçük içerik riski.`);
  const ratio = (H / W).toFixed(3);
  if (Math.abs(H / W - 16 / 9) > 0.02) issues.push(`❌ En-boy oranı 9:16 değil (${ratio}).`);
}
if (dur) {
  if (dur >= 5 && dur <= 90) ok.push(`Süre ${dur.toFixed(1)}s ✓`);
  else issues.push(`⚠ Süre ${dur.toFixed(1)}s — reels için 5–90s önerilir.`);
}
const mb = statSync(VID).size / 1048576;
if (mb <= 100) ok.push(`Dosya ${mb.toFixed(1)}MB ✓`); else issues.push(`⚠ Dosya ${mb.toFixed(1)}MB — büyük.`);

// ---- Görsel denetim için kare çıkar ----
let framesDir = null;
if (FFMPEG && dur) {
  framesDir = resolve(dirname(VID), 'critic-frames-' + basename(VID, '.mp4'));
  mkdirSync(framesDir, { recursive: true });
  const step = dur / (N + 1);
  for (let i = 1; i <= N; i++) {
    spawnSync('ffmpeg', ['-y', '-ss', String((step * i).toFixed(2)), '-i', VID,
      '-frames:v', '1', '-q:v', '2', resolve(framesDir, `f${i}.jpg`)], { stdio: 'ignore' });
  }
  ok.push(`${N} kare çıkarıldı → ${framesDir} (görsel denetime hazır)`);
} else {
  issues.push('ffmpeg yok — görsel kareler çıkarılamadı; çerez/install/404 denetimi elle yapılmalı.');
}

// ---- Rapor ----
console.log('\n════ REELS ELEŞTİRMEN RAPORU ════');
console.log('Video:', VID);
ok.forEach(o => console.log('  ✓', o));
issues.forEach(i => console.log('  ' + i));
console.log('\nGÖRSEL CHECKLIST (kareleri denetle — hepsi HAYIR olmalı):');
['Çerez/consent bannerı görünüyor mu?',
 '"Uygulamayı Yükle / Ana Ekrana Ekle" bannerı görünüyor mu?',
 '404 / hata / boş sayfa var mı?',
 'İçerik kareyi doldurmuyor, küçük/letterbox mı?',
 'Metin kesik/okunmaz mı?'].forEach(q => console.log('  [ ]', q));

// ---- AI ŞEFFAFLIK (Ticari Reklam Yönetmeliği, yürürlük 2026-08-01) ----
// AI seslendirme / AI kurgu / AI görsel içeren tanıtım içeriği, "insandan ayırt edilemeyen
// dijital karakter" veya "AI kullanımı" bakımından AÇIKÇA etiketlenmelidir. Bu POZİTİF kontrol:
console.log('\nAI ŞEFFAFLIK CHECKLIST (yönetmelik — EVET olmalı):');
['AI seslendirme/kurgu/görsel varsa görünür "AI destekli / Yapay zeka" ibaresi VAR mı?',
 'Gerçek bir kişinin AI kopyasıyla "bizzat denedim/tavsiye ederim" izlenimi YOK mu? (olmamalı)',
 'Tanıtım/sponsorlu ise "reklam/işbirliği" etiketi VAR mı?'].forEach(q => console.log('  [ ]', q));

const detFail = issues.some(i => i.startsWith('❌'));
console.log('\nDETERMİNİSTİK SONUÇ:', detFail ? '❌ KALDI — onaya ÇIKMAZ' : '✓ geçti (görsel denetim ayrıca şart)');
if (framesDir) console.log('Kareler:', framesDir);
process.exit(detFail ? 1 : 0);
