#!/usr/bin/env node
/**
 * scripts/agency/build-gazete-reel.mjs — Günlük "Kalkan Today" gazete reel'i render eder.
 * ---------------------------------------------------------------------------------------
 * İçerik: sources.mjs.getNews() → bugünün agent-editöryal içeriği (yoksa ham RSS) — canlı site
 * CAPTURE ETMEZ (banner bug'ı yok). Claude-tasarımı Remotion composition'ı (GazeteReel) render eder.
 * Çıktı: dist/social/gazete/gazete-reel.mp4  → sonra ayrı script IG/Telegram'a yollar.
 *
 * Kullanım: node scripts/agency/build-gazete-reel.mjs [YYYY-MM-DD]
 * Gerektirir: remotion (kurulu), data/gazete-today.json veya data/haberler.json.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const labelFrom = (byline, fallback) => {
  const t = String(byline || '').split('·').pop()?.trim();
  return t && t.length <= 24 ? t : fallback;
};

// Kolon gövdesini tek kısa satıra indir (ilk cümle, ~110 karakter) — kart özeti için.
const oneLine = (body) => {
  let s = Array.isArray(body) ? body.join(' ') : String(body || '');
  s = s.replace(/\s+/g, ' ').trim();
  const dot = s.indexOf('. ');
  if (dot > 20 && dot < 120) s = s.slice(0, dot + 1);
  return s.length > 110 ? s.slice(0, 107).trimEnd() + '…' : s;
};

async function main() {
  console.log(`\n════ GAZETE REEL — ${date} ════`);
  const src = await import(pathToFileURL(join(ROOT, 'newspaper', 'generator', 'sources.mjs')).href);
  const { getEvergreen } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'evergreen.mjs')).href);
  const eg = getEvergreen(date);
  const news = await src.getNews();
  if (!news || !news.lead_headline) {
    console.error('❌ İçerik yok (getNews boş). Önce gazete-editorial.mjs veya haberler.json gerekir.');
    process.exit(1);
  }

  const props = {
    date_long: src.formatDateLong ? src.formatDateLong(date) : date,
    issue: src.issueOf ? `Sayı ${src.issueOf(date)}` : '',
    lead_headline: news.lead_headline,
    lead_deck: news.lead_deck || '',
    lead_image: news.lead_image || '',
    col1_label: labelFrom(news.col1_byline, 'Gündem'),
    col1_title: news.col1_title || '',
    col1_summary: oneLine(news.col1_body),
    col3_label: labelFrom(news.col3_byline, 'Sahil'),
    col3_title: news.col3_title || '',
    col3_summary: oneLine(news.col3_body),
    // Evergreen (siteden): antik kent az-bilinen + hizmet reklamı
    eg_antik_name: eg.antik?.name || '',
    eg_antik_tag: eg.antik?.tag || '',
    eg_antik_fact: eg.antik?.fact || '',
    eg_ad_name: eg.ad?.name || '',
    eg_ad_tagline: eg.ad?.tagline || '',
    eg_ad_cta: eg.ad?.cta || '',
  };

  const propsPath = resolve(ROOT, 'remotion', 'props-gazete.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır — Manşet: "${props.lead_headline}"`);

  const outDir = resolve(ROOT, 'dist', 'social', 'gazete');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'gazete-reel.mp4');
  const silentMp4 = join(outDir, 'gazete-reel-silent.mp4');

  console.log('── Remotion render (GazeteReel, sessiz) ──');
  const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'GazeteReel', silentMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (r.status !== 0 || !existsSync(silentMp4)) { console.error('❌ render başarısız'); process.exit(1); }

  // ── Müzik mix (ffmpeg) — haber-bed'i varsa onu, yoksa track1 (Pixabay). Sessizden iyidir. ──
  // Haber-ajansı tonu için dist/audio/news-bed.mp3 koy → otomatik onu kullanır (takas kolay).
  const music = ['dist/audio/news-bed.mp3', 'dist/audio/track1.mp3']
    .map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
  let musicOk = false;
  if (music) {
    console.log(`── Müzik mix: ${music.split(/[\\/]/).pop()} ──`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', silentMp4, '-i', music,
      '-filter_complex', '[1:a]volume=0.25,afade=in:st=0:d=1.5,afade=out:st=32:d=3[m]',
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
  console.log(`✅ Reel hazır${musicOk ? ' (müzikli)' : ' (SESSİZ)'}: dist/social/gazete/gazete-reel.mp4 (${kb} KB)`);
}

main().catch(e => { console.error('[build-gazete-reel]', e); process.exit(1); });
