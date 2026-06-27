// lib/social-analyst.js
// Plausible + IG Insights + Microsoft Clarity + Supabase bookings verisini sentezler.
// Haftalık digest üretir — Berkay 5 dakikada okur.
// Env vars (opsiyonel):
//   PLAUSIBLE_API_KEY   — Plausible Stats API
//   PLAUSIBLE_SITE_ID   — default: kalkaninfo.com
//   META_PAGE_TOKEN     — Instagram Graph API (IG Insights)
//   META_IG_ACCOUNT_ID  — IG business account ID
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — booking funnel

import { ask } from './anthropic.js';

const PLAUSIBLE_KEY  = process.env.PLAUSIBLE_API_KEY;
const PLAUSIBLE_SITE = process.env.PLAUSIBLE_SITE_ID || 'kalkaninfo.com';
const META_PAGE_TOKEN  = process.env.META_PAGE_TOKEN;
const META_IG_ACCOUNT  = process.env.META_IG_ACCOUNT_ID;
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function weekLabel() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Plausible ────────────────────────────────────────────────────────────────

async function fetchPlausible() {
  if (!PLAUSIBLE_KEY) return { available: false, note: 'PLAUSIBLE_API_KEY eksik' };
  async function p(path) {
    try {
      const r = await fetch(`https://plausible.io/api/v1/${path}`, {
        headers: { Authorization: `Bearer ${PLAUSIBLE_KEY}` },
      });
      return r.ok ? r.json() : null;
    } catch { return null; }
  }

  const [agg7d, agg28d, topPages, sources] = await Promise.all([
    p(`stats/aggregate?site_id=${PLAUSIBLE_SITE}&period=7d&metrics=visitors,pageviews,bounce_rate,visit_duration`),
    p(`stats/aggregate?site_id=${PLAUSIBLE_SITE}&period=28d&metrics=visitors,pageviews`),
    p(`stats/breakdown?site_id=${PLAUSIBLE_SITE}&period=7d&property=event:page&limit=10`),
    p(`stats/breakdown?site_id=${PLAUSIBLE_SITE}&period=7d&property=visit:source&limit=8`),
  ]);

  return { available: true, agg7d, agg28d, topPages, sources };
}

// ── Instagram Insights ───────────────────────────────────────────────────────

async function fetchIGInsights() {
  if (!META_PAGE_TOKEN || !META_IG_ACCOUNT) return { available: false, note: 'META_PAGE_TOKEN veya META_IG_ACCOUNT_ID eksik' };
  try {
    const metrics = 'impressions,reach,profile_views,website_clicks,follower_count';
    const url = `https://graph.facebook.com/v21.0/${META_IG_ACCOUNT}/insights?metric=${metrics}&period=week&access_token=${META_PAGE_TOKEN}`;
    const r = await fetch(url);
    if (!r.ok) return { available: false, note: `IG API ${r.status}` };
    const json = await r.json();
    const data = {};
    for (const item of (json.data || [])) {
      const val = item.values?.[item.values.length - 1]?.value ?? null;
      data[item.name] = val;
    }
    return { available: true, ...data };
  } catch (e) {
    return { available: false, note: e.message };
  }
}

// ── Supabase booking funnel ──────────────────────────────────────────────────

async function fetchBookingFunnel() {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  async function supa(path) {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      return r.ok ? r.json() : null;
    } catch { return null; }
  }

  const [posts7d, decisions7d] = await Promise.all([
    supa(`/social_posts?created_at=gte.${since}&select=status,engagement_metrics&limit=50`),
    supa(`/content_decisions?decision_date=gte.${since.slice(0,10)}&select=pillar,confidence&limit=50`),
  ]);

  return {
    posts_total: posts7d?.length ?? '?',
    posts_published: posts7d?.filter(p => p.status === 'published').length ?? '?',
    posts_pending: posts7d?.filter(p => p.status === 'pending_approval').length ?? '?',
    decisions_total: decisions7d?.length ?? '?',
    decisions_auto: decisions7d?.filter(d => d.confidence >= 0.85).length ?? '?',
  };
}

// ── Anthropic sentez ─────────────────────────────────────────────────────────

const SYSTEM = `Sen Kalkan Info'nun sosyal medya ve trafik analistısın. Türkçe, somut, sayı destekli yaz.

Veri eksikse "?" kullan, uydurma. Her cümle bir sayıya dayanmalı.
Maksimum 1 sayfa. 3 aksiyon öner.

SADECE JSON çıktı ver:
{
  "week": "YYYY-WXX",
  "tldr": "3 cümle özet",
  "top_findings": [
    { "rank": 1, "metric": "metrik adı", "value": "değer", "change": "+/-%" , "note": "tek cümle yorum" }
  ],
  "pillar_scores": {
    "S1_antik": 0,
    "S2_plaj": 0,
    "S3_aktivite": 0,
    "S4_konaklama": 0,
    "S5_yemek_gece": 0
  },
  "next_3_actions": [
    "Aksiyon 1",
    "Aksiyon 2",
    "Aksiyon 3"
  ],
  "anomalies": [],
  "data_gaps": []
}`;

export async function runSocialAnalyst({ window: win = '7d' } = {}) {
  const [plausible, ig, funnel] = await Promise.all([
    fetchPlausible(),
    fetchIGInsights(),
    fetchBookingFunnel(),
  ]);

  const hasAnyData = plausible.available || ig.available || funnel;
  if (!hasAnyData) {
    return {
      summary: 'no data — PLAUSIBLE_API_KEY, META_PAGE_TOKEN ve SUPABASE env var eksik.',
      top_findings: [],
      cost: 0,
    };
  }

  const ctx = `Hafta: ${weekLabel()}

PLAUSIBLE (kalkaninfo.com, son 7g):
${plausible.available
  ? `Ziyaretçi: ${JSON.stringify(plausible.agg7d?.results?.visitors)}, Sayfa görüntüleme: ${JSON.stringify(plausible.agg7d?.results?.pageviews)}, Bounce: ${JSON.stringify(plausible.agg7d?.results?.bounce_rate)}, Süre: ${JSON.stringify(plausible.agg7d?.results?.visit_duration)}
Top sayfalar: ${(plausible.topPages?.results || []).slice(0,5).map(p=>`${p.page}(${p.visitors})`).join(', ')}
Kaynaklar: ${(plausible.sources?.results || []).slice(0,5).map(s=>`${s.source}(${s.visitors})`).join(', ')}`
  : `Mevcut değil: ${plausible.note}`}

INSTAGRAM INSIGHTS (son 7g):
${ig.available
  ? `Reach: ${ig.reach ?? '?'}, İzlenim: ${ig.impressions ?? '?'}, Profil görüntüleme: ${ig.profile_views ?? '?'}, Site tıklamaları: ${ig.website_clicks ?? '?'}, Takipçi: ${ig.follower_count ?? '?'}`
  : `Mevcut değil: ${ig.note}`}

SUPABASE İÇERİK FUNNEL (son 7g):
${funnel
  ? `Post (toplam/yayın/bekleyen): ${funnel.posts_total}/${funnel.posts_published}/${funnel.posts_pending}\nKarar (toplam/auto-approve): ${funnel.decisions_total}/${funnel.decisions_auto}`
  : 'Supabase bağlantısı yok'}

Yukarıdaki veriye göre haftalık sosyal medya raporu üret. Pillar skorlarını veri yoksa 0 olarak işaretle, uydurma.`;

  const { parsed, cost, usage } = await ask({
    model: 'haiku',
    system: SYSTEM,
    user: ctx,
    max_tokens: 1500,
    json: true,
  });

  const summary = parsed?._parse_error
    ? 'Analiz tamamlandı (parse hatası)'
    : parsed?.tldr || `${weekLabel()} sosyal medya raporu hazır`;

  return {
    summary,
    week: parsed?.week || weekLabel(),
    tldr: parsed?.tldr || '',
    top_findings: parsed?.top_findings || [],
    pillar_scores: parsed?.pillar_scores || {},
    next_3_actions: parsed?.next_3_actions || [],
    anomalies: parsed?.anomalies || [],
    data_gaps: parsed?.data_gaps || [],
    cost,
    usage,
    outputBrief: summary,
  };
}
