#!/usr/bin/env node
/**
 * ig-weekly-report.mjs — Haftalık geri bildirim döngüsü (Fix D)
 *
 * AMAÇ: Kalite motorunu gerçek performansa bağlamak. İçerik yayınlandıktan
 * sonra hangi içeriğin tuttuğunu (reach/kaydetme/paylaşım/yorum) haftalık
 * olarak ölçer; en iyi 5 / en zayıf 5 içeriği çıkarır; kısa bir içgörü üretir
 * ve kalite rubriğinin ağırlıklarını ÇOK KÜÇÜK (±0.1) oynatarak sistemin
 * öğrenmesini sağlar.
 *
 * ÖNEMLİ: Bu bir SuperComputer cron işidir — Vercel DEĞİL. Vercel Hobby
 * kotası (12/12 api, 2/2 cron) dolu; buraya YENİ api/cron EKLENMEZ. Bu script
 * SuperComputer üzerinde haftalık (örn. Pazartesi 06:00) crontab ile çalışır.
 *
 * VERİ KAYNAĞI: Gerçek IG Graph API henüz bağlı değil. Bu yüzden metrikler
 * elle güncellenen `data/agency/ig-metrics-manual.json` dosyasından okunur.
 * API bağlandığında `pullMetrics()` fonksiyonu gerçek çağrıyla değiştirilir.
 *
 * KULLANIM:
 *   node scripts/agency/ig-weekly-report.mjs            # normal çalıştırma
 *   node scripts/agency/ig-weekly-report.mjs --kuru     # rubriğe dokunmadan dene
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (rel) => path.join(ROOT, rel);

const REPORT_PATH = 'data/agency/ig-report.json';
const METRICS_PATH = 'data/agency/ig-metrics-manual.json';
const RUBRIC_PATH = 'data/agency/quality-rubric.json';
const PERF_MD = 'data/agency/knowledge/content-performance.md';

// ── Yardımcılar ──────────────────────────────────────────────────────────
async function readJson(rel, fallback) {
  try {
    return JSON.parse(await fs.readFile(P(rel), 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(rel, obj) {
  const abs = P(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Etkileşim skoru: kaydetme ve paylaşım, beğeniden daha değerli (algoritma sinyali).
function engagementScore(m) {
  const reach = Number(m.reach || 0);
  const saves = Number(m.kaydetme ?? m.saves ?? 0);
  const shares = Number(m.paylasim ?? m.shares ?? 0);
  const comments = Number(m.yorum ?? m.comments ?? 0);
  const likes = Number(m.begeni ?? m.likes ?? 0);
  // Ağırlıklı toplam: kaydetme x3, paylaşım x3, yorum x2, beğeni x1
  const raw = saves * 3 + shares * 3 + comments * 2 + likes * 1;
  // Reach'e göre normalize et (küçük hesapta adil karşılaştırma)
  return reach > 0 ? +(raw / reach * 1000).toFixed(2) : raw;
}

/**
 * pullMetrics — Son 7 günün metriklerini getirir.
 * Şimdilik elle tutulan dosyadan okur. IG Graph API bağlanınca burası değişir.
 * Beklenen şekil: { son_guncelleme, profil:{takipci,...}, icerikler:[{id,tur,baslik,reach,kaydetme,paylasim,yorum,begeni,tarih}] }
 */
async function pullMetrics() {
  const manual = await readJson(METRICS_PATH, null);
  if (!manual || !Array.isArray(manual.icerikler)) {
    console.log('⚠️  Elle girilen metrik dosyası yok/boş (%s). Rapor "veri yok" ile üretilecek.', METRICS_PATH);
    return { profil: {}, icerikler: [] };
  }
  console.log('📥 %d içerik metriği okundu (%s).', manual.icerikler.length, METRICS_PATH);
  return manual;
}

/**
 * microAdjustRubric — Performans içgörüsüne göre ağırlıkları ÇOK KÜÇÜK oynatır.
 * Kural: tek seferde en fazla ±0.1; ağırlık [0.5, 2.0] aralığında tutulur.
 * ABARTMA YOK — sistem yavaş öğrensin, ani savrulma olmasın.
 *
 * Basit sezgi:
 *  - En iyi içeriklerde ortak kriter neyse onu +0.1 (o özellik işe yarıyor).
 *  - En zayıflarda tekrar eden zayıflık varsa ilgili kriter +0.1 (daha sıkı bak).
 * Etik ve doğruluk ağırlıkları ASLA düşürülmez (kırmızı çizgi).
 */
function microAdjustRubric(rubric, top, low) {
  const adjustments = {};
  if (!rubric?.criteria?.length) return { rubric, adjustments };
  if (!top.length && !low.length) return { rubric, adjustments };

  const byId = Object.fromEntries(rubric.criteria.map((c) => [c.id, c]));
  const STEP = 0.1;
  const MIN = 0.5;
  const MAX = 2.0;
  const KORUNAN = new Set(['dogruluk', 'etik']); // asla düşürülmez

  const bump = (id, delta, sebep) => {
    const c = byId[id];
    if (!c) return;
    let w = Number(c.weight) + delta;
    if (KORUNAN.has(id) && delta < 0) return; // kırmızı çizgi korunur
    w = Math.max(MIN, Math.min(MAX, +w.toFixed(2)));
    if (w !== c.weight) {
      adjustments[id] = { onceki: c.weight, yeni: w, sebep };
      c.weight = w;
    }
  };

  // En iyi içerikler paylaşılabilirlik sinyali güçlüyse (paylaşım/kaydetme yüksek),
  // paylaşılabilirlik kriterini biraz daha önemse.
  const topShareHeavy = top.filter((t) => (t._score || 0) > 0).length >= Math.max(1, Math.ceil(top.length / 2));
  if (topShareHeavy) bump('paylasilabilirlik', +STEP, 'en iyi içerikler yüksek paylaşım/kaydetme sinyali verdi');

  // En zayıf içerikler çoğunlukla düşük etkileşimliyse, fayda kriterini biraz artır
  // (okur somut fayda görmezse tutmuyor demektir).
  if (low.length) bump('fayda', +STEP, 'zayıf içeriklerde somut fayda eksikliği gözlendi');

  return { rubric, adjustments };
}

// ── Ana akış ─────────────────────────────────────────────────────────────
async function main() {
  const kuru = process.argv.includes('--kuru'); // rubriğe dokunma modu
  console.log('🗓️  Haftalık IG geri bildirim raporu başlıyor…');

  const metrics = await pullMetrics();
  const items = (metrics.icerikler || []).map((m) => ({ ...m, _score: engagementScore(m) }));

  // En iyi 5 / en zayıf 5 (skora göre)
  const sorted = [...items].sort((a, b) => b._score - a._score);
  const topContent = sorted.slice(0, 5);
  const lowContent = sorted.slice(-5).reverse();

  // Kısa, dürüst içgörü (abartısız)
  let insights;
  if (!items.length) {
    insights = 'Henüz metrik verisi yok. ig-metrics-manual.json doldurulunca rapor anlamlı olur.';
  } else {
    const enIyi = topContent[0];
    const enZayif = lowContent[0];
    insights =
      `Bu hafta ${items.length} içerik ölçüldü. ` +
      (enIyi ? `En çok tutan: "${String(enIyi.baslik || enIyi.id || '').slice(0, 60)}" (skor ${enIyi._score}). ` : '') +
      (enZayif ? `En zayıf: "${String(enZayif.baslik || enZayif.id || '').slice(0, 60)}" (skor ${enZayif._score}). ` : '') +
      'Öneri: iyi tutan formatı tekrarla, zayıf olanın açısını gözden geçir.';
  }

  // Rubrik mikro-ayarı (±0.1)
  let rubricAdjustments = {};
  if (!kuru) {
    const rubric = await readJson(RUBRIC_PATH, null);
    if (rubric) {
      const { rubric: yeni, adjustments } = microAdjustRubric(rubric, topContent, lowContent);
      rubricAdjustments = adjustments;
      if (Object.keys(adjustments).length) {
        yeni.updatedAt = new Date().toISOString();
        await writeJson(RUBRIC_PATH, yeni);
        console.log('🎚️  Rubrik ağırlıkları güncellendi:', JSON.stringify(adjustments));
      } else {
        console.log('🎚️  Rubrikte anlamlı değişiklik gerekmedi.');
      }
    }
  } else {
    console.log('🧪 Kuru mod — rubriğe dokunulmadı.');
  }

  const now = new Date().toISOString();

  // ig-report.json: hem yeni şema (task) hem geriye-uyumlu alanlar (morning-briefing).
  const report = {
    generatedAt: now,
    period: 'son 7 gün',
    topContent,
    lowContent,
    insights,
    rubricAdjustments,
    // ── Geriye uyumluluk: morning-briefing agentDataFeed() bu alanları okur ──
    profil: metrics.profil || {},
    son_30_gun: metrics.son_30_gun || undefined,
    en_iyi: topContent[0] ? { baslik: topContent[0].baslik, caption: topContent[0].baslik } : undefined,
    en_zayif: lowContent[0] ? { baslik: lowContent[0].baslik, caption: lowContent[0].baslik } : undefined,
  };
  await writeJson(REPORT_PATH, report);
  console.log('📝 Rapor yazıldı: %s', REPORT_PATH);

  // Bilgi tabanına ekle (append) — ajanların hafızası
  const md =
    `\n## Haftalık Performans — ${now.slice(0, 10)}\n` +
    `- Ölçülen içerik: ${items.length}\n` +
    (topContent.length ? `- En iyi: ${topContent.map((t) => `"${String(t.baslik || t.id).slice(0, 40)}" (${t._score})`).join(', ')}\n` : '') +
    (lowContent.length ? `- En zayıf: ${lowContent.map((t) => `"${String(t.baslik || t.id).slice(0, 40)}" (${t._score})`).join(', ')}\n` : '') +
    `- İçgörü: ${insights}\n` +
    (Object.keys(rubricAdjustments).length ? `- Rubrik ayarı: ${JSON.stringify(rubricAdjustments)}\n` : '- Rubrik ayarı: yok\n');
  try {
    await fs.mkdir(path.dirname(P(PERF_MD)), { recursive: true });
    await fs.appendFile(P(PERF_MD), md, 'utf8');
    console.log('📚 Bilgi tabanına eklendi: %s', PERF_MD);
  } catch (e) {
    console.log('⚠️  Bilgi tabanına yazılamadı (atlanıyor):', e.message);
  }

  console.log('✅ Haftalık rapor tamam.');
  return report;
}

// Doğrudan çalıştırıldığında main(); import edildiğinde fonksiyonlar kullanılabilir.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('❌ Haftalık rapor hatası:', e.message);
    process.exit(1);
  });
}

export { engagementScore, microAdjustRubric, pullMetrics, main };
