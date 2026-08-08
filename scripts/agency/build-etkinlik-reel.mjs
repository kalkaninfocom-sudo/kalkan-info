#!/usr/bin/env node
/**
 * scripts/agency/build-etkinlik-reel.mjs — "Bu Hafta Kalkan'da" etkinlik tanıtım reel'i.
 * ------------------------------------------------------------------------------------
 * kalkaninfo.com/etkinlikler tanıtımı. EMOJİSİZ, hızlı, gerçek foto ağırlıklı.
 * Bu haftanın DOĞRULANMIŞ etkinliklerinden yalnızca KESİN mekan fotosu eşleşenleri seçer
 * (yanlış eşleşme/grounding riski yok), aynı mekana farklı galeri karesi atar, fotoları
 * ffmpeg ile parlatıp (brightness/saturation) base64 gömer, Remotion EtkinlikReel'i render eder,
 * enerjik müzik yatağı (assets/audio/etkinlik-bed.mp3) mixler.
 * Çıktı: dist/social/etkinlik/etkinlik-reel.mp4  (+ caption.txt — AI ibareli, Reklam Yönetmeliği md.1)
 *
 * Kullanım: node scripts/agency/build-etkinlik-reel.mjs
 * Gerektirir: remotion (kurulu), data/etkinlik-takvimi.json + restoranlar.json, ffmpeg.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync, unlinkSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsForWeek } from '../events-lib.mjs';
import { withAiDisclosure } from '../../lib/reklam-uyum.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SITE = process.env.SITE_ORIGIN || 'https://kalkaninfo.com';
const isReal = (s) => !!s && !/placehold/i.test(String(s));
const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

// ── KESİN mekan foto index'i (id + tam ad) — gevşek eşleşme YOK (yanlış foto riski) ──
function buildPhotoIndex() {
  // Yalnız restoranlar.json — gerçek mekan fotoları. plajlar.json bazı "görselleri" ÜSTÜ YAZILI
  // promosyon grafiği (ör. "Trust the road") → mekan fotosu değil, kullanma.
  const byId = new Map(), byName = new Map();
  for (const file of ['restoranlar.json']) {
    let data; try { data = JSON.parse(readFileSync(join(ROOT, 'data', file), 'utf8')); } catch { continue; }
    const items = Array.isArray(data) ? data : data.items || [];
    for (const v of items) {
      const photos = [v.image, ...(v.gallery || [])].filter(isReal).filter((u, i, a) => a.indexOf(u) === i)
        .sort((a, b) => (/-hero\./i.test(b) ? 1 : 0) - (/-hero\./i.test(a) ? 1 : 0)); // hero foto öne
      if (!photos.length) continue;
      if (v.id) byId.set(String(v.id), photos);
      if (v.name) byName.set(norm(v.name), photos);
    }
  }
  return { byId, byName };
}

// Etkinliğin mekanı için KESİN foto listesi (id ya da tam ad eşleşmesi; enrich fotosu da eklenir).
function photosFor(ev, idx) {
  const out = [];
  if (ev.venueId && idx.byId.has(String(ev.venueId))) out.push(...idx.byId.get(String(ev.venueId)));
  if (ev.venueName && idx.byName.has(norm(ev.venueName))) out.push(...idx.byName.get(norm(ev.venueName)));
  if (isReal(ev.photo)) out.unshift(ev.photo);
  return out.filter((u, i, a) => a.indexOf(u) === i);
}

async function weekEvents() {
  const iso = new Date().toISOString().slice(0, 10);
  const week = await eventsForWeek(iso, { includeUnverified: false });
  const seen = new Set(), uniq = [];
  for (const d of week) for (const e of d.events) {
    const k = `${e.venueName}|${e.type}|${e.title}`;
    if (!seen.has(k)) { seen.add(k); uniq.push(e); }
  }
  return uniq;
}

function embedPhoto(url, tmpDir, i) {
  let input = url;
  if (!/^https?:/i.test(url)) {
    const abs = resolve(ROOT, String(url).replace(/^\//, ''));
    input = existsSync(abs) ? abs : `${SITE}/${String(url).replace(/^\//, '')}`;
  }
  const outJpg = join(tmpDir, `e${i}.jpg`);
  // Parlaklık + doygunluk + kontrast lift (mekan fotoları karanlıktı) + hafif keskinlik.
  const vf = "scale='min(1600,iw)':-2,eq=brightness=0.06:saturation=1.22:contrast=1.07,unsharp=5:5:0.4";
  const ff = spawnSync('ffmpeg', ['-y', '-i', input, '-vf', vf, '-q:v', '2', outJpg], { stdio: 'ignore' });
  if (ff.status !== 0 || !existsSync(outJpg)) return null;
  return `data:image/jpeg;base64,${readFileSync(outJpg).toString('base64')}`;
}

async function main() {
  console.log('\n════ ETKİNLİK REEL — Bu Hafta Kalkan\'da (emojisiz, hızlı, fotoğraflı) ════');
  const idx = buildPhotoIndex();
  const all = await weekEvents();
  // Sadece KESİN fotosu olan etkinlikler (grounding: yanlış mekan fotosu yok)
  const withPhotos = all.map(e => ({ e, photos: photosFor(e, idx) })).filter(x => x.photos.length > 0);
  if (!withPhotos.length) { console.error('❌ Fotolu doğrulanmış etkinlik yok.'); process.exit(1); }

  // Seçim: tür çeşitliliği önce, sonra doldur (aynı mekan tekrar edebilir → farklı galeri karesi).
  // Her MEKANDAN tek kart (tekrar yok) + tür çeşitliliği önce. 4 gerçek mekan → 4 güçlü kart.
  const picked = [];
  const usedTypes = new Set(), usedVenues = new Set();
  for (const pass of [true, false]) {
    for (const x of withPhotos) {
      if (picked.length >= 5) break;
      if (picked.includes(x)) continue;
      if (usedVenues.has(norm(x.e.venueName))) continue;
      if (pass && usedTypes.has(x.e.type)) continue;
      picked.push(x); usedTypes.add(x.e.type); usedVenues.add(norm(x.e.venueName));
    }
  }

  const tmp = resolve(ROOT, 'dist', 'social', 'etkinlik', '_tmp');
  mkdirSync(tmp, { recursive: true });
  const venueUse = new Map(); // mekan → kaç kez kullanıldı (farklı galeri karesi seç)
  const events = [];
  picked.forEach((x, i) => {
    const key = norm(x.e.venueName);
    const n = venueUse.get(key) || 0; venueUse.set(key, n + 1);
    const src = x.photos[Math.min(n, x.photos.length - 1)]; // aynı mekan → sonraki foto
    const photo = embedPhoto(src, tmp, i);
    console.log(`   ${photo ? '📷' : '⚠️'} ${(x.e.day || '').padEnd(9)} ${(x.e.type || '').padEnd(12)} ${x.e.venueName}${x.e.time ? ' · ' + x.e.time : ''}  [foto #${n}]`);
    events.push({
      type: x.e.type || '', venue: x.e.venueName || '', area: x.e.area || '',
      day: x.e.day || '', time: x.e.time || '', title: (x.e.title || '').replace(/\s+/g, ' ').slice(0, 80),
      photo: photo || undefined,
    });
  });
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}

  const typesPresent = [...new Set(picked.map(x => x.e.type).filter(Boolean))];
  const subtitle = typesPresent.slice(0, 4).map(t => t.toLocaleLowerCase('tr')).join(' · ');
  const allTypes = [...new Set(all.map(e => e.type).filter(Boolean))];
  const types = (allTypes.length >= 4 ? allTypes : ['Canlı Müzik', 'DJ', 'Yoga', 'Sinema Gecesi', 'Parti']).map(t => t.toLocaleUpperCase('tr'));

  const props = {
    kicker: "BU HAFTA KALKAN'DA", title: 'ETKİNLİK REHBERİ',
    subtitle: subtitle || 'canlı müzik · DJ · yoga · sinema', events, types,
    cta: 'kalkaninfo.com/etkinlikler', aiNote: 'Yapay zeka destekli hazırlandı',
  };
  const propsPath = resolve(ROOT, 'remotion', 'props-etkinlik.json');
  writeFileSync(propsPath, JSON.stringify(props));
  console.log(`✓ Props hazır — ${events.length} etkinlik, hepsi gerçek fotoğraf (emojisiz).`);

  const outDir = resolve(ROOT, 'dist', 'social', 'etkinlik');
  mkdirSync(outDir, { recursive: true });
  const outMp4 = join(outDir, 'etkinlik-reel.mp4');
  const silentMp4 = join(outDir, 'etkinlik-reel-silent.mp4');

  console.log('── Remotion render (EtkinlikReel, sessiz) ──');
  const rr = spawnSync('npx', ['remotion', 'render', 'src/index.tsx', 'EtkinlikReel', silentMp4, `--props=${propsPath}`, '--log=error'], {
    cwd: resolve(ROOT, 'remotion'), stdio: 'inherit', shell: true,
  });
  if (rr.status !== 0 || !existsSync(silentMp4)) { console.error('❌ render başarısız'); process.exit(1); }

  // ── Müzik: enerjik üretilmiş yatak. Reel ~18.3s → fade out ~16s. ──
  const music = ['assets/audio/etkinlik-bed.mp3', 'assets/audio/reel-bed.mp3']
    .map(p => resolve(ROOT, p)).find(p => existsSync(p) && statSync(p).size > 1000);
  let musicOk = false;
  if (music) {
    console.log(`── Müzik mix: ${music.split(/[\\/]/).pop()} ──`);
    const ff = spawnSync('ffmpeg', ['-y', '-i', silentMp4, '-i', music,
      '-filter_complex', '[1:a]volume=0.32,afade=in:st=0:d=0.8,afade=out:st=16:d=2.3[m]',
      '-map', '0:v', '-map', '[m]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', outMp4], { stdio: 'ignore' });
    musicOk = ff.status === 0 && existsSync(outMp4);
    if (!musicOk) console.warn('⚠ müzik mix başarısız — sessiz sürüm.');
  } else console.warn('⚠ Müzik yatağı yok — sessiz sürüm.');
  if (!musicOk) copyFileSync(silentMp4, outMp4);
  try { unlinkSync(silentMp4); } catch {}

  // ── Caption (AI ibareli — Reklam Yönetmeliği md.1) ──
  const lines = picked.map(x => `• ${x.e.day} ${x.e.time || ''} — ${x.e.type}: ${x.e.venueName}`.replace(/\s+/g, ' ').trim());
  const rawCaption = `📅 BU HAFTA KALKAN'DA · Etkinlik Rehberi\n\n${lines.join('\n')}\n\nGün gün tüm program 👉 kalkaninfo.com/etkinlikler`;
  const rawHashtags = ['#kalkan', '#kalkaninfo', '#kaş', '#etkinlik', '#kalkangece'];
  const { caption, hashtags } = withAiDisclosure(rawCaption, { hashtags: rawHashtags, lang: 'tr' });
  writeFileSync(join(outDir, 'caption.txt'), `${caption}\n\n${hashtags.join(' ')}\n`);

  const kb = existsSync(outMp4) ? Math.round(statSync(outMp4).size / 1024) : 0;
  console.log(`✅ Reel hazır${musicOk ? ' (müzikli)' : ' (SESSİZ)'}: dist/social/etkinlik/etkinlik-reel.mp4 (${kb} KB)`);
}

main().catch(e => { console.error('[build-etkinlik-reel]', e); process.exit(1); });
