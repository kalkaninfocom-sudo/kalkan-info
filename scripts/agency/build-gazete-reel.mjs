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
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
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

async function main() {
  console.log(`\n════ GAZETE REEL — ${date} ════`);
  const src = await import(pathToFileURL(join(ROOT, 'newspaper', 'generator', 'sources.mjs')).href);
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
    col3_label: labelFrom(news.col3_byline, 'Sahil'),
    col3_title: news.col3_title || '',
  };

  const propsPath = resolve(ROOT, 'remotion', 'props-gazete.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır — Manşet: "${props.lead_headline}"`);

  const outDir = resolve(ROOT, 'dist', 'social', 'gazete');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'gazete-reel.mp4');

  console.log('── Remotion render (GazeteReel) ──');
  const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'GazeteReel', outMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (r.status !== 0) { console.error('❌ render başarısız'); process.exit(1); }

  const kb = existsSync(outMp4) ? Math.round(statSync(outMp4).size / 1024) : 0;
  console.log(`✅ Reel hazır: dist/social/gazete/gazete-reel.mp4 (${kb} KB)`);
}

main().catch(e => { console.error('[build-gazete-reel]', e); process.exit(1); });
