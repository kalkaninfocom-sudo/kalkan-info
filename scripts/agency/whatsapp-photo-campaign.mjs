#!/usr/bin/env node
/**
 * scripts/agency/whatsapp-photo-campaign.mjs — KİŞİYE ÖZEL WHATSAPP FOTO-İSTEME KAMPANYASI
 * --------------------------------------------------------------------------------------------
 * AMAÇ: kalkaninfo.com'da listelenen ama görselleri EKSİK/ZAYIF olan işletmelere, neden foto
 * istediğimizi anlatan KİBAR + HİKAYELİ + o işletmeye ÖZGÜ birer WhatsApp mesajı üretir.
 * Mesaj "Kalkan Info AjansAI"den geldiği belli olur; web sitesi yoksa "önerilen işletmeler"
 * bölümünde öne çıkarma değeri de sunulur.
 *
 * HEDEF: foto yok (image boş/placeholder + gallery'de gerçek foto yok) VEYA zayıf (yalnız 1
 *        gerçek görsel) İŞLETMELER — ve telefonu/WhatsApp'ı olanlar (>=10 hane).
 *
 * MESAJ MOTORU: lib/cheap-llm.mjs (ücretsiz router). Sıra: groq → cerebras → nvidia → gemini
 *        → claude (fallback). Kota-güvenli: işletmeler arası ufak gecikme, her hata NON-FATAL
 *        (LLM düşerse o işletme için kişiselleştirilmiş şablon mesaj kullanılır → dosya yine dolu).
 *
 * DÜRÜSTLÜK: LLM'e "uydurma vaat/rakam YOK, abartma YOK, satış baskısı YOK" talimatı verilir.
 * GÜVENLİK: müşteri telefon numaraları LOG'a BASILMAZ (yalnız dosyaya yazılır).
 *
 * ÇIKTI: data/whatsapp-photo-campaign.json
 *   { generatedAt, count, items:[{ id, name, type, phone, whatsapp, hasWebsite, message }] }
 *
 * Kullanım:
 *   node scripts/agency/whatsapp-photo-campaign.mjs            # tümü
 *   node scripts/agency/whatsapp-photo-campaign.mjs --limit 3  # smoke test (ilk 3)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const { cheapLLM } = await import('../../lib/cheap-llm.mjs');

const argLimit = (() => {
  const i = process.argv.indexOf('--limit');
  return i > -1 ? parseInt(process.argv[i + 1], 10) || 0 : 0;
})();

// --- yardımcılar ---------------------------------------------------------------
const isBadImg = (s) => !s || /placehold|placeholder|no-image|noimage|default-|unsplash|pexels|via\.placeholder/i.test(String(s));
const okUrl = (u) => /^https?:\/\/.+\..+/i.test(String(u || ''));
const digitsOf = (p) => String(p || '').replace(/\D/g, '');
const hasPhone = (p) => digitsOf(p).length >= 10;
const phoneOf = (it) => [it.phone, it.mobile, it.contact, it.phone_concierge].find(hasPhone) || '';

/** Telefonu +90XXXXXXXXXX WhatsApp formatına normalize et. Türkiye varsayımı. */
function toWhatsapp(raw) {
  let d = digitsOf(raw);
  if (!d) return '';
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length >= 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  // 10 haneli (5XXYYYYYYY) yerel numara → +90 ekle
  if (d.length === 10) return '+90' + d;
  // zaten ülke koduyla makul uzunluktaysa + öne al
  return '+' + d;
}

// --- DİSK TABANLI FOTO TESPİTİ -------------------------------------------------
// DERS (2026-07-08): JSON gallery alanı GÜVENİLMEZ — çoğu işletmenin gerçek fotoğrafı
// diskte (assets/img/**) durur ama JSON gallery'de listelenmez (ör. Street Munch: JSON'da
// 1 hero, diskte ~68 foto). Bu yüzden "fotolu mu" kararı için HEM JSON image/gallery HEM de
// disk taranır. Yalnızca gerçekten HİÇBİR fotosu olmayanlar hedeflenir.
const tr = (s) => String(s || '').toLowerCase()
  .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i').replace(/â/g, 'a');
const normSlug = (s) => tr(s).replace(/[^a-z0-9]/g, '');
const NON_CONTENT = /(logo|menucard|qr|favicon|icon)/i; // menü kartı/logo = mekan fotosu değil
const STOP = new Set(['the', 'and', 'bar', 'cafe', 'kalkan', 'kas', 'restaurant', 'restoran', 'club', 'lounge', 'kitchen', 'cocktail', 'terrace', 'beach', 'hotel', 'otel', 'villa', 'by', 'de', 'la']);

function walkImages(dir) {
  let out = [];
  let entries = [];
  try { entries = require('node:fs').readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkImages(p));
    else if (/\.(jpg|jpeg|webp|png)$/i.test(e.name)) out.push(e.name.replace(/\.(jpg|jpeg|webp|png)$/i, ''));
  }
  return out;
}
const DISK = walkImages(join(ROOT, 'assets', 'img')).map((b) => ({ base: b, n: normSlug(b), content: !NON_CONTENT.test(b) }));

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

/** İşletmenin GERÇEK fotoğrafı var mı? (JSON image/gallery dolu VEYA diskte eşleşen içerik fotosu). */
function hasRealPhotos(it) {
  if (!isBadImg(it.image)) return true;
  if (Array.isArray(it.gallery) && it.gallery.some((x) => !isBadImg(x))) return true;
  for (const s of nameSlugs(it)) {
    if (DISK.some((d) => d.content && d.n.startsWith(s))) return true;
  }
  return false;
}

const loadJson = async (f) => {
  const d = JSON.parse(await readFile(join(ROOT, 'data', f), 'utf8'));
  return Array.isArray(d) ? d : (d.items || []);
};

// --- marka sesi (writer ajanı) --------------------------------------------------
const SYSTEM = `Sen "Kalkan Info AjansAI"nın metin yazarısın. Kalkan'ı tanıtan yerel dijital platform kalkaninfo.com adına yazıyorsun.
Görev: işletme sahibine WhatsApp'tan gönderilecek KİBAR, SICAK, DÜRÜST ve o işletmeye ÖZGÜ bir foto-isteme mesajı yaz.
Marka sesi: samimi ve içten; övgü yağdırma, satış baskısı ve abartı YOK. Gerçekçi ol; uydurma vaat, rakam veya özellik YAZMA.
Uzunluk: WhatsApp için kısa, ~4-7 cümle. Emoji ölçülü (en fazla 1-2).
ÇOK ÖNEMLİ: TEK bir mesaj yaz. Seçenek/alternatif sunma, madde/başlık/markdown (*, **, "Seçenek 1") KULLANMA. Düz metin, tek paragraf.
Mesaj akışı (bunları doğal cümlelere dök, madde madde yazma):
1) Selam + kim olduğumuz: Kalkan Info AjansAI, kalkaninfo.com.
2) Neden yazdık: işletmeyi sitemizde/rehberimizde gördük, sayfası güzel ama görselleri eksik; misafirler bir mekânı önce gözüyle seçer.
3) Ne istiyoruz: birkaç güncel ve kaliteli fotoğraf (mekân, ürün/tabak/oda, atmosfer).
4) Karşılık: ücretsiz olarak sayfalarını güçlendiririz{{WEBSITE_VALUE}}.
5) Kibar bir kapanış.
Yalnız mesaj metnini döndür — başlık, tırnak, imza bloğu veya açıklama EKLEME. Türkçe yaz.`;

function buildUserPrompt(it, type, hasWebsite) {
  const typeLabel = type === 'restoran' ? 'restoran/kafe/bar' : type === 'otel' ? 'otel' : 'kiralık villa';
  const bits = [];
  bits.push(`İşletme adı: ${it.name}`);
  bits.push(`Tür: ${typeLabel}`);
  if (it.cuisine) bits.push(`Mutfak: ${it.cuisine}`);
  if (it.location) bits.push(`Konum: ${it.location}`);
  if (Array.isArray(it.specialties) && it.specialties.length) bits.push(`Öne çıkanlar: ${it.specialties.slice(0, 3).join(', ')}`);
  if (Array.isArray(it.tags) && it.tags.length) bits.push(`Özellikler: ${it.tags.slice(0, 3).join(', ')}`);
  if (it.summary) bits.push(`Kısa tanım: ${String(it.summary).slice(0, 220)}`);
  bits.push(hasWebsite
    ? 'Web sitesi: VAR (kalkaninfo.com sayfasını güçlendirmeye odaklan).'
    : 'Web sitesi: YOK (bu yüzden ayrıca kalkaninfo.com üzerindeki "önerilen işletmeler" bölümünde öne çıkarabileceğimizi belirt).');
  return `Aşağıdaki işletme için mesajı yaz. Sadece verilen bilgiyi kullan, yeni olgu uydurma:\n\n${bits.join('\n')}`;
}

/** LLM başarısız olursa kişiselleştirilmiş güvenli şablon. */
function fallbackMessage(it, type, hasWebsite) {
  const typeLabel = type === 'restoran' ? 'mekânınızı' : type === 'otel' ? 'otelinizi' : 'villanızı';
  const extra = hasWebsite
    ? 'Göndereceğiniz birkaç güncel fotoğrafla sayfanızı ücretsiz olarak güçlendirebiliriz.'
    : 'Web siteniz olmadığı için göndereceğiniz birkaç güncel fotoğrafla hem sayfanızı güçlendirir hem de sizi "önerilen işletmeler" bölümünde öne çıkarabiliriz.';
  return `Merhaba, ben Kalkan Info AjansAI'den yazıyorum — Kalkan'ı tanıtan yerel platform kalkaninfo.com. ${it.name} sayfanızı sitemizde hazırladık, ancak güncel görselleriniz eksik kaldı. Misafirler bir yeri çoğu zaman önce gözüyle seçtiği için ${typeLabel} en iyi şekilde yansıtan birkaç kaliteli fotoğrafa (mekân, atmosfer, detaylar) ihtiyacımız var. ${extra} Uygun olduğunuzda birkaç fotoğraf paylaşırsanız çok seviniriz. Kolay gelsin! 🙏`;
}

/** LLM çıktısındaki markdown/başlık/seçenek artefaktlarını temizle. */
function cleanMessage(raw) {
  let t = String(raw || '').trim();
  // "Seçenek 1 ...:" gibi bir alternatif listesi döndüyse ilk tırnaklı bloğu al
  const quoted = t.match(/"([^"]{60,})"/);
  if (/seçenek|alternatif|option/i.test(t) && quoted) t = quoted[1];
  t = t
    .replace(/\*\*/g, '')                 // bold
    .replace(/^#+\s*/gm, '')              // başlık
    .replace(/^\s*[-*]\s+/gm, '')         // liste madde
    .replace(/^\s*(Seçenek|Option|Alternatif)\s*\d+.*$/gim, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')    // baş/son tırnak-boşluk
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- ana akış -------------------------------------------------------------------
async function main() {
  const sources = [
    ['restoranlar.json', 'restoran'],
    ['oteller.json', 'otel'],
    ['villalar.json', 'villa'],
  ];

  const targets = [];
  for (const [file, type] of sources) {
    const items = await loadJson(file).catch(() => []);
    for (const it of items) {
      const phoneRaw = phoneOf(it);
      if (!hasPhone(phoneRaw)) continue;          // WhatsApp yoksa hedefleme
      if (hasRealPhotos(it)) continue;            // JSON image/gallery dolu VEYA diskte fotosu var → yeterli, ATLA
      const hasWebsite = okUrl(it.website) || okUrl(it.customSiteUrl) || okUrl(it.referenceUrl);
      targets.push({ it, type, phoneRaw, hasWebsite });
    }
  }

  const list = argLimit > 0 ? targets.slice(0, argLimit) : targets;
  const byType = targets.reduce((a, t) => ((a[t.type] = (a[t.type] || 0) + 1), a), {});
  console.log(`Hedef işletme: ${targets.length} (GERÇEK fotosuz + telefonlu) — ${Object.entries(byType).map(([k, v]) => `${k}:${v}`).join(', ')}${argLimit ? ` · smoke: ${list.length}` : ''}`);

  const outPath = join(ROOT, 'data', 'whatsapp-photo-campaign.json');
  // Var olan mesajları yeniden kullan (token/kota tasarrufu): aynı id + LLM mesajı varsa üretme.
  const prevById = new Map();
  if (!process.argv.includes('--fresh')) {
    try {
      const prev = JSON.parse(require('node:fs').readFileSync(outPath, 'utf8'));
      for (const p of (prev.items || [])) if (p.id && p.message && p.message.length > 60) prevById.set(p.id, p);
    } catch {}
  }

  const out = [];
  let llmOk = 0, fell = 0, reused = 0;
  const providerCount = {};
  const save = () => writeFile(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(), count: out.length, items: out,
  }, null, 2), 'utf8');
  for (let i = 0; i < list.length; i++) {
    const { it, type, phoneRaw, hasWebsite } = list[i];
    // Zaten üretilmiş kaliteli mesaj varsa yeniden kullan (yeni LLM çağrısı yapma)
    const prev = prevById.get(it.id);
    if (prev && !prev.message.startsWith("Merhaba, ben Kalkan Info AjansAI'den yazıyorum")) {
      out.push({ id: it.id, name: it.name, type, phone: phoneRaw, whatsapp: toWhatsapp(phoneRaw), hasWebsite, message: prev.message });
      reused++;
      if ((i + 1) % 20 === 0) { console.log(`  … ${i + 1}/${list.length} (yeniden kullanılan: ${reused})`); await save(); }
      continue;
    }
    const sys = SYSTEM.replace('{{WEBSITE_VALUE}}', hasWebsite
      ? ''
      : ' ve web siteniz olmadığı için kalkaninfo.com\'daki "önerilen işletmeler" bölümünde öne çıkarabiliriz');
    let message, provider = 'fallback';
    try {
      const r = await cheapLLM(buildUserPrompt(it, type, hasWebsite), {
        system: sys,
        temperature: 0.7,
        maxTokens: 420,
        // Kalite: cerebras (gemma) temiz Türkçe verir; groq kod-değiştirme yapabildiği için
        // ikinci sırada. nvidia/gemini/claude fallback.
        order: ['cerebras', 'groq', 'nvidia', 'gemini', 'claude'],
        timeoutMs: 12000, // kota-limitli sağlayıcı hızlı düşsün, sıradakine geçsin
      });
      // markdown/başlık/seçenek artefaktlarını temizle, ilk mesaj bloğunu al
      message = cleanMessage(r.text);
      provider = r.provider;
      llmOk++;
      providerCount[provider] = (providerCount[provider] || 0) + 1;
    } catch (e) {
      message = fallbackMessage(it, type, hasWebsite);
      fell++;
      // numara loglanmaz; sadece isim + hata
      console.error(`  ! LLM düştü (${it.name}): ${e.message.slice(0, 80)} → şablon kullanıldı`);
    }
    out.push({
      id: it.id,
      name: it.name,
      type,
      phone: phoneRaw,
      whatsapp: toWhatsapp(phoneRaw),
      hasWebsite,
      message,
    });
    // ilerleme (numara YOK) + periyodik kısmi kayıt (çökerse ilerleme kaybolmasın)
    if ((i + 1) % 20 === 0) { console.log(`  … ${i + 1}/${list.length} üretildi`); await save(); }
    await sleep(2200); // cerebras ~30/dk ücretsiz limitinin ALTINDA kal → tüm mesajlar tutarlı kaliteli Türkçe (groq'a düşmesin)
  }

  await save();

  console.log(`\n✓ ${out.length} mesaj yazıldı → data/whatsapp-photo-campaign.json`);
  console.log(`  yeni LLM: ${llmOk} · yeniden kullanılan: ${reused} · şablon fallback: ${fell} · sağlayıcılar: ${Object.entries(providerCount).map(([k, v]) => `${k}:${v}`).join(', ') || '-'}`);

  // 2 örnek (numara maskeli)
  const mask = (w) => (w ? w.slice(0, 3) + '***' + w.slice(-2) : '');
  for (const ex of out.slice(0, 2)) {
    console.log(`\n— Örnek [${ex.type}] ${ex.name} (${mask(ex.whatsapp)}, web:${ex.hasWebsite ? 'var' : 'yok'}):`);
    console.log(ex.message);
  }
}

main().catch((e) => { console.error('HATA:', e); process.exit(1); });
