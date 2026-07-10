#!/usr/bin/env node
/**
 * Kişiselleştirilmiş satış teklifi üretici — GERÇEK veriyle.
 *
 * kalkaninfo.com veri setlerinden (restoran/otel/hizmet/villa) işletmeyi bulur,
 * gerçek boşlukları (Google yorum sayısı, web sitesi, Instagram, foto) çıkarır ve
 * satis-demo/index.html şablonuna window.__TEKLIF__ enjekte ederek self-contained
 * teklif sayfası üretir: satis-demo/teklif/<slug>.html
 *
 * Kullanım:
 *   node satis-demo/build-teklif.mjs "Öz Adana"
 *   node satis-demo/build-teklif.mjs "Street Munch" --open
 *   node satis-demo/build-teklif.mjs --list kebap        # ada göre ara
 *
 * Link: https://kalkaninfo.com/satis-demo/teklif/<slug>.html
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');           // repo kökü
const DATA = join(ROOT, 'data');
const TPL = join(__dirname, 'index.html');
const OUT_DIR = join(__dirname, 'teklif');

const DATASETS = [
  { file: 'restoranlar.json', kind: 'Restoran' },
  { file: 'oteller.json', kind: 'Otel' },
  { file: 'hizmetler.json', kind: 'Hizmet' },
  { file: 'villalar.json', kind: 'Villa' },
];

// ── yardımcılar ──────────────────────────────────────────────
function slugify(s) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };
  return String(s || '')
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, m => map[m] || m)
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function norm(s) { return slugify(s).replace(/-/g, ''); }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

async function loadAll() {
  const rows = [];
  for (const ds of DATASETS) {
    let d;
    try { d = JSON.parse(await readFile(join(DATA, ds.file), 'utf8')); } catch { continue; }
    const arr = Array.isArray(d) ? d : (d.items || d.data || Object.values(d).find(Array.isArray) || []);
    for (const r of arr) if (r && r.name) rows.push({ ...r, _kind: ds.kind });
  }
  return rows;
}

function findBusiness(rows, query) {
  const q = norm(query);
  // tam eşleşme → başlangıç → içerir
  return rows.find(r => norm(r.name) === q)
    || rows.find(r => norm(r.name).startsWith(q))
    || rows.find(r => norm(r.name).includes(q));
}

// ── gerçek veriden before/after üret ─────────────────────────
function buildFacts(b) {
  const rating = Number(b.rating) || null;
  const reviews = Number(b.reviewCount) || 0;
  const photos = Array.isArray(b.gallery) ? b.gallery.length : (b.image ? 1 : 0);
  const hasWeb = !!(b.website && !/kalkaninfo\.com/i.test(b.website));
  const hasIg = !!b.instagram;
  const kind = b._kind || 'İşletme';
  const cat = b.category || b.cuisine || kind;
  const loc = b.location ? ` · ${b.location}` : '';

  // ŞU AN (gerçek boşluklar, öncelik sırasıyla)
  const before = [];
  if (reviews && reviews < 200) before.push(`Google'da yalnızca <strong>${reviews} yorum</strong> — öne çıkan rakipler 300+`);
  else if (!reviews) before.push(`Google'da yorum/puan görünürlüğü zayıf`);
  if (photos < 6) before.push(`Google & sosyalde az görsel (<strong>${photos} foto</strong>) — mekan hak ettiği gibi görünmüyor`);
  if (!hasWeb) before.push(`Kendi web siteniz yok — tamamen Google listesine bağımlısınız`);
  if (!hasIg) before.push(`Instagram bağlantısı düzensiz / profil zayıf`);
  before.push(`Yorum ve WhatsApp mesajlarına gecikmeli yanıt`);
  before.push(`Yabancı turiste ulaşamıyorsunuz (tek dilde içerik)`);

  // BİZİMLE (gerçek duruma bağlı hedefler)
  const after = [];
  after.push(`Haftalık profesyonel Reels + hikâye — <strong>5 dilde</strong> (TR/EN/DE/FR/RU)`);
  after.push(`kalkaninfo.com'da <strong>öne çıkan / altın kart</strong> (zaten listelisiniz — yükseltiyoruz)`);
  if (reviews < 200) after.push(`Google yorum kampanyası → ${reviews || 0}'dan <strong>300+ yoruma</strong> hedefli büyüme`);
  if (!hasWeb) after.push(`Size özel mini web sayfası + dijital menü`);
  if (photos < 6) after.push(`Profesyonel görsel seti — Google & sosyalde tam vitrin`);
  after.push(`WhatsApp otomatik karşılama & rezervasyon yönlendirme`);
  after.push(`Aylık performans raporu + rakip takibi`);

  // mock kart metaları (gerçek)
  const beforeMeta = rating
    ? `⭐ ${rating} &nbsp;·&nbsp; ${reviews} Google yorumu`
    : `Görünürlük düşük`;
  const beforeNote = `${esc(cat)}${loc} — dijitalde eksik`;
  const afterMeta = `⭐ hedef ${rating ? Math.min(5, rating + 0.3).toFixed(1) : '4.8'} &nbsp;·&nbsp; aktif yorum akışı`;
  const afterNote = `Öne çıkan kart · haftalık Reels · 5 dil`;

  return {
    before: before.slice(0, 5),
    after: after.slice(0, 5),
    beforeMeta, beforeNote, afterMeta, afterNote,
  };
}

// ── ana ──────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const listMode = argv.includes('--list');
  const query = argv.filter(a => !a.startsWith('--')).join(' ').trim();

  const rows = await loadAll();

  if (listMode) {
    const q = norm(query);
    const hits = rows.filter(r => !q || norm(r.name).includes(q)).slice(0, 40);
    console.log(`${hits.length} işletme:`);
    for (const r of hits) console.log(`  ${r.name}  [${r._kind}${r.reviewCount ? ', ' + r.reviewCount + ' yorum' : ''}]`);
    return;
  }

  if (!query) {
    console.error('Kullanım: node satis-demo/build-teklif.mjs "İşletme Adı"');
    console.error('          node satis-demo/build-teklif.mjs --list [arama]');
    process.exit(1);
  }

  const b = findBusiness(rows, query);
  if (!b) {
    console.error(`✗ "${query}" bulunamadı. Yakın adları görmek için: --list ${query}`);
    process.exit(1);
  }

  const facts = buildFacts(b);
  const slug = slugify(b.name);
  const payload = { name: b.name, kind: b._kind, facts };

  const tpl = await readFile(TPL, 'utf8');
  const inject = `\n  <script>window.__TEKLIF__ = ${JSON.stringify(payload)};</script>`;
  // Kişiselleştirme script'inden HEMEN ÖNCE enjekte et (script __TEKLIF__'i okur)
  const marker = '  <script>\n    (function () {\n      // __TEKLIF__';
  let html;
  if (tpl.includes(marker)) html = tpl.replace(marker, inject + '\n' + marker);
  else html = tpl.replace('</body>', inject + '\n</body>'); // güvenli fallback

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${slug}.html`);
  await writeFile(outPath, html, 'utf8');

  console.log(`✓ Teklif üretildi: ${b.name} [${b._kind}]`);
  console.log(`  Dosya : satis-demo/teklif/${slug}.html`);
  console.log(`  Link  : https://kalkaninfo.com/satis-demo/teklif/${slug}.html`);
  console.log(`  Gerçek: ${b.rating ? '⭐' + b.rating + ' · ' : ''}${b.reviewCount || 0} yorum · ${(b.gallery || []).length} foto · web:${b.website ? '✓' : '✗'} · ig:${b.instagram ? '✓' : '✗'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
