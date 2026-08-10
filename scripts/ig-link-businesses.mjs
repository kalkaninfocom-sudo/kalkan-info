#!/usr/bin/env node
/**
 * ig-link-businesses.mjs — Takip edilen IG handle'larını DB kayıtlarına bağlar (instagram alanı).
 *
 * Kaynak handle'lar: data/ig-following-20260810.json (kategorize).
 * Hedef: data/<dosya>.json kayıtlarının boş `instagram` alanı.
 * Güvenli: yüksek-güven eşleşmeleri uygular, belirsizleri RAPOR eder (yanlış bağlama yok).
 *
 * Kullanım:
 *   node scripts/ig-link-businesses.mjs restoran            # DRY-RUN (önerileri göster)
 *   node scripts/ig-link-businesses.mjs restoran --apply    # uygula (instagram alanını yaz)
 *   node scripts/ig-link-businesses.mjs otel|tekne|...      # kategori→dosya eşlemesi aşağıda
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const which = args.find(a => !a.startsWith('--')) || 'restoran';

// kategori (ig-following json) → DB dosyası
const MAP = {
  restoran: { cat: 'Restoran', file: 'restoranlar.json' },
  otel: { cat: 'Otel/Pansiyon', file: 'oteller.json' },
  tekne: { cat: 'Tekne/Su Sporları', file: 'turlar.json' },
  plaj: { cat: 'Beach/Beach-Club', file: 'plajlar.json' },
};
const cfg = MAP[which];
if (!cfg) { console.error('Kategori: restoran|otel|tekne|plaj'); process.exit(2); }

const follow = JSON.parse(readFileSync(join(ROOT, 'data', 'ig-following-20260810.json'), 'utf8'));
const handles = follow.categories[cfg.cat] || [];

const dbRaw = JSON.parse(readFileSync(join(ROOT, 'data', cfg.file), 'utf8'));
const items = Array.isArray(dbRaw) ? dbRaw : dbRaw.items || [];

// ---- normalizasyon: marka gürültüsünü at ----
const NOISE = /(kalkan|kas|restaurant|restoran|hotel|otel|cafe|kafe|bar|beach|club|kitchen|the|and|&|boat|tekne|tur|turlari|watersports|lounge|pub|official|com|tr|co|uk|_|\.|\d+)/gi;
const norm = s => (s || '').toLowerCase().replace(/[İıÇçĞğÖöŞşÜü]/g, c => ({'İ':'i','ı':'i','Ç':'c','ç':'c','Ğ':'g','ğ':'g','Ö':'o','ö':'o','Ş':'s','ş':'s','Ü':'u','ü':'u'}[c]||c)).replace(/[^a-z0-9]/g,' ');
const tokens = s => new Set(norm(s).replace(NOISE,' ').split(/\s+/).filter(t => t.length >= 3));
const compact = s => norm(s).replace(/[^a-z0-9]/g,'');

// ayırt edici marka kelimeleri: ada özgü, jenerik olmayan, >=5 karakter
const GENERIC = new Set(['restaurant','restoran','restorant','restauran','restorani','restaurantt','cafe','kafe','coffee','the','and','lounge','kitchen','kalkan','antalya','antalyada','antalyanin','kaş','kas','ocakbasi','ocakbası','coctail','cocktail','coctails','cocktails','terrace','beach','club','wine','hotel','otel','pansiyon','fast','food','alcohol','served','pizza','burger','burgers','fries','doner','kebap','kebab','house','meyhane','lezzeti','bezirgan','tavuk','ekmek','kofte','fastfood','bistro','deniz','manzara']);
function brandWords(name) {
  return norm(name).split(/\s+/).filter(w => w.length >= 5 && !GENERIC.has(w));
}
// SADECE handle, adın ayırt edici marka kelimesini (>=5) birebir içeriyorsa. En UZUN eşleşen kelime kazanır (spesifik > jenerik).
function score(handle, item) {
  const hc = compact(handle);
  const nc = compact(item.name);
  if (!nc || nc.length < 4) return 0;
  if (nc.length >= 7 && hc.includes(nc)) return 0.99 + nc.length / 1000; // tam ad
  let best = 0;
  for (const w of brandWords(item.name)) if (hc.includes(w) && w.length > best) best = w.length;
  return best ? 0.9 + best / 1000 : 0; // uzun marka kelimesi = daha yüksek skor
}

// Marka-kelimesi çakışması nedeniyle yanlış eşleşenler (elle doğrulandı) — bağlama.
const EXCLUDE = new Set(['akdeniz_restaurant_kalkan', 'lycian_goat']);
const linkedHandles = new Set(items.map(i => (i.instagram||'').toLowerCase().replace(/^@/,'').replace(/\/$/,'')));
const confident = [], uncertain = [], unmatched = [];

for (const h of handles) {
  if (linkedHandles.has(h.toLowerCase())) continue; // zaten bağlı
  if (EXCLUDE.has(h)) { unmatched.push(h + ' (hariç-yanlış eşleşme)'); continue; }
  let best = null, bestS = 0;
  for (const it of items) {
    if (it.instagram) continue; // dolu olanı ezme
    const s = score(h, it);
    if (s > bestS) { bestS = s; best = it; }
  }
  if (best && bestS >= 0.82) confident.push({ h, id: best.id, name: best.name, s: bestS.toFixed(2) });
  else if (best && bestS >= 0.62) uncertain.push({ h, id: best.id, name: best.name, s: bestS.toFixed(2) });
  else unmatched.push(h);
}

console.log(`\n=== ${which}: ${handles.length} handle · ${items.length} kayıt ===`);
console.log(`\n✅ YÜKSEK GÜVEN (${confident.length}) — ${APPLY ? 'UYGULANIYOR' : 'öneri'}:`);
confident.forEach(m => console.log(`  @${m.h}  →  ${m.name}  [${m.s}]`));
console.log(`\n🟡 BELİRSİZ (${uncertain.length}) — elle kontrol:`);
uncertain.forEach(m => console.log(`  @${m.h}  ?→  ${m.name}  [${m.s}]`));
console.log(`\n⚪ EŞLEŞMEYEN (${unmatched.length}) — DB'de yok, YENİ aday:`);
console.log('  ' + unmatched.join(', '));

if (APPLY && confident.length) {
  const byId = new Map(items.map(i => [i.id, i]));
  for (const m of confident) { const it = byId.get(m.id); if (it && !it.instagram) it.instagram = m.h; }
  writeFileSync(join(ROOT, 'data', cfg.file), JSON.stringify(dbRaw, null, 2) + '\n', 'utf8');
  console.log(`\n💾 ${confident.length} kayda instagram alanı yazıldı → data/${cfg.file}`);
} else if (!APPLY) {
  console.log(`\n(DRY-RUN — uygulamak için: --apply)`);
}
