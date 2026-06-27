// lib/ads-optimizer.js
// Meta/TikTok/Google Ads ROAS analizi — haftalık digest üretir.
// Env vars (opsiyonel):
//   META_ACCESS_TOKEN     — Meta Ads Manager API
//   META_AD_ACCOUNT_ID    — act_XXXXXXXXX formatında
//   TIKTOK_TOKEN          — TikTok Business API
//   TIKTOK_ADVERTISER_ID  — TikTok advertiser ID
//   GOOGLE_ADS_TOKEN      — Google Ads API (ileride)
//   ANTHROPIC_API_KEY     — zorunlu, analiz için

import { ask } from './anthropic.js';

const META_TOKEN      = process.env.META_ACCESS_TOKEN;
const META_ACCOUNT    = process.env.META_AD_ACCOUNT_ID;   // act_xxx
const TIKTOK_TOKEN    = process.env.TIKTOK_TOKEN;
const TIKTOK_ADV_ID   = process.env.TIKTOK_ADVERTISER_ID;
const GOOGLE_TOKEN    = process.env.GOOGLE_ADS_TOKEN;

function weekLabel() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Meta Ads ────────────────────────────────────────────────────────────────

async function fetchMetaAds({ window: win = '7d' } = {}) {
  if (!META_TOKEN || !META_ACCOUNT) return null;
  try {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const fields = 'spend,impressions,clicks,actions,action_values';
    const url = `https://graph.facebook.com/v21.0/${META_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&level=account&access_token=${META_TOKEN}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const json = await r.json();
    const d = json.data?.[0];
    if (!d) return null;
    const spend = parseFloat(d.spend || 0);
    const purchaseAction = (d.actions || []).find(a => a.action_type === 'purchase');
    const purchaseValue  = (d.action_values || []).find(a => a.action_type === 'purchase');
    const conversions = purchaseAction ? parseInt(purchaseAction.value || 0, 10) : 0;
    const revenue     = purchaseValue  ? parseFloat(purchaseValue.value  || 0)  : 0;
    const roas = spend > 0 ? (revenue / spend) : 0;
    return { spend, conversions, revenue, roas, impressions: parseInt(d.impressions || 0, 10), clicks: parseInt(d.clicks || 0, 10) };
  } catch { return null; }
}

// ── TikTok Ads ───────────────────────────────────────────────────────────────

async function fetchTikTokAds({ window: win = '7d' } = {}) {
  if (!TIKTOK_TOKEN || !TIKTOK_ADV_ID) return null;
  try {
    const start = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const end   = new Date().toISOString().slice(0, 10);
    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${TIKTOK_ADV_ID}&report_type=BASIC&data_level=AUCTION_ADVERTISER&dimensions=["stat_time_day"]&metrics=["spend","impressions","clicks","conversion","total_purchase_value"]&start_date=${start}&end_date=${end}`;
    const r = await fetch(url, { headers: { 'Access-Token': TIKTOK_TOKEN } });
    if (!r.ok) return null;
    const json = await r.json();
    const rows  = json.data?.list || [];
    let spend = 0, conversions = 0, revenue = 0, impressions = 0, clicks = 0;
    for (const row of rows) {
      const m = row.metrics || {};
      spend       += parseFloat(m.spend                || 0);
      conversions += parseInt(m.conversion              || 0, 10);
      revenue     += parseFloat(m.total_purchase_value  || 0);
      impressions += parseInt(m.impressions              || 0, 10);
      clicks      += parseInt(m.clicks                   || 0, 10);
    }
    const roas = spend > 0 ? (revenue / spend) : 0;
    return { spend, conversions, revenue, roas, impressions, clicks };
  } catch { return null; }
}

// ── Google Ads (stub — MCC API gerektirir) ──────────────────────────────────

async function fetchGoogleAds() {
  if (!GOOGLE_TOKEN) return null;
  // Google Ads API MCC entegrasyonu henüz yapılmadı.
  // GOOGLE_ADS_TOKEN varsa burada fetch eklenecek.
  return null;
}

// ── Anthropic analiz ─────────────────────────────────────────────────────────

const SYSTEM = `Sen Kalkan Info'nun reklam optimizasyon analistısın. Türkçe, somut, aksiyon odaklı yaz.

Verilen kanal verisini analiz et. ROAS < 2 ise uyar. En verimli kanalı öne çıkar.
Budget hard limit $500/ay.

SADECE JSON çıktı ver:
{
  "week": "YYYY-WXX",
  "spend_total_usd": 0,
  "roas_overall": 0,
  "by_channel": {
    "meta":   { "spend": 0, "conversions": 0, "roas": 0, "status": "ok|warn|no_data" },
    "tiktok": { "spend": 0, "conversions": 0, "roas": 0, "status": "ok|warn|no_data" },
    "google": { "spend": 0, "conversions": 0, "roas": 0, "status": "ok|warn|no_data" }
  },
  "recommendations": [
    "Somut aksiyon 1",
    "Somut aksiyon 2"
  ],
  "alerts": []
}`;

export async function runAdsOptimizer({ window: win = '7d' } = {}) {
  const [meta, tiktok, google] = await Promise.all([
    fetchMetaAds({ window: win }),
    fetchTikTokAds({ window: win }),
    fetchGoogleAds(),
  ]);

  const hasAnyData = meta || tiktok || google;
  if (!hasAnyData) {
    return {
      summary: 'no data — META_ACCESS_TOKEN, TIKTOK_TOKEN veya GOOGLE_ADS_TOKEN env var yok.',
      recommendations: [],
      cost: 0,
    };
  }

  const ctx = `Hafta: ${weekLabel()}

Meta Ads (son 7g): ${meta ? JSON.stringify(meta) : 'veri yok (META_ACCESS_TOKEN eksik)'}
TikTok Ads (son 7g): ${tiktok ? JSON.stringify(tiktok) : 'veri yok (TIKTOK_TOKEN eksik)'}
Google Ads (son 7g): ${google ? JSON.stringify(google) : 'veri yok (entegrasyon henüz yok)'}

Budget limit: $500/ay. ROAS < 2 olan kampanyaları durdurma öner.
Yukarıdaki veriye göre haftalık ads raporu üret.`;

  const { parsed, cost, usage } = await ask({
    model: 'haiku',
    system: SYSTEM,
    user: ctx,
    max_tokens: 1200,
    json: true,
  });

  const summary = parsed?._parse_error
    ? 'Analiz tamamlandı (parse hatası)'
    : `${weekLabel()} — toplam harcama $${parsed?.spend_total_usd ?? 0}, blended ROAS ${parsed?.roas_overall ?? 0}`;

  return {
    summary,
    week: parsed?.week || weekLabel(),
    by_channel: parsed?.by_channel || {},
    recommendations: parsed?.recommendations || [],
    alerts: parsed?.alerts || [],
    cost,
    usage,
    outputBrief: summary,
  };
}
