#!/usr/bin/env node
/**
 * scripts/agency/build-restoran-reel.mjs — "Haftanın Mekânı" restoran reel'i render eder.
 * ---------------------------------------------------------------------------------------
 * GazeteReel kardeşi (💰 flagship slot — Sal 20:00). data/restoranlar.json'dan uygun bir
 * restoran seçer (>=2 gerçek foto), haftalık rotasyon (data/agency/restoran-reel-state.json)
 * ile tekrarı önler, fotoları remotion/public/restoran/'a kopyalar, Remotion RestoranReel'i
 * render eder, müzik mixler. Çıktı: dist/social/restoran/restoran-reel.mp4
 * → sonra reel-approval benzeri script IG/Telegram'a yollar (ayrı adım).
 *
 * Kullanım:
 *   node scripts/agency/build-restoran-reel.mjs            # rotasyondan sıradaki
 *   node scripts/agency/build-restoran-reel.mjs <slug|isim># belirli restoranı zorla
 * Gerektirir: remotion (kurulu), data/restoranlar.json, assets/img/restoran/*.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, unlinkSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkImagePermission } from '../../lib/image-permission-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const arg = process.argv.slice(2).find(a => !/^\d{4}-\d{2}-\d{2}$/.test(a) && !a.startsWith('-'));

const isReal = (s) => !!s && !/placehold/i.test(s);
// Bir foto URL'i Instagram kaynaklı mı? (kendi /assets/ görsellerimiz değil)
const isIgHosted = (u) => /instagram|cdninstagram|fbcdn/i.test(String(u || ''));
const photosOf = (r) => [r.image, ...(r.gallery || [])].filter(isReal)
  .filter((v, i, a) => a.indexOf(v) === i) // benzersiz
  .filter((u) => {
    // Görsel İzni Bekçisi (Düzeltme A): yalnızca IG kaynaklı görseller denetlenir.
    // Kendi /assets/ görsellerimiz her zaman serbesttir.
    if (!isIgHosted(u)) return true;
    const uname = r.instagram || r.username || r.source;
    const izin = checkImagePermission(uname, 'dijital');
    if (!izin.allowed) {
      console.log(`  ↓ görsel izni: IG kaynaklı foto atlandı (@${uname || '?'}) — ${izin.reason}`);
      return false;
    }
    return true;
  });

// Konumu kısalt: ilk anlamlı segment (mahalle/cadde), yoksa "Kalkan".
function shortLoc(loc) {
  if (!loc) return 'Kalkan';
  const seg = String(loc).split(',').map(s => s.trim()).filter(Boolean);
  const pick = seg.find(s => /(mah|cad|cd|sok|sk|liman|sahil|marina|meydan|yanı|karşı)/i.test(s)) || seg[0];
  return (pick || 'Kalkan').replace(/\s+/g, ' ').slice(0, 40);
}

// Gerçek-yorum hook havuzundan (review-mining.mjs çıktısı) rastgele güçlü bir açılış seç.
// Müşterinin KENDİ sözü = uydurma editöryal satırdan çok daha güçlü hook.
function pickReviewHook(slug) {
  if (!slug) return null;
  const p = join(ROOT, 'content', 'hooks', `${slug}.json`);
  if (!existsSync(p)) return null;
  // Tanıtım reel'i POZİTİF açılmalı — şikayet/negatif işaretli hook'ları ele.
  const NEG = /\b(ama|fakat|ancak|maalesef|yüksek ses|gürült|pahal|sorun|kötü|berbat|eksik|hayal kırık|yavaş|kaba|ilgisiz|soğuk servis|beklet|kirli)\b/i;
  try {
    const d = JSON.parse(readFileSync(p, 'utf8'));
    const all = (Array.isArray(d.hooks) ? d.hooks : [])
      .filter((h) => typeof h === 'string' && h.trim().length >= 15 && h.trim().length <= 120)
      .map((h) => h.trim());
    if (!all.length) return null;
    const positive = all.filter((h) => !NEG.test(h));
    const pool = positive.length ? positive : all; // hepsi negatifse mecburen havuzun tamamı
    return pool[Math.floor(Math.random() * pool.length)]; // her build'de farklı → varyasyon
  } catch { return null; }
}

async function tagline(r) {
  // 1) Gerçek-yorum hook havuzu varsa ONU kullan (en güçlü, müşterinin kendi dili).
  const hook = pickReviewHook(r.id);
  if (hook) { console.log(`✓ Hook (gerçek yorumdan): "${hook}"`); return hook; }
  // 2) Havuz yoksa: kısa editöryal satır — cheap-llm. Başarısızsa şablon.
  const fallback = `${r.cuisine || 'Kalkan'} lezzetleriyle ${shortLoc(r.location)} mevkiinde öne çıkan bir adres.`;
  try {
    const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
    const { text } = await cheapLLM(
      `Kalkan'daki "${r.name}" restoranı için TEK cümlelik, iştah açıcı, abartısız Türkçe tanıtım yaz. ` +
      `Mutfak: ${r.cuisine || '-'}. Puan: ${r.rating || '-'}. Emoji YOK, tırnak YOK, max 90 karakter.`,
      { maxTokens: 80, order: ['groq', 'cerebras', 'nvidia', 'gemini', 'claude'] },
    );
    const line = String(text || '').replace(/["“”]/g, '').split('\n')[0].trim();
    return line && line.length >= 15 && line.length <= 120 ? line : fallback;
  } catch { return fallback; }
}

function pickRestaurant(items) {
  const eligible = items.filter(r => photosOf(r).length >= 2)
    .sort((a, b) => ((b.rating || 0) * (b.reviewCount || 0)) - ((a.rating || 0) * (a.reviewCount || 0)));
  if (!eligible.length) return null;
  if (arg) {
    const q = arg.toLowerCase();
    const forced = eligible.find(r => r.id === arg || (r.name || '').toLowerCase().includes(q));
    if (forced) return { r: forced, state: null };
  }
  // Haftalık rotasyon: kullanılmayan en yüksek skorlu; hepsi tükenince sıfırla.
  const statePath = join(ROOT, 'data', 'agency', 'restoran-reel-state.json');
  let state = { used: [] };
  try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch {}
  let next = eligible.find(r => !state.used.includes(r.id));
  if (!next) { state.used = []; next = eligible[0]; } // tur bitti → reset
  state.used.push(next.id);
  return { r: next, state, statePath };
}

async function main() {
  console.log('\n════ RESTORAN REEL — Haftanın Mekânı ════');
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'restoranlar.json'), 'utf8'));
  const items = Array.isArray(data) ? data : data.items || [];
  const picked = pickRestaurant(items);
  if (!picked) { console.error('❌ Uygun restoran yok (>=2 gerçek foto gerekli).'); process.exit(1); }
  const { r } = picked;
  console.log(`✓ Seçilen: ${r.name}  (${r.rating || '-'}★×${r.reviewCount || 0}, ${photosOf(r).length} foto)`);

  // ── Fotoları base64 DATA URI olarak göm — cross-origin YOK (site CORP=same-site
  //    Chromium'u engelliyor; file:// yasak; Remotion publicDir 404). ffmpeg ile küçült
  //    (max 1200px, jpg) → küçük data URI. Yerel dosya yoksa canlı siteden indirip küçült. ──
  const SITE = process.env.SITE_ORIGIN || 'https://kalkaninfo.com';
  const tmp = resolve(ROOT, 'dist', 'social', 'restoran', '_tmp');
  mkdirSync(tmp, { recursive: true });
  const srcPhotos = photosOf(r).slice(0, 4);
  const photoRel = [];
  for (let i = 0; i < srcPhotos.length; i++) {
    const p = srcPhotos[i];
    let input = p;
    if (!/^https?:/i.test(p)) {
      const abs = resolve(ROOT, p.replace(/^\//, ''));
      if (existsSync(abs)) input = abs;
      else input = `${SITE}/${p.replace(/^\//, '')}`;        // repo'da yoksa canlıdan indir
    }
    const outJpg = join(tmp, `p${i}.jpg`);
    // 1600px tavan + q:v 2 (near-lossless): reel 1080 geniş, ken-burns 1.22x zoom → ~1320px gerçek
    // ihtiyaç. 1200 tavan upscale/bulanıklık yapıyordu; 1600 net kalır. (data URI biraz büyür, sorun değil.)
    const ff = spawnSync('ffmpeg', ['-y', '-i', input, '-vf', "scale='min(1600,iw)':-2", '-q:v', '2', outJpg], { stdio: 'ignore' });
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
    kicker: "KALKAN'DA BU HAFTA",
    name: r.name,
    cuisine: (r.cuisine || r.category || '').replace(/\s*·\s*/g, ' · '),
    rating: typeof r.rating === 'number' ? r.rating : undefined,
    reviewCount: typeof r.reviewCount === 'number' ? r.reviewCount : undefined,
    priceRange: r.priceRange || '',
    location: shortLoc(r.location),
    phone: r.phone || '',
    tagline: line,
    photos: photoRel,
    cta: slug ? `kalkaninfo.com/restoran/${slug}` : 'kalkaninfo.com/restoranlar',
  };
  const propsPath = resolve(ROOT, 'remotion', 'props-restoran.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır — Tagline: "${line}"`);

  const outDir = resolve(ROOT, 'dist', 'social', 'restoran');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'restoran-reel.mp4');
  const silentMp4 = join(outDir, 'restoran-reel-silent.mp4');

  console.log('── Remotion render (RestoranReel, sessiz) ──');
  const rr = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'RestoranReel', silentMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (rr.status !== 0 || !existsSync(silentMp4)) { console.error('❌ render başarısız'); process.exit(1); }

  // ── Müzik mix: sıcak/restoran tonu (relaxing → newdawn → track1). ──
  const music = ['assets/audio/reel-bed.mp3', 'dist/audio/relaxing.mp3', 'dist/audio/newdawn.mp3', 'dist/audio/track1.mp3']
    .map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
  let musicOk = false;
  if (music) {
    console.log(`── Müzik mix: ${music.split(/[\\/]/).pop()} ──`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', silentMp4, '-i', music,
      '-filter_complex', '[1:a]volume=0.28,afade=in:st=0:d=1.5,afade=out:st=21:d=3[m]',
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
  console.log(`✅ Reel hazır${musicOk ? ' (müzikli)' : ' (SESSİZ)'}: dist/social/restoran/restoran-reel.mp4 (${kb} KB)`);
  console.log(`   Mekân: ${r.name} · CTA: ${props.cta}`);
}

main().catch(e => { console.error('[build-restoran-reel]', e); process.exit(1); });
