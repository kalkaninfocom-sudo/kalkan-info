// lib/content-director.js
// Bugün ne post atalım? — trend + 30-day plan + son performans + hava sentezi.
// Çıktı: content_decisions tablosuna 3 ranked candidate.

import { ask } from './anthropic.js';
import { getRecentTrends } from './trend-scout.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

async function getRecentPosts(days = 14) {
  if (!SUPA_URL || !SUPA_KEY) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const r = await supa(`/social_posts?created_at=gte.${since}&select=id,content_pack_id,caption,status,engagement_metrics&order=created_at.desc&limit=30`);
  return r.ok ? r.json() : [];
}

async function getWeather() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=36.2667&longitude=29.4167&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&forecast_days=3&timezone=Europe%2FIstanbul');
    if (!r.ok) return null;
    const j = await r.json();
    return {
      now_temp: j.current?.temperature_2m,
      now_code: j.current?.weather_code,
      days: j.daily?.time?.map((d, i) => ({
        date: d,
        max: j.daily.temperature_2m_max[i],
        code: j.daily.weather_code[i],
      })),
    };
  } catch { return null; }
}

const SYSTEM = `Sen Kalkan Info'nun içerik direktörüsün. Türkçe karar ver.

Marka: Kalkan/Kaş/Antalya turizm bilgi platformu. Hedef: yaz aylarında turist trafiği, organik IG/TikTok büyüme.

Sütunlar (her gün 1 birincil seç):
- S1 Antik Kentler & Likya (saves + watch time)
- S2 Plaj & Doğa (sends + reach, FOMO)
- S3 Aktiviteler & Macera (rezervasyon niyeti)
- S4 Konaklama (saves + profile visits)
- S5 Yemek/Gece/Pratik (comments + DM)

Formatlar: reels (15-60sn), carousel (3-8 slayt), story (3-5 frame), statik feed.

Karar girdileri:
1. Google Trends son 24 saat (Türkiye)
2. Son 14 gün post performansı
3. Hava durumu (yağmurluysa S2/S3 erteleme)
4. Mevcut 30-gün plan pozisyonu

Çıktı: SADECE geçerli JSON, başka metin YOK. Şema:
{
  "date": "YYYY-MM-DD",
  "candidates": [
    {
      "rank": 1,
      "pillar": "S1|S2|S3|S4|S5",
      "format": "reels|carousel|story|static",
      "hook_first_3sec": "...",
      "caption_draft": "ilk 90 char arama niyeti, sonra storytelling",
      "hashtags": ["#kalkan", "#..."],
      "confidence": 0.0-1.0,
      "rationale_short": "neden bugün bu (1 cümle)",
      "asset_plan": "hangi mevcut footage/foto kullanılır"
    }
  ],
  "skip_today": false,
  "alerts": []
}

Confidence >= 0.85 → otomatik yayına uygun (brand-guard'a düşer).
Confidence 0.6-0.85 → Telegram onay.
Confidence < 0.6 → reddet veya yeniden iste.`;

export async function decideToday({ now = new Date(), persist = true } = {}) {
  const [trends, posts, weather] = await Promise.all([
    getRecentTrends({ hours: 24, minRelevance: 0.3 }),
    getRecentPosts(14),
    getWeather(),
  ]);

  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = ['Pzr','Pzt','Sal','Çar','Per','Cum','Cmt'][now.getUTCDay()];

  const userMsg = `Bugün: ${today} (${dayOfWeek}).

Google Trends (son 24h, relevance≥0.3):
${trends.slice(0, 10).map(t => `- ${t.title} (skor ${Number(t.relevance).toFixed(2)})`).join('\n') || '(boş)'}

Son 14 gün post (en yeniler):
${posts.slice(0, 8).map(p => `- ${p.content_pack_id || p.id} [${p.status}]`).join('\n') || '(boş)'}

Hava (Kalkan):
${weather ? `Şimdi ${weather.now_temp}°C, kod ${weather.now_code}. 3 gün max: ${weather.days?.map(d => `${d.date}:${d.max}°`).join(', ')}` : '(veri yok)'}

3 aday öner (sıralı, confidence + rationale).`;

  const { parsed, cost, usage, model } = await ask({
    model: 'sonnet',
    system: SYSTEM,
    user: userMsg,
    max_tokens: 2048,
    json: true,
  });

  if (persist && SUPA_URL && SUPA_KEY && parsed?.candidates) {
    const rows = parsed.candidates.map(c => ({
      decision_date: today,
      rank: c.rank,
      pillar: c.pillar,
      format: c.format,
      hook: c.hook_first_3sec,
      caption_draft: c.caption_draft,
      hashtags: c.hashtags || [],
      confidence: c.confidence,
      rationale: c.rationale_short,
      asset_plan: c.asset_plan,
      status: 'pending_brand_guard',
      meta: { model, usage, cost, trends_count: trends.length, weather },
    }));
    await supa('/content_decisions', {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  }

  return { date: today, candidates: parsed?.candidates || [], cost, usage, model, trends_seen: trends.length };
}
