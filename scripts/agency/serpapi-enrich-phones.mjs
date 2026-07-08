#!/usr/bin/env node
/**
 * scripts/agency/serpapi-enrich-phones.mjs — TELEFON ZENGİNLEŞTİRME (SerpApi Google Maps)
 * -----------------------------------------------------------------------------------------
 * AMAÇ: data/restoranlar.json'da GERÇEKTEN fotosuz (disk taraması) + telefonu OLMAYAN ama
 * `place_id` bulunan işletmeler için SerpApi Google Maps place engine ile telefon numarası
 * çeker ve item.phone alanına (boşsa) yazar. WhatsApp foto-kampanyasının erişim kitlesini büyütür.
 *
 * KOTA-DİKKATLİ: küçük batch (varsayılan 40), her istekte ufak gecikme, non-fatal. Kota dolarsa
 * (SerpApi 429/limit) durur ve o ana kadar bulunanları yazar.
 *
 * GÜVENLİK: telefon numaraları LOG'a BASILMAZ (sadece dosyaya yazılır). Sadece ad + durum loglanır.
 *
 * Kullanım:
 *   node scripts/agency/serpapi-enrich-phones.mjs            # tüm uygun adaylar (max --batch)
 *   node scripts/agency/serpapi-enrich-phones.mjs --batch 5  # ilk 5 (test)
 *   node scripts/agency/serpapi-enrich-phones.mjs --dry      # yazma, sadece adayları listele
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const KEY = process.env.SERPAPI_KEY;
if (!KEY) { console.error('HATA: SERPAPI_KEY yok (.env.local).'); process.exit(1); }

const argNum = (flag, def) => { const i = process.argv.indexOf(flag); return i > -1 ? (parseInt(process.argv[i + 1], 10) || def) : def; };
const BATCH = argNum('--batch', 40);
const DRY = process.argv.includes('--dry');

// --- disk tabanlı foto tespiti (kampanya scriptiyle aynı mantık) ----------------
const tr = (s) => String(s || '').toLowerCase()
  .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i').replace(/â/g, 'a');
const normSlug = (s) => tr(s).replace(/[^a-z0-9]/g, '');
const NON_CONTENT = /(logo|menucard|qr|favicon|icon)/i;
const STOP = new Set(['the', 'and', 'bar', 'cafe', 'kalkan', 'kas', 'restaurant', 'restoran', 'club', 'lounge', 'kitchen', 'cocktail', 'terrace', 'beach', 'hotel', 'otel', 'villa', 'by', 'de', 'la']);
const isBadImg = (s) => !s || /placehold|placeholder|no-image|noimage|default-|unsplash|pexels/i.test(String(s));
function walkImages(dir) {
  let out = [];
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkImages(p));
    else if (/\.(jpg|jpeg|webp|png)$/i.test(e.name)) out.push(e.name.replace(/\.(jpg|jpeg|webp|png)$/i, ''));
  }
  return out;
}
const DISK = walkImages(join(ROOT, 'assets', 'img')).map((b) => ({ n: normSlug(b), content: !NON_CONTENT.test(b) }));
function nameSlugs(it) {
  const words = tr(it.name).split(/[^a-z0-9]+/).filter(Boolean);
  const meaningful = words.filter((w) => !STOP.has(w));
  const c = new Set();
  c.add(words.join(''));
  if (words.length >= 2) c.add(words.slice(0, 2).join(''));
  if (words.length >= 3) c.add(words.slice(0, 3).join(''));
  if (meaningful[0]) c.add(meaningful[0]);
  if (meaningful.length >= 2) c.add(meaningful.slice(0, 2).join(''));
  const idw = tr(it.id || '').split(/[^a-z0-9]+/).filter(Boolean);
  if (idw[0]) c.add(idw[0]);
  if (idw.length >= 2) c.add(idw.slice(0, 2).join(''));
  return [...c].filter((x) => x && x.length >= 5);
}
function hasRealPhotos(it) {
  if (!isBadImg(it.image)) return true;
  if (Array.isArray(it.gallery) && it.gallery.some((x) => !isBadImg(x))) return true;
  for (const s of nameSlugs(it)) if (DISK.some((d) => d.content && d.n.startsWith(s))) return true;
  return false;
}
const digitsOf = (p) => String(p || '').replace(/\D/g, '');
const hasPhone = (it) => [it.phone, it.mobile, it.contact].some((p) => digitsOf(p).length >= 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serpPlace(placeId) {
  const url = `https://serpapi.com/search.json?engine=google_maps&type=place&place_id=${encodeURIComponent(placeId)}&hl=tr&api_key=${KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (res.status === 429) throw new Error('KOTA'); // rate/limit
  if (!res.ok) throw new Error(`${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(String(d.error).slice(0, 80));
  const pr = d.place_results || {};
  return { phone: pr.phone || '', website: pr.website || '' };
}

async function main() {
  const dataPath = join(ROOT, 'data', 'restoranlar.json');
  const raw = JSON.parse(await readFile(dataPath, 'utf8'));
  const items = raw.items || raw;

  const candidates = items.filter((it) => !hasRealPhotos(it) && !hasPhone(it) && it.place_id);
  console.log(`Aday (fotosuz + telefonsuz + place_id): ${candidates.length} · işlenecek: ${Math.min(BATCH, candidates.length)}${DRY ? ' · DRY' : ''}`);
  if (DRY) { console.log(candidates.slice(0, BATCH).map((c) => '  - ' + c.name).join('\n')); return; }

  let found = 0, empty = 0, failed = 0, quota = false;
  const list = candidates.slice(0, BATCH);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    try {
      const { phone } = await serpPlace(it.place_id);
      if (phone && digitsOf(phone).length >= 10) {
        if (!hasPhone(it)) { it.phone = phone; found++; console.log(`  ✓ ${it.name} — telefon bulundu`); }
      } else { empty++; console.log(`  · ${it.name} — telefon yok`); }
    } catch (e) {
      if (e.message === 'KOTA') { quota = true; console.error('  ! SerpApi KOTA doldu — duruluyor.'); break; }
      failed++; console.error(`  ! ${it.name} — hata: ${e.message}`);
    }
    await sleep(1200); // kota-dostu gecikme
  }

  // periyodik/son kayıt
  await writeFile(dataPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`\n✓ restoranlar.json güncellendi. telefon bulundu: ${found} · boş: ${empty} · hata: ${failed}${quota ? ' · KOTA DOLDU' : ''}`);
}

main().catch((e) => { console.error('HATA:', e); process.exit(1); });
