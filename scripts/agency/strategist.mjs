#!/usr/bin/env node
/**
 * scripts/agency/strategist.mjs — 2. BEYİN: STRATEJİST (Katman 3)
 * ---------------------------------------------------------------------------
 * Döngünün "öğren + uyarla" adımı. Hafızadaki ölçümleri okur, DETERMİNİSTİK
 * korelasyon çıkarır (içerik-türü × dil × yayın-saati → reach/saved), sonra
 * cheapLLM ile yarının somut içerik planını yazar. Çıktı: data/agency/strategy.json
 * + hafızaya 'insight' (agregatlar) ve 'plan' (yarın) kaydı.
 *
 * TASARIM İLKESİ: MATEMATİK LLM'E BIRAKILMAZ. Ortalama/sıralama koddadır (güvenilir);
 * LLM sadece agregat tabloyu okuyup insanca strateji + plan cümlesine çevirir.
 *
 * Kullanım: node scripts/agency/strategist.mjs [--days=21] [--dry-run]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recall, record, stats } from '../../lib/brain-memory.mjs';
import { cheapJSON } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DRY = process.argv.includes('--dry-run');
const DAYS = Number((process.argv.find(a => a.startsWith('--days=')) || '').split('=')[1]) || 21;

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/** Yayın saatini kabaya bölerek okunur kova (sabah/öğle/akşam/gece). */
function hourBucket(h) {
  if (h == null) return 'bilinmiyor';
  if (h >= 6 && h < 11) return 'sabah';
  if (h >= 11 && h < 16) return 'öğle';
  if (h >= 16 && h < 21) return 'akşam';
  return 'gece';
}

/** Ölçümleri boyutlara göre grupla ve performans (reach>saved>likes) ortalamalarını çıkar. */
function correlate(outcomes) {
  const groups = new Map(); // key -> {dims, reach[], saved[], likes[], n}
  const bump = (dims) => {
    const key = JSON.stringify(dims);
    if (!groups.has(key)) groups.set(key, { dims, reach: [], saved: [], likes: [], n: 0 });
    return groups.get(key);
  };
  for (const o of outcomes) {
    const d = o.data || {};
    for (const dims of [
      { by: 'tür', value: d.media_product_type || 'post' },
      { by: 'dil', value: d.lang || 'bilinmiyor' },
      { by: 'saat', value: hourBucket(d.published_hour_utc) },
    ]) {
      const g = bump(dims);
      g.n++;
      if (num(d.reach) != null) g.reach.push(d.reach);
      if (num(d.saved) != null) g.saved.push(d.saved);
      if (num(d.likes) != null) g.likes.push(d.likes);
    }
  }
  const rows = [...groups.values()].map(g => ({
    ...g.dims, n: g.n,
    avg_reach: avg(g.reach), avg_saved: avg(g.saved), avg_likes: avg(g.likes),
  }));
  // Öncelik: reach varsa reach, yoksa saved, yoksa likes ile sırala
  const sortKey = (r) => r.avg_reach ?? r.avg_saved ?? r.avg_likes ?? -1;
  rows.sort((a, b) => sortKey(b) - sortKey(a));
  return rows;
}

async function main() {
  const outcomes = await recall({ kind: 'outcome', since: new Date(Date.now() - DAYS * 864e5) });
  const corr = correlate(outcomes);
  const memStats = stats();

  console.log(`[strateji] ${outcomes.length} ölçüm (son ${DAYS} gün) · hafıza toplam: ${memStats.total}`);

  // SOĞUK BAŞLANGIÇ: yeterli veri yoksa LLM'e uydurtma — dürüst "veri topla" planı ver.
  const COLD = outcomes.length < 5;
  let plan;
  if (COLD) {
    plan = {
      mode: 'cold-start',
      note: `Yeterli engagement verisi yok (${outcomes.length} ölçüm). Önce yayınla + ölç; korelasyon 5+ ölçümden sonra güvenilir.`,
      recommendations: [
        'Farklı dil (TR/EN/RU) × format (reel/foto) × saat kombinasyonlarını dene — keşif fazı.',
        'engagement-harvest her gün çalışsın ki hafıza dolsun.',
      ],
      tomorrow: [],
    };
    console.log('[strateji] SOĞUK BAŞLANGIÇ — veri az, keşif planı.');
  } else {
    // LLM sadece agregat tabloyu insanca stratejiye çevirir (matematik yukarıda bitti).
    const top = corr.slice(0, 12);
    const sys = 'Sen Kalkan İnfo içerik stratejistisin. SADECE verilen agregat performans tablosuna dayan — ' +
      'uydurma. Kısa, uygulanabilir Türkçe strateji üret. Çıktı JSON.';
    const prompt =
      `Kalkan (Antalya) turizm/tanıtım Instagram hesabı için son ${DAYS} günün ölçülmüş performansı (ortalama):\n` +
      JSON.stringify(top, null, 2) +
      `\n\nBu verilere göre YARIN için plan çıkar. JSON şeması:\n` +
      `{"insights":["<veriden çıkan 2-4 net gözlem>"],` +
      `"tomorrow":[{"topic":"<Kalkan konusu>","format":"reel|foto","lang":"tr|en|ru|de|fr","hour_bucket":"sabah|öğle|akşam|gece","why":"<hangi veriye dayanıyor>"}]}` +
      `\nEn fazla 4 tomorrow öğesi. Sadece verinin desteklediği kombinasyonları öner.`;
    try {
      const { data, provider } = await cheapJSON(prompt, { system: sys });
      plan = { mode: 'data-driven', provider, insights: data.insights || [], tomorrow: (data.tomorrow || []).slice(0, 4) };
      console.log(`[strateji] plan üretildi (${provider}) · ${plan.tomorrow.length} yarın-öğesi`);
    } catch (e) {
      // LLM düşerse deterministik fallback: en iyi kovaları düz öner (yine de çalışır)
      const best = corr.filter(r => r.by === 'dil' || r.by === 'saat' || r.by === 'tür').slice(0, 4);
      plan = { mode: 'deterministic-fallback', error: e.message, insights: best.map(b => `${b.by}=${b.value}: reach≈${Math.round(b.avg_reach || 0)}`), tomorrow: [] };
      console.log('[strateji] LLM düştü → deterministik fallback:', e.message?.slice(0, 80));
    }
  }

  const strategy = {
    generated_at: new Date().toISOString(),
    window_days: DAYS,
    data_points: outcomes.length,
    correlations: corr,     // deterministik agregatlar (güvenilir)
    plan,                   // insan/LLM sentezi
  };

  if (!DRY) {
    mkdirSync(join(ROOT, 'data', 'agency'), { recursive: true });
    writeFileSync(join(ROOT, 'data', 'agency', 'strategy.json'), JSON.stringify(strategy, null, 2));
    await record('insight', { window_days: DAYS, data_points: outcomes.length, top: corr.slice(0, 6) }, ['strateji']);
    await record('plan', plan, ['strateji']);
    console.log('[strateji] yazıldı → data/agency/strategy.json + hafıza(insight,plan)');
  } else {
    console.log(JSON.stringify(strategy, null, 2).slice(0, 1200));
    console.log('… (dry-run — yazılmadı)');
  }
}

main().catch(e => { console.error('[strateji] ölümcül:', e.message); process.exit(1); });
