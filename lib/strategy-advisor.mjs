/**
 * lib/strategy-advisor.mjs — 2. BEYİN: STRATEJİ UYGULAYICI (Katman 4 girdisi)
 * ---------------------------------------------------------------------------
 * Döngünün "UYGULA" adımı. strategist.mjs `strategy.json` yazıyordu ama HİÇBİR
 * ŞEY okumuyordu = döngünün açık ucu. Bu modül o ucu kapatır: öğrenilen
 * korelasyonları (DETERMİNİSTİK) somut üretim önerisine çevirir.
 *
 * getAdvice() → {
 *   dataPoints, mode: 'data-driven'|'cold-start',
 *   topLang, topFormat, topHourBucket,   // en iyi performans gösteren boyutlar
 *   langRank[], formatRank[],            // sıralı (avg reach/saved)
 *   avoid[],                             // belirgin düşük-performans (öneri: azalt)
 *   tomorrow[],                          // strategist'in LLM plan öğeleri (varsa)
 * }
 *
 * Kaynak: data/agency/strategy.json (correlations = deterministik agregatlar).
 * Veri yoksa cold-start: keşif için dengeli dil rotasyonu önerir.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRAT = join(ROOT, 'data', 'agency', 'strategy.json');

const DEFAULT_LANGS = ['tr', 'en', 'ru', 'de', 'fr'];

function loadStrategy() {
  if (!existsSync(STRAT)) return null;
  try { return JSON.parse(readFileSync(STRAT, 'utf8')); } catch { return null; }
}

/** correlations'tan bir boyutu (dil/tür/saat) performansa göre sıralı çıkar. */
function rankBy(correlations, by) {
  const rows = (correlations || []).filter(r => r.by === by);
  const score = (r) => r.avg_reach ?? r.avg_saved ?? r.avg_likes ?? -1;
  return rows
    .map(r => ({ value: r.value, n: r.n, score: score(r), avg_reach: r.avg_reach, avg_saved: r.avg_saved }))
    .filter(r => r.value && r.value !== 'bilinmiyor')
    .sort((a, b) => b.score - a.score);
}

export function getAdvice() {
  const s = loadStrategy();
  const dataPoints = s?.data_points || 0;
  const cold = !s || dataPoints < 5;

  if (cold) {
    return {
      dataPoints, mode: 'cold-start',
      topLang: 'tr', topFormat: 'reel', topHourBucket: 'sabah',
      langRank: DEFAULT_LANGS.map(v => ({ value: v, n: 0, score: -1 })),
      formatRank: [{ value: 'reel', n: 0, score: -1 }, { value: 'foto', n: 0, score: -1 }],
      avoid: [],
      tomorrow: s?.plan?.tomorrow || [],
      note: `Az veri (${dataPoints} ölçüm) — keşif modu: dilleri/formatları dengeli dene.`,
    };
  }

  const corr = s.correlations || [];
  const langRank = rankBy(corr, 'dil');
  const formatRank = rankBy(corr, 'tür').map(r => ({ ...r, value: normFormat(r.value) }));
  const hourRank = rankBy(corr, 'saat');

  // Belirgin düşük-performans: en iyinin %40'ından düşük ortalama reach + yeterli örnek (n>=2)
  const best = langRank[0]?.score ?? 0;
  const avoid = langRank.filter(r => r.n >= 2 && r.score > 0 && r.score < best * 0.4).map(r => `dil:${r.value}`);

  return {
    dataPoints, mode: 'data-driven',
    topLang: langRank[0]?.value || 'tr',
    topFormat: formatRank[0]?.value || 'reel',
    topHourBucket: hourRank[0]?.value || 'sabah',
    langRank, formatRank, avoid,
    tomorrow: s?.plan?.tomorrow || [],
  };
}

/** IG media_product_type → insan format etiketi. */
function normFormat(v) {
  const t = String(v || '').toUpperCase();
  if (t.includes('REEL') || t.includes('VIDEO') || t.includes('CLIPS')) return 'reel';
  if (t.includes('CAROUSEL') || t.includes('FEED') || t.includes('IMAGE')) return 'foto';
  return 'reel';
}

// CLI: node lib/strategy-advisor.mjs
if (process.argv[1]?.endsWith('strategy-advisor.mjs')) {
  console.log(JSON.stringify(getAdvice(), null, 2));
}
