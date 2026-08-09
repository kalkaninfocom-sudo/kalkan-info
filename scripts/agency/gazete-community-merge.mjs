#!/usr/bin/env node
/**
 * scripts/agency/gazete-community-merge.mjs — TOPLULUK EDİTÖRÜ → GAZETE köprüsü (P3)
 * ------------------------------------------------------------------------------------------
 * Gazete Topluluk Editörü'nde (gazete/editor.html) katkıcıların önerip ADMIN'in ONAYLADIĞI
 * içerikleri (gazete_submissions, status='approved', target_date = bu sayının tarihi) çeker ve
 * o günün gazetesine (data/gazete-today.json) ilgili slot'lara editöryal içerik olarak enjekte eder.
 *
 * AKIŞ: newspaper-daily.mjs sırasında haber odası (gazete-newsroom) ÇALIŞTIKTAN SONRA,
 * build.mjs ÇALIŞMADAN ÖNCE bu script koşar. sources.mjs.getNews()/buildMagazineData() bugünün
 * data/gazete-today.json dosyasını okuduğu için, buraya yazdığımız topluluk içeriği doğrudan
 * yayına girer. gazete-today.json yoksa (haber odası LLM'siz/başarısız) minimal bir taban oluşturulur.
 *
 * KALİTE/UYUM KAPISI: Onaylı submission admin denetiminden geçti (temel güvence) AMA yayına giren
 * metin yine de lib/reklam-uyum.mjs (scanReklamUyum) HARD ihlal taramasından geçer — uydurma
 * yorum / sahte deneyim / yönetmelik ihlali içeren metin ATLANIR (log + kaynak gazetede kalmaz).
 *
 * İZ: enjekte edilen her slot { ..._source:'topluluk', _contributor_email } ile işaretlenir; ayrıca
 * out.community_slots listelenir (şeffaflık/denetim). Topluluk içeriği agent-editöryalinin ÜZERİNE yazar
 * (admin onayı en yüksek editöryal karar).
 *
 * Kullanım: node scripts/agency/gazete-community-merge.mjs [YYYY-MM-DD]
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (yoksa → no-op, build normal devam eder).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanReklamUyum } from '../../lib/reklam-uyum.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel çalıştırma; CI'da env zaten dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Basit HTML escape (metin kaynak dosyaya ham girer; build render'ı zaten kaçırıyor ama URL/gövde temizliği)
function stripTags(s) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
function toParas(t) {
  return String(t || '').split(/\n{2,}|\r?\n/).map(s => s.trim()).filter(Boolean);
}

// editor.html SLOT_SCHEMA ↔ gazete-today.json alanları eşlemesi.
// ÖNEMLİ: Yalnız MORNING/MAGAZINE ŞABLONUNUN GERÇEKTEN RENDER ETTİĞİ alanlara yaz. Morning ön sayfa
// manşet bloğu: lead_headline/lead_deck/lead_image/lead_caption/lead_source_cite; altındaki gövde
// alanı FEATURE bloğu: feature_title/feature_body. (Şablonda {{lead_body}}/{{col1_*}}/{{col3_*}}
// PLACEHOLDER'I YOK → oralara yazmak GÖRÜNMEZ.) Magazin hero: magazine_lead_headline/body
// (buildMagazineData bunlardan hero_headline/hero_deck türetir).
// Her slot fonksiyonu fields (jsonb {headline,deck,body,image,caption}) → gazete-today.json patch objesi döndürür.
// reklam-uyum kontrolü fonksiyon dışında (birleşik metinde) yapılır.
const SLOT_MAPPERS = {
  // Sabah manşet → lead bloğu + (gövde varsa) feature bloğu
  lead: (f) => {
    const patch = {
      lead_headline: stripTags(f.headline),
      lead_deck: f.deck ? stripTags(f.deck) : (f.body ? trimSentence(stripTags(f.body), 160) : ''),
      lead_source_cite: 'Kaynak: Topluluk Editörü',
      lead_source: 'Topluluk Editörü',
      lead_source_url: '',
    };
    if (f.image) { patch.lead_image = String(f.image).trim(); patch.lead_caption = f.caption ? stripTags(f.caption) : 'Foto: Topluluk katkısı'; }
    else if (f.caption) patch.lead_caption = stripTags(f.caption);
    // Manşet gövdesi → ön sayfadaki feature bloğuna (görünür tek gövde alanı)
    if (f.body) { patch.feature_title = stripTags(f.headline); patch.feature_body = stripTags(f.body); }
    return patch;
  },
  // Sabah sol köşe → feature bloğu (ön sayfada render edilen köşe yazısı alanı)
  col1: (f) => ({
    feature_title: stripTags(f.title || f.headline),
    feature_body: stripTags(f.body),
  }),
  // Sabah sağ kolon → feature bloğu (col1 yoksa; precedence main() sırasında)
  col3: (f) => ({
    feature_title: stripTags(f.title || f.headline),
    feature_body: stripTags(f.body),
  }),
  // Magazin manşet → magazine hero (buildMagazineData magazine_lead_* alanlarını okur)
  magazine_lead: (f) => ({
    magazine_lead_headline: stripTags(f.headline),
    magazine_lead_body: f.body ? toParas(stripTags(f.body)) : [],
  }),
};

// İlk cümlede kes (deck fallback için) — max chars, cümle sınırı önceler.
function trimSentence(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const dot = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return dot > maxChars * 0.4 ? slice.slice(0, dot + 1) : slice.replace(/\s+\S*$/, '') + '…';
}

async function fetchApproved() {
  const url = `${SUPA_URL}/rest/v1/gazete_submissions` +
    `?status=eq.approved&target_date=eq.${date}` +
    `&order=reviewed_at.desc&select=id,edition,slot,fields,user_email,reviewed_at`;
  const r = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if (!r.ok) throw new Error(`gazete_submissions çekilemedi: ${r.status} ${(await r.text()).slice(0, 160)}`);
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

async function main() {
  console.log(`\n════ GAZETE TOPLULUK MERGE — ${date} ════`);
  if (!SUPA_URL || !SUPA_KEY) {
    console.warn('⚠ SUPABASE env yok — topluluk merge atlandı (build normal devam eder).');
    return;
  }

  let approved;
  try {
    approved = await fetchApproved();
  } catch (e) {
    console.warn(`⚠ ${e.message} — topluluk merge atlandı.`);
    return; // non-fatal
  }
  if (!approved.length) {
    console.log('  ℹ Bu sayı için onaylı topluluk önerisi yok — merge atlandı.');
    return;
  }
  console.log(`  ↳ ${approved.length} onaylı topluluk önerisi bulundu.`);

  // Mevcut gazete-today.json'u oku (haber odası/editöryal ürettiyse), yoksa minimal taban.
  const outPath = join(ROOT, 'data', 'gazete-today.json');
  let out = {};
  try {
    const existing = JSON.parse(await readFile(outPath, 'utf8'));
    if (existing && existing.date === date) out = existing;
    else console.log('  ℹ gazete-today.json farklı tarihli/yok — topluluk için yeni taban oluşturuluyor.');
  } catch { /* dosya yok — yeni oluştur */ }
  out.date = date;

  // Slot başına EN YENİ onaylı öneri (reviewed_at desc → ilk görülen tutulur).
  // İşleme ÖNCELİK sırası: lead > col1 > col3 > magazine_lead. col1/col3/lead ortak FEATURE
  // bloğunu paylaşır (şablonda tek görünür gövde alanı) → yüksek öncelikli olan kazanır,
  // düşük öncelikli feature'ı EZMEZ (featureClaimed).
  const SLOT_PRIORITY = { lead: 0, col1: 1, col3: 2, magazine_lead: 3 };
  const ordered = approved.slice().sort((a, b) =>
    (SLOT_PRIORITY[a.slot] ?? 9) - (SLOT_PRIORITY[b.slot] ?? 9) ||
    (b.reviewed_at || '').localeCompare(a.reviewed_at || ''));

  const seen = new Set();
  const communitySlots = [];
  let injected = 0, skipped = 0;
  let featureClaimed = false; // ön sayfa feature bloğu (feature_title/feature_body) bir kez yazılır

  for (const s of ordered) {
    const key = `${s.edition}:${s.slot}`;
    if (seen.has(key)) continue;          // aynı slota birden çok onaylı → en yenisi (ilk) kazanır
    const mapper = SLOT_MAPPERS[s.slot];
    if (!mapper) { console.log(`  ⚠ bilinmeyen slot atlandı: ${s.slot}`); continue; }
    seen.add(key);

    const f = s.fields || {};
    // KALİTE/UYUM KAPISI: birleşik metni yönetmelik ihlaline karşı tara (HARD → yayına girmez).
    const combined = [f.headline, f.title, f.deck, f.body, f.caption].filter(Boolean).map(stripTags).join('\n');
    const uyum = scanReklamUyum(combined);
    if (!uyum.ok) {
      skipped++;
      console.warn(`  ⛔ ${key} ATLANDI (reklam yönetmeliği ihlali): ${uyum.hard.join(' | ')}`);
      continue;
    }
    if (uyum.soft.length) console.log(`  ⚠ ${key} yumuşak uyarı: ${uyum.soft.join(' | ')}`);

    const patch = mapper(f);
    // Ön sayfa feature bloğu tek: daha yüksek öncelikli slot zaten yazdıysa, bu slotun
    // feature alanlarını düşür (manşetin/köşenin gövdesi çakışmasın).
    if ('feature_title' in patch || 'feature_body' in patch) {
      if (featureClaimed) { delete patch.feature_title; delete patch.feature_body; }
      else if (String(patch.feature_body || '').trim()) featureClaimed = true;
    }
    // Boş içerik guard (mapper her şeyi düşürdüyse atla)
    const hasContent = Object.values(patch).some(v => (Array.isArray(v) ? v.length : String(v || '').trim()));
    if (!hasContent) { console.warn(`  ⚠ ${key} görünür içerik kalmadı — atlandı.`); continue; }

    Object.assign(out, patch);
    communitySlots.push({ edition: s.edition, slot: s.slot, submission_id: s.id, contributor: s.user_email || null });
    injected++;
    console.log(`  ✓ ${key} enjekte edildi ("${stripTags(f.headline || f.title || '').slice(0, 48)}")`);
  }

  if (!injected) {
    console.log('  ℹ Enjekte edilecek geçerli topluluk içeriği kalmadı (uyum/boşluk filtreleri).');
    return;
  }

  // Şeffaflık/denetim izi
  out.community_slots = communitySlots;
  out.community_merged_at = new Date().toISOString();
  if (!out.generated_at) out.generated_at = out.community_merged_at;
  if (!out.provider) out.provider = 'community';

  await mkdir(join(ROOT, 'data'), { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`✓ ${injected} topluluk slotu gazeteye işlendi${skipped ? ` (${skipped} uyum ihlali atlandı)` : ''} → data/gazete-today.json`);
}

main().catch(e => { console.error('[gazete-community-merge]', e); process.exit(0); }); // non-fatal: build devam etsin
