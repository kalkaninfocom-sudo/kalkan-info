#!/usr/bin/env node
/**
 * scripts/agency/build-bulten-reel.mjs — "Haftanın Bülteni" (Pazar) reel'ini render eder.
 * ---------------------------------------------------------------------------------------
 * data/gazete-archive/*.json (günlük editöryaller) son 7 günü toplar → haftanın en güçlü
 * ~4 haberi + 1 magazin başlığı seçer (cheap-llm; sağlam heuristik fallback) → BultenReel render.
 * Çıktı: dist/social/bulten/bulten-reel.mp4  → sonra bulten-approval IG/Telegram'a yollar.
 *
 * Kullanım: node scripts/agency/build-bulten-reel.mjs [YYYY-MM-DD]   (referans gün = bugün TR)
 * Gerektirir: remotion (kurulu), data/gazete-archive/ (gazete-editorial her gün yazar).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, unlinkSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const refDate = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const TR_AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const trDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${TR_AY[m - 1]}`; };
const labelFrom = (byline, fb) => { const t = String(byline || '').split('·').pop()?.trim(); return t && t.length <= 20 ? t : fb; };
const oneLine = (body) => {
  let s = Array.isArray(body) ? body.join(' ') : String(body || '');
  s = s.replace(/\s+/g, ' ').trim();
  const dot = s.indexOf('. ');
  if (dot > 20 && dot < 130) s = s.slice(0, dot + 1);
  return s.length > 120 ? s.slice(0, 117).trimEnd() + '…' : s;
};

// Son 7 arşiv gününü (refDate dahil, geriye) yükle.
function loadWeek() {
  const dir = join(ROOT, 'data', 'gazete-archive');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map(f => f.replace('.json', '')).filter(d => d <= refDate).sort().reverse().slice(0, 7);
  return files.map(d => { try { return JSON.parse(readFileSync(join(dir, `${d}.json`), 'utf8')); } catch { return null; } })
    .filter(Boolean);
}

// Haftanın haber havuzu: her günden lead + col1 + col3 (başlık + özet + label + tarih).
function candidatePool(week) {
  const pool = [];
  for (const g of week) {
    if (g.lead_headline) pool.push({ label: labelFrom(g.lead_byline, 'Manşet'), title: g.lead_headline, summary: oneLine(g.lead_deck || g.lead_body), date: g.date, w: 3 });
    if (g.col1_title) pool.push({ label: labelFrom(g.col1_byline, 'Gündem'), title: g.col1_title, summary: oneLine(g.col1_body), date: g.date, w: 1 });
    if (g.col3_title) pool.push({ label: labelFrom(g.col3_byline, 'Sahil'), title: g.col3_title, summary: oneLine(g.col3_body), date: g.date, w: 1 });
  }
  // Başlık benzersizleştir (aynı hafta tekrar eden manşetler)
  const seen = new Set();
  return pool.filter(x => { const k = x.title.toLowerCase().slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; });
}

// Heuristik seçim: en yeni + en ağırlıklı 4 (gün çeşitliliği gözeterek).
function heuristicPick(pool) {
  const sorted = [...pool].sort((a, b) => (b.date.localeCompare(a.date)) || (b.w - a.w));
  const picked = []; const days = new Set();
  for (const x of sorted) { // önce her günden 1 lead (çeşitlilik)
    if (picked.length >= 4) break;
    if (x.w === 3 && !days.has(x.date)) { picked.push(x); days.add(x.date); }
  }
  for (const x of sorted) { if (picked.length >= 4) break; if (!picked.includes(x)) picked.push(x); }
  return picked.slice(0, 4).map(({ label, title, summary }) => ({ label, title, summary }));
}

async function llmPick(pool, week) {
  // Angarya seçim/özet → cheap-llm. Başarısızsa heuristik.
  try {
    const { cheapJSON } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
    const list = pool.map((x, i) => `${i}. [${x.date} · ${x.label}] ${x.title} — ${x.summary || ''}`).join('\n');
    const { data } = await cheapJSON(
      `Aşağıda Kalkan'ın bu haftaki gazete haber havuzu var. Haftanın EN ÖNEMLİ ve BİRBİRİNDEN FARKLI ` +
      `4 haberini seç. Her biri için kısa etiket, güncel başlık ve TEK cümle özet ver. Sadece JSON:\n` +
      `{"items":[{"label":"","title":"","summary":""}]}\n\nHAVUZ:\n${list}`,
      { system: 'Kısa, olgusal, abartısız Türkçe haber-ajansı tonu. Emoji yok. Sadece geçerli JSON döndür.', order: ['groq', 'cerebras', 'nvidia', 'gemini', 'claude'] },
    );
    const items = (data?.items || []).filter(x => x?.title).slice(0, 4)
      .map(x => ({ label: String(x.label || '').slice(0, 20), title: String(x.title).slice(0, 90), summary: String(x.summary || '').slice(0, 130) }));
    if (items.length >= 2) return items;
  } catch (e) { console.warn('  ⚠ LLM seçim atlandı:', e.message); }
  return heuristicPick(pool);
}

async function main() {
  console.log(`\n════ HAFTANIN BÜLTENİ REEL — ${refDate} ════`);
  const week = loadWeek();
  if (!week.length) { console.error('❌ Arşiv boş (data/gazete-archive/). gazete-editorial her gün yazar; en az 1 gün gerekir.'); process.exit(1); }
  const dates = week.map(g => g.date).sort();
  const range = dates.length > 1 ? `${trDay(dates[0])} – ${trDay(dates[dates.length - 1])}` : trDay(dates[0]);
  console.log(`✓ ${week.length} gün toplandı (${range})`);

  const pool = candidatePool(week);
  const items = await llmPick(pool, week);
  console.log(`✓ ${items.length} öne çıkan haber seçildi:`); items.forEach(i => console.log(`   · ${i.title}`));

  // Magazin: en yeni günün magazin başlığı (varsa)
  const magDay = [...week].sort((a, b) => b.date.localeCompare(a.date)).find(g => g.magazine_lead_headline);
  const props = {
    kicker: 'KALKAN',
    range_label: range,
    items,
    magazine_title: magDay?.magazine_lead_headline || '',
    magazine_summary: magDay ? oneLine(magDay.magazine_lead_body) : '',
    cta: 'kalkaninfo.com/gazete',
  };
  const propsPath = resolve(ROOT, 'remotion', 'props-bulten.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır — Magazin: "${props.magazine_title || '(yok)'}"`);

  const outDir = resolve(ROOT, 'dist', 'social', 'bulten');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'bulten-reel.mp4');
  const silentMp4 = join(outDir, 'bulten-reel-silent.mp4');

  console.log('── Remotion render (BultenReel, sessiz) ──');
  const r = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'BultenReel', silentMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (r.status !== 0 || !existsSync(silentMp4)) { console.error('❌ render başarısız'); process.exit(1); }

  // Müzik mix: haber-bed → track1 (gazete reel ile aynı ton).
  const music = ['assets/audio/reel-bed.mp3', 'dist/audio/news-bed.mp3', 'dist/audio/track1.mp3']
    .map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
  let musicOk = false;
  if (music) {
    console.log(`── Müzik mix: ${music.split(/[\\/]/).pop()} ──`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', silentMp4, '-i', music,
      '-filter_complex', '[1:a]volume=0.25,afade=in:st=0:d=1.5,afade=out:st=21:d=3[m]',
      '-map', '0:v', '-map', '[m]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', outMp4],
      { stdio: 'ignore' });
    musicOk = ff.status === 0 && existsSync(outMp4);
    if (!musicOk) console.warn('⚠ ffmpeg müzik mix başarısız — sessiz sürüm.');
  } else {
    console.warn('⚠ Müzik dosyası yok (dist/audio/) — sessiz sürüm.');
  }
  if (!musicOk) copyFileSync(silentMp4, outMp4);
  try { unlinkSync(silentMp4); } catch {}

  const kb = existsSync(outMp4) ? Math.round(statSync(outMp4).size / 1024) : 0;
  console.log(`✅ Bülten reel hazır${musicOk ? ' (müzikli)' : ' (SESSİZ)'}: dist/social/bulten/bulten-reel.mp4 (${kb} KB)`);
}

main().catch(e => { console.error('[build-bulten-reel]', e); process.exit(1); });
