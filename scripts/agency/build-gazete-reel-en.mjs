#!/usr/bin/env node
/**
 * scripts/agency/build-gazete-reel-en.mjs — İngilizce "Kalkan Today" gazete reel'i (build-gazete-reel ikizi).
 * -----------------------------------------------------------------------------------------------------------
 * İçerik: data/gazete-today.en.json (gazete-editorial-en.mjs çevirisi). Yoksa/eskiyse önce onu üretmeyi dener.
 * MEVCUT GazeteReel composition'ını render eder (Root.tsx'e dokunulmaz) — sabit TR etiketleri EN yapmak için
 * composition'ın opsiyonel `labels` prop'unu geçer. Evergreen metinleri de EN (en.json'dan).
 * Çıktı: dist/social/gazete/gazete-reel-en.mp4 (+ müzik).
 *
 * Kullanım: node scripts/agency/build-gazete-reel-en.mjs [YYYY-MM-DD]
 * Gerektirir: remotion (kurulu), data/gazete-today.en.json (veya çevrilebilecek TR editöryal).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

// EN sabit etiket sözlüğü (GazeteReel opsiyonel `labels` prop'u).
const LABELS_EN = {
  kicker: "TODAY'S PAPER",
  lead: 'HEADLINE',
  more: 'ALSO TODAY',
  didYouKnow: 'DID YOU KNOW?',
  ad: 'PARTNER · ADVERTISEMENT',
  outroTop: 'ALL THE NEWS, EVERY MORNING',
  cta: 'kalkaninfo.com/en',
};

// EN uzun tarih (sources.formatDateLong TR ay adları verir → İngiliz kitle için EN formatla).
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function formatDateLongEn(iso) {
  const d = new Date(iso + 'T08:00:00');
  return `${DAY_EN[d.getDay()]}, ${d.getDate()} ${MONTH_EN[d.getMonth()]} ${d.getFullYear()}`;
}

// Kolon gövdesini tek kısa satıra indir (build-gazete-reel ile aynı davranış).
const oneLine = (body) => {
  let s = Array.isArray(body) ? body.join(' ') : String(body || '');
  s = s.replace(/\s+/g, ' ').trim();
  const dot = s.indexOf('. ');
  if (dot > 20 && dot < 120) s = s.slice(0, dot + 1);
  return s.length > 110 ? s.slice(0, 107).trimEnd() + '…' : s;
};
const labelFrom = (byline, fallback) => {
  const t = String(byline || '').split('·').pop()?.trim();
  return t && t.length <= 24 ? t : fallback;
};

async function main() {
  console.log(`\n════ GAZETE REEL EN — ${date} ════`);

  // 1) EN editöryal çeviriyi garanti et (yoksa/eskiyse üret)
  const enPath = join(ROOT, 'data', 'gazete-today.en.json');
  const enArch = join(ROOT, 'data', 'gazete-archive', `${date}.en.json`);
  let news = readEn(enPath, date) || readEn(enArch, date);
  if (!news) {
    console.log('── EN çeviri yok/eski — gazete-editorial-en.mjs çalıştırılıyor ──');
    spawnSync('node', ['scripts/agency/gazete-editorial-en.mjs', date], { cwd: ROOT, stdio: 'inherit' });
    news = readEn(enPath, date) || readEn(enArch, date);
  }
  if (!news || !news.lead_headline) {
    console.error('❌ EN içerik yok (gazete-today.en.json). Önce gazete-editorial-en.mjs (TR editöryal gerekir).');
    process.exit(1);
  }

  const src = await import(pathToFileURL(join(ROOT, 'newspaper', 'generator', 'sources.mjs')).href);

  const props = {
    date_long: formatDateLongEn(date),
    issue: src.issueOf ? `Issue ${src.issueOf(date)}` : '',
    lead_headline: news.lead_headline,
    lead_deck: oneLine(news.lead_deck),
    lead_image: news.lead_image || '',
    col1_label: labelFrom(news.col1_byline, 'News'),
    col1_title: news.col1_title || '',
    col1_summary: oneLine(news.col1_body),
    col3_label: labelFrom(news.col3_byline, 'Coast'),
    col3_title: news.col3_title || '',
    col3_summary: oneLine(news.col3_body),
    // Evergreen (EN, en.json'dan)
    eg_antik_name: news.eg_antik_name || '',
    eg_antik_tag: news.eg_antik_tag || '',
    eg_antik_fact: news.eg_antik_fact || '',
    eg_ad_name: news.eg_ad_name || '',
    eg_ad_tagline: news.eg_ad_tagline || '',
    eg_ad_cta: news.eg_ad_cta || '',
    labels: LABELS_EN,
  };

  const propsPath = resolve(ROOT, 'remotion', 'props-gazete-en.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır (EN) — Headline: "${props.lead_headline}"`);

  const outDir = resolve(ROOT, 'dist', 'social', 'gazete');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'gazete-reel-en.mp4');
  const silentMp4 = join(outDir, 'gazete-reel-en-silent.mp4');

  console.log('── Remotion render (GazeteReel EN, sessiz) ──');
  const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'GazeteReel', silentMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (r.status !== 0 || !existsSync(silentMp4)) { console.error('❌ render başarısız'); process.exit(1); }

  // Müzik mix (build-gazete-reel ile aynı bed).
  const music = ['dist/audio/news-bed.mp3', 'dist/audio/track1.mp3']
    .map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
  let musicOk = false;
  if (music) {
    console.log(`── Müzik mix: ${music.split(/[\\/]/).pop()} ──`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', silentMp4, '-i', music,
      '-filter_complex', '[1:a]volume=0.25,afade=in:st=0:d=1.5,afade=out:st=27:d=3[m]',
      '-map', '0:v', '-map', '[m]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', outMp4],
      { stdio: 'ignore' });
    musicOk = ff.status === 0 && existsSync(outMp4);
    if (!musicOk) console.warn('⚠ ffmpeg müzik mix başarısız — sessiz sürüm kullanılacak.');
  } else {
    console.warn('⚠ Müzik dosyası yok (dist/audio/) — sessiz sürüm.');
  }
  if (!musicOk) copyFileSync(silentMp4, outMp4);
  try { unlinkSync(silentMp4); } catch {}

  const kb = existsSync(outMp4) ? Math.round(statSync(outMp4).size / 1024) : 0;
  console.log(`✅ EN Reel hazır${musicOk ? ' (müzikli)' : ' (SESSİZ)'}: dist/social/gazete/gazete-reel-en.mp4 (${kb} KB)`);
}

function readEn(p, date) {
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return (j && j.date === date && j.lead_headline) ? j : null;
  } catch { return null; }
}

main().catch(e => { console.error('[build-gazete-reel-en]', e); process.exit(1); });
