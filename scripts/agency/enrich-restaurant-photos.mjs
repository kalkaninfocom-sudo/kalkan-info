#!/usr/bin/env node
/**
 * enrich-restaurant-photos.mjs
 *
 * Fotoğrafı eksik restoranların görsellerini doldurur. İki aşama:
 *
 *   AŞAMA 1 — DİSK SENKRON (bedava): assets/img/restoran/ altında item id'siyle
 *     (veya isim slug'ıyla) eşleşen dosyaları bulur, item.gallery'ye ekler,
 *     item.image boşsa ilkini atar.
 *
 *   AŞAMA 2 — GOOGLE FOTO (SerpApi, kota-dikkatli): Aşama 1'den sonra hâlâ ≤1
 *     gerçek fotosu olan + place_id dolu restoranlar için Google Maps fotolarını
 *     çeker, <id>-g1.jpg ... olarak indirir, gallery+image günceller.
 *
 * Kullanım:
 *   node scripts/agency/enrich-restaurant-photos.mjs           # tam çalıştırma
 *   node scripts/agency/enrich-restaurant-photos.mjs --dry     # yazma yok, rapor
 *   node scripts/agency/enrich-restaurant-photos.mjs --batch 30  # Aşama 2'de max 30 restoran
 *   node scripts/agency/enrich-restaurant-photos.mjs --stage1  # sadece disk senkron
 *   node scripts/agency/enrich-restaurant-photos.mjs --stage2  # sadece Google
 *
 * Idempotent: indirilmiş (-g*) fotoyu tekrar çekmez, gallery'de olanı tekrar eklemez.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_PATH = join(ROOT, 'data', 'restoranlar.json');
const IMG_DIR = join(ROOT, 'assets', 'img', 'restoran');
const WEB_PREFIX = '/assets/img/restoran/';

// ── .env.local yükle (diğer scripts/agency/*.mjs ile aynı pattern) ──
try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// ── CLI flags ──
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry') || argv.includes('--dry-run');
const ONLY1 = argv.includes('--stage1');
const ONLY2 = argv.includes('--stage2');
const RUN_STAGE1 = !ONLY2;
const RUN_STAGE2 = !ONLY1;
const BATCH = (() => {
  const i = argv.indexOf('--batch');
  if (i >= 0 && argv[i + 1]) return Number(argv[i + 1]);
  const eq = argv.find((a) => a.startsWith('--batch='));
  if (eq) return Number(eq.split('=')[1]);
  return 30; // varsayılan: kota-dikkatli ilk batch
})();

const IMG_EXT = /\.(jpe?g|png|webp)$/i;

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// bir dosya adının "prefix"i: uzantı + -hero/-N/-gN son eki atılmış hali
function filePrefix(f) {
  return f.replace(IMG_EXT, '').replace(/-(hero|\d+|g\d+)$/i, '');
}

// item için benzersiz mevcut foto sayısı (image + gallery, dedup)
function photoSet(it) {
  const s = new Set();
  if (it.image) s.add(it.image);
  for (const g of it.gallery || []) s.add(g);
  return s;
}

// dosya sıralama: hero önce, sonra sayısal, sonra alfabetik
function orderFiles(files) {
  return files.slice().sort((a, b) => {
    const ah = /-hero\./i.test(a) ? 0 : 1;
    const bh = /-hero\./i.test(b) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    const an = Number((a.match(/-(\d+)\./) || [])[1] || 1e9);
    const bn = Number((b.match(/-(\d+)\./) || [])[1] || 1e9);
    if (an !== bn) return an - bn;
    return a.localeCompare(b);
  });
}

async function main() {
  const raw = readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  const items = data.items;
  const allFiles = readdirSync(IMG_DIR).filter((f) => IMG_EXT.test(f));

  // prefix -> [dosyalar]
  const byPrefix = new Map();
  for (const f of allFiles) {
    const p = filePrefix(f);
    if (!byPrefix.has(p)) byPrefix.set(p, []);
    byPrefix.get(p).push(f);
  }

  let stage1Count = 0;    // galerisi diskten büyüyen restoran
  let stage1Added = 0;    // eklenen toplam dosya
  const stage1Names = [];

  // ═══ AŞAMA 1 — DİSK SENKRON ═══
  if (RUN_STAGE1) {
    for (const it of items) {
      const idSlug = it.id;
      const nameSlug = slugify(it.name);
      // eşleşen prefix'ler: item id veya isim slug'ı
      const matched = [];
      for (const [pfx, files] of byPrefix) {
        if (pfx === idSlug || pfx === nameSlug) matched.push(...files);
      }
      if (!matched.length) continue;

      const webPaths = orderFiles([...new Set(matched)]).map((f) => WEB_PREFIX + f);
      const existing = new Set(it.gallery || []);
      const before = existing.size;
      if (!Array.isArray(it.gallery)) it.gallery = it.gallery ? [it.gallery] : [];
      // image boşsa ilk (hero-öncelikli) dosyayı ana görsel yap
      if (!it.image && webPaths.length) it.image = webPaths[0];
      let addedHere = 0;
      for (const wp of webPaths) {
        if (wp === it.image) continue;             // ana görseli galeride tekrarlama
        if (!it.gallery.includes(wp)) { it.gallery.push(wp); addedHere++; }
      }
      if (addedHere > 0) {
        stage1Count++;
        stage1Added += addedHere;
        stage1Names.push(`${it.id} (+${addedHere})`);
      }
    }
  }

  // ═══ AŞAMA 2 — GOOGLE FOTO (SerpApi) ═══
  let stage2Count = 0;
  let apiCalls = 0;
  let quotaHit = false;
  const stage2Names = [];
  const skippedNoPid = [];

  if (RUN_STAGE2) {
    if (!SERPAPI_KEY) {
      console.error('⚠ SERPAPI_KEY yok (.env.local) — Aşama 2 atlandı.');
    } else {
      // aday: hâlâ ≤1 gerçek foto + place_id dolu
      const candidates = items.filter((it) => {
        const n = photoSet(it).size;
        return n <= 1 && it.place_id;
      });
      const batch = candidates.slice(0, BATCH);
      console.error(`Aşama 2: ${candidates.length} aday, bu batch ${batch.length} işlenecek (limit ${BATCH}).`);

      for (const it of batch) {
        // idempotent: -g dosyaları zaten indirilmişse atla
        const existingG = allFiles.filter((f) => f.startsWith(`${it.id}-g`));
        if (existingG.length >= 4) {
          continue;
        }
        try {
          // 1) place -> data_id
          const placeUrl = `https://serpapi.com/search.json?engine=google_maps&type=place&place_id=${encodeURIComponent(it.place_id)}&api_key=${SERPAPI_KEY}`;
          const pRes = await fetch(placeUrl);
          apiCalls++;
          if (pRes.status === 429 || pRes.status === 401) { quotaHit = true; console.error(`  ✖ kota/yetki hatası (HTTP ${pRes.status}) — DURULDU.`); break; }
          const pJson = await pRes.json();
          if (pJson.error) {
            if (/limit|quota|run out|exhaust/i.test(pJson.error)) { quotaHit = true; console.error(`  ✖ kota: ${pJson.error} — DURULDU.`); break; }
            continue; // bu mekan çözülemedi, atla
          }
          const dataId = pJson.place_results?.data_id;
          if (!dataId) continue;

          // 2) data_id -> photos
          const photoUrl = `https://serpapi.com/search.json?engine=google_maps_photos&data_id=${encodeURIComponent(dataId)}&api_key=${SERPAPI_KEY}`;
          const phRes = await fetch(photoUrl);
          apiCalls++;
          if (phRes.status === 429 || phRes.status === 401) { quotaHit = true; console.error(`  ✖ kota/yetki hatası (HTTP ${phRes.status}) — DURULDU.`); break; }
          const phJson = await phRes.json();
          if (phJson.error) {
            if (/limit|quota|run out|exhaust/i.test(phJson.error)) { quotaHit = true; console.error(`  ✖ kota: ${phJson.error} — DURULDU.`); break; }
            continue;
          }
          const urls = (phJson.photos || []).map((p) => p.image).filter(Boolean).slice(0, 8);
          if (!urls.length) continue;

          // 3) indir
          const added = [];
          let idx = existingG.length; // önceki -g dosyalarının üstüne yazma
          for (const url of urls) {
            idx++;
            const fname = `${it.id}-g${idx}.jpg`;
            const fpath = join(IMG_DIR, fname);
            if (existsSync(fpath)) { added.push(WEB_PREFIX + fname); continue; }
            try {
              const imgRes = await fetch(url);
              if (!imgRes.ok) { idx--; continue; }
              const raw = Buffer.from(await imgRes.arrayBuffer());
              if (raw.length < 1000) { idx--; continue; } // bozuk/boş
              // Google full-res gelir (~1-2MB) → repo/Vercel şişmesin diye 1000px q68 sıkıştır (~120KB).
              let buf = raw;
              try {
                const sharp = (await import('sharp')).default;
                buf = await sharp(raw, { failOn: 'none' }).rotate().resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
              } catch { /* sharp yoksa ham yaz */ }
              if (!DRY) writeFileSync(fpath, buf);
              added.push(WEB_PREFIX + fname);
              allFiles.push(fname);
            } catch { idx--; }
          }
          if (added.length) {
            if (!Array.isArray(it.gallery)) it.gallery = [];
            for (const wp of added) if (!it.gallery.includes(wp)) it.gallery.push(wp);
            if (!it.image && it.gallery.length) it.image = it.gallery[0];
            else if (it.image && it.gallery.length && !it.gallery.includes(it.image) === false) { /* image ok */ }
            if (!it.image) it.image = added[0];
            stage2Count++;
            stage2Names.push(`${it.id} (+${added.length})`);
          }
        } catch (e) {
          console.error(`  ! ${it.id}: ${e.message}`);
        }
      }
    }
  }

  // ── yaz ──
  if (!DRY && (stage1Added > 0 || stage2Count > 0)) {
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  // ── son durum ──
  const stillNoPhoto = items.filter((it) => photoSet(it).size <= 1);
  const stillNoPhotoNoPid = stillNoPhoto.filter((it) => !it.place_id);

  console.log('\n════════ RAPOR ════════');
  console.log(`Mod: ${DRY ? 'DRY (yazma yok)' : 'CANLI'}${ONLY1 ? ' [sadece Aşama1]' : ''}${ONLY2 ? ' [sadece Aşama2]' : ''}`);
  console.log(`Toplam restoran: ${items.length}`);
  console.log(`\nAŞAMA 1 (disk senkron): ${stage1Count} restoranın galerisi dolduruldu, +${stage1Added} dosya.`);
  if (stage1Names.length) console.log('  ' + stage1Names.join(', '));
  console.log(`\nAŞAMA 2 (Google/SerpApi): ${stage2Count} restorana foto eklendi. SerpApi çağrısı: ${apiCalls}. Kota durumu: ${quotaHit ? 'KOTA/HATA — durduruldu' : (RUN_STAGE2 && SERPAPI_KEY ? 'sorun yok' : 'çalışmadı')}.`);
  if (stage2Names.length) console.log('  ' + stage2Names.join(', '));
  console.log(`\nHâlâ ≤1 fotolu restoran: ${stillNoPhoto.length} (bunlardan ${stillNoPhotoNoPid.length} tanesinin place_id'si de yok → çekilemez).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
