#!/usr/bin/env node
/**
 * scripts/agency/build-villa-reel.mjs — "Haftanın Villası" villa reel'i render eder.
 * ---------------------------------------------------------------------------------
 * build-restoran-reel.mjs ikizi (💰 flagship slot — Cmt 20:00). data/villalar.json'dan uygun
 * bir villa seçer (>=1 gerçek foto — villa havuzu küçük), haftalık rotasyon
 * (data/agency/villa-reel-state.json) ile tekrarı önler, fotoları ffmpeg ile küçültüp
 * base64 DATA URI olarak gömer (cross-origin/file:// blokları aşılır), Remotion VillaReel'i
 * render eder, müzik mixler. Çıktı: dist/social/villa/villa-reel.mp4
 *
 * Kullanım:
 *   node scripts/agency/build-villa-reel.mjs            # rotasyondan sıradaki
 *   node scripts/agency/build-villa-reel.mjs <slug|isim># belirli villayı zorla
 * Gerektirir: remotion (kurulu), data/villalar.json, ffmpeg.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, unlinkSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const arg = process.argv.slice(2).find(a => !/^\d{4}-\d{2}-\d{2}$/.test(a) && !a.startsWith('-'));

const MIN_PHOTOS = 1; // villa havuzu küçük (galeriler seyrek) — 1 foto yeterli.
const isReal = (s) => !!s && !/placehold/i.test(s);
const photosOf = (r) => [r.image, ...(r.gallery || [])].filter(isReal)
  .filter((v, i, a) => a.indexOf(v) === i); // benzersiz

// Konumu kısalt: ilk anlamlı segment (mahalle/bölge).
function shortLoc(loc) {
  if (!loc) return 'Kalkan';
  const seg = String(loc).split(',').map(s => s.trim()).filter(Boolean);
  return (seg[0] || 'Kalkan').replace(/\s+/g, ' ').slice(0, 40);
}

async function tagline(v) {
  // Kısa editöryal satır — angarya iş → cheap-llm (ollama/nvidia). Başarısızsa şablon.
  const base = (Array.isArray(v.summary) ? v.summary[0] : v.summary) || '';
  const fallback = base ? String(base).replace(/\s+/g, ' ').slice(0, 110)
    : `${v.category || 'Lüks'} villa, ${shortLoc(v.location)} mevkiinde özel havuzuyla öne çıkıyor.`;
  try {
    const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
    const { text } = await cheapLLM(
      `Kalkan'daki "${v.name}" lüks kiralık villası için TEK cümlelik, davetkâr, abartısız Türkçe tanıtım yaz. ` +
      `Öne çıkanlar: ${v.pool || ''} ${v.seaView ? 'deniz manzarası' : ''} ${v.capacity || ''}. ` +
      `Emoji YOK, tırnak YOK, max 95 karakter.`,
      { maxTokens: 80, order: ['groq', 'cerebras', 'nvidia', 'gemini', 'claude'] },
    );
    const line = String(text || '').replace(/["“”]/g, '').split('\n')[0].trim();
    return line && line.length >= 15 && line.length <= 120 ? line : fallback;
  } catch { return fallback; }
}

function pickVilla(items) {
  const eligible = items.filter(v => photosOf(v).length >= MIN_PHOTOS)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  if (!eligible.length) return null;
  if (arg) {
    const q = arg.toLowerCase();
    const forced = eligible.find(v => v.id === arg || (v.name || '').toLowerCase().includes(q));
    if (forced) return { r: forced, state: null };
  }
  // Haftalık rotasyon: kullanılmayan ilk villa; hepsi tükenince sıfırla.
  const statePath = join(ROOT, 'data', 'agency', 'villa-reel-state.json');
  let state = { used: [] };
  try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch {}
  let next = eligible.find(v => !state.used.includes(v.id));
  if (!next) { state.used = []; next = eligible[0]; } // tur bitti → reset
  state.used.push(next.id);
  return { r: next, state, statePath };
}

async function main() {
  console.log('\n════ VILLA REEL — Haftanın Villası ════');
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'villalar.json'), 'utf8'));
  const items = Array.isArray(data) ? data : data.items || [];
  const picked = pickVilla(items);
  if (!picked) { console.error(`❌ Uygun villa yok (>=${MIN_PHOTOS} gerçek foto gerekli).`); process.exit(1); }
  const { r } = picked;
  console.log(`✓ Seçilen: ${r.name}  (${photosOf(r).length} foto)`);

  // ── Fotoları base64 DATA URI olarak göm — cross-origin YOK. ffmpeg ile küçült. ──
  const SITE = process.env.SITE_ORIGIN || 'https://kalkaninfo.com';
  const tmp = resolve(ROOT, 'dist', 'social', 'villa', '_tmp');
  mkdirSync(tmp, { recursive: true });
  const srcPhotos = photosOf(r).slice(0, 4);
  const photoRel = [];
  for (let i = 0; i < srcPhotos.length; i++) {
    const p = srcPhotos[i];
    let input = p;
    if (!/^https?:/i.test(p)) {
      const abs = resolve(ROOT, p.replace(/^\//, ''));
      if (existsSync(abs)) input = abs;
      else input = `${SITE}/${p.replace(/^\//, '')}`;
    }
    const outJpg = join(tmp, `p${i}.jpg`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', input, '-vf', "scale='min(1200,iw)':-2", '-q:v', '4', outJpg], { stdio: 'ignore' });
    if (ff.status !== 0 || !existsSync(outJpg)) { console.warn(`⚠ foto işlenemedi, atlanıyor: ${p}`); continue; }
    const b64 = readFileSync(outJpg).toString('base64');
    photoRel.push(`data:image/jpeg;base64,${b64}`);
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  if (!photoRel.length) { console.error('❌ İşlenebilir foto yok (ffmpeg gerekli).'); process.exit(1); }
  console.log(`✓ ${photoRel.length} foto gömüldü (data URI, ~${Math.round(photoRel.reduce((a, b) => a + b.length, 0) / 1024)}KB)`);

  const line = await tagline(r);
  const slug = r.id || '';
  const props = {
    kicker: "KALKAN'DA KONAKLA",
    name: r.name,
    category: r.category || 'Villa',
    capacity: r.capacity || '',
    bedrooms: r.bedrooms ? `${r.bedrooms} yatak odası` : '',
    pool: r.pool || '',
    seaView: r.seaView ? 'Deniz manzaralı' : '',
    location: shortLoc(r.location),
    phone: r.phone_concierge || r.phone || '',
    tagline: line,
    photos: photoRel,
    cta: slug ? `kalkaninfo.com/villa/${slug}` : 'kalkaninfo.com/villalar',
  };
  const propsPath = resolve(ROOT, 'remotion', 'props-villa.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır — Tagline: "${line}"`);

  const outDir = resolve(ROOT, 'dist', 'social', 'villa');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'villa-reel.mp4');
  const silentMp4 = join(outDir, 'villa-reel-silent.mp4');

  console.log('── Remotion render (VillaReel, sessiz) ──');
  const rr = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'VillaReel', silentMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (rr.status !== 0 || !existsSync(silentMp4)) { console.error('❌ render başarısız'); process.exit(1); }

  // ── Müzik mix: sakin/lüks ton. ──
  const music = ['assets/audio/reel-bed.mp3', 'dist/audio/relaxing.mp3', 'dist/audio/newdawn.mp3', 'dist/audio/slowmotion.mp3', 'dist/audio/track1.mp3']
    .map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
  let musicOk = false;
  if (music) {
    console.log(`── Müzik mix: ${music.split(/[\\/]/).pop()} ──`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', silentMp4, '-i', music,
      '-filter_complex', '[1:a]volume=0.28,afade=in:st=0:d=1.5,afade=out:st=27:d=3[m]',
      '-map', '0:v', '-map', '[m]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', outMp4],
      { stdio: 'ignore' });
    musicOk = ff.status === 0 && existsSync(outMp4);
    if (!musicOk) console.warn('⚠ ffmpeg müzik mix başarısız — sessiz sürüm.');
  } else {
    console.warn('⚠ Müzik dosyası yok (dist/audio/) — sessiz sürüm.');
  }
  if (!musicOk) copyFileSync(silentMp4, outMp4);
  try { unlinkSync(silentMp4); } catch {}

  // Rotasyon durumunu render başarılı olunca kaydet (zorlanan seçimde yazma).
  if (picked.state && picked.statePath) {
    try { writeFileSync(picked.statePath, JSON.stringify(picked.state, null, 2)); } catch {}
  }

  const kb = existsSync(outMp4) ? Math.round(statSync(outMp4).size / 1024) : 0;
  console.log(`✅ Reel hazır${musicOk ? ' (müzikli)' : ' (SESSİZ)'}: dist/social/villa/villa-reel.mp4 (${kb} KB)`);
  console.log(`   Villa: ${r.name} · CTA: ${props.cta}`);
}

main().catch(e => { console.error('[build-villa-reel]', e); process.exit(1); });
