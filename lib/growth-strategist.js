// lib/growth-strategist.js
// Haftalık trafik büyütme stratejisti. Plausible (varsa) + Supabase verisi okur, öneri üretir.
// Çıktı: growth_plans tablosuna haftalık plan + 3 aksiyon.

import { ask } from './anthropic.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLAUSIBLE_KEY = process.env.PLAUSIBLE_API_KEY;
const PLAUSIBLE_SITE = process.env.PLAUSIBLE_SITE_ID || 'kalkaninfo.com';

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

async function plausible(path) {
  if (!PLAUSIBLE_KEY) return null;
  try {
    const r = await fetch(`https://plausible.io/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${PLAUSIBLE_KEY}` },
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function trafficSnapshot() {
  if (!PLAUSIBLE_KEY) return { available: false, note: 'PLAUSIBLE_API_KEY env var yok' };
  const [aggregate7d, aggregate28d, topPages, sources, devices] = await Promise.all([
    plausible(`stats/aggregate?site_id=${PLAUSIBLE_SITE}&period=7d&metrics=visitors,pageviews,bounce_rate,visit_duration`),
    plausible(`stats/aggregate?site_id=${PLAUSIBLE_SITE}&period=28d&metrics=visitors,pageviews`),
    plausible(`stats/breakdown?site_id=${PLAUSIBLE_SITE}&period=7d&property=event:page&limit=10`),
    plausible(`stats/breakdown?site_id=${PLAUSIBLE_SITE}&period=7d&property=visit:source&limit=10`),
    plausible(`stats/breakdown?site_id=${PLAUSIBLE_SITE}&period=7d&property=visit:device&limit=5`),
  ]);
  return { available: true, aggregate7d, aggregate28d, topPages, sources, devices };
}

const SYSTEM = `Sen Kalkan Info'nun büyüme stratejistısın. Türkçe karar veren, somut aksiyon öneren bir CMO.

Hedef: kalkaninfo.com'u daha çok ziyaret edilen site yapmak. Vanity metric değil — gerçek qualified trafik + dönüşüm.

Kaldıraçlar:
1. SEO içerik (uzun-kuyruk Kalkan/Kaş/Patara anahtarları)
2. Sosyal medya → site referral funnel (IG bio + reels CTA)
3. UX/conversion (villa detay → DM dönüşüm, bounce azaltma)
4. Backlink (yerel turizm blogları, gezi forumları)
5. Email/newsletter (mevcut Resend setup, abone yakala)
6. Mobile + PWA hız (LCP iyileştirme)

Çıktı SADECE JSON:
{
  "week_label": "2026-W26",
  "current_state": "tek cümle özet",
  "top_3_actions": [
    {
      "rank": 1,
      "lever": "SEO|Social|UX|Backlink|Email|Speed",
      "action": "somut yapılacak iş (1 cümle)",
      "expected_impact": "trafik %/dönüşüm/lead — sayısal tahmin",
      "effort": "low|medium|high",
      "owner": "agent_name veya 'berkay'",
      "deadline_days": 7
    }
  ],
  "warnings": ["riskli görülen şey (varsa)"],
  "data_gaps": ["eksik veri (varsa) — örn. 'Plausible Goals kurulu değil'"]
}`;

export async function generateWeeklyPlan({ persist = true } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const weekLabel = (() => {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  })();

  const [traffic, posts7d, decisions7d] = await Promise.all([
    trafficSnapshot(),
    supa(`/social_posts?created_at=gte.${new Date(Date.now()-7*86400_000).toISOString()}&select=content_pack_id,status,engagement_metrics&limit=30`).then(r => r.ok ? r.json() : []),
    supa(`/content_decisions?decision_date=gte.${new Date(Date.now()-7*86400_000).toISOString().slice(0,10)}&select=pillar,confidence,status&limit=30`).then(r => r.ok ? r.json() : []),
  ]);

  const ctx = `Bugün: ${today} (${weekLabel})

TRAFİK (Plausible):
${traffic.available ? `7g: ${JSON.stringify(traffic.aggregate7d?.results)}\n28g: ${JSON.stringify(traffic.aggregate28d?.results)}\nTop sayfa: ${(traffic.topPages?.results||[]).slice(0,5).map(p=>`${p.page}(${p.visitors})`).join(', ')}\nKaynak: ${(traffic.sources?.results||[]).slice(0,5).map(s=>`${s.source}(${s.visitors})`).join(', ')}\nCihaz: ${(traffic.devices?.results||[]).map(d=>`${d.device}(${d.visitors})`).join(', ')}` : `Plausible yok: ${traffic.note}`}

SON 7G İÇERİK ÜRETİMİ:
- Toplam post: ${posts7d.length}
- Yayında: ${posts7d.filter(p => p.status === 'published').length}
- Beklemede: ${posts7d.filter(p => p.status === 'pending_approval').length}

SON 7G KARAR ÜRETİMİ:
- Toplam aday: ${decisions7d.length}
- Auto-approved (≥0.85): ${decisions7d.filter(d => d.confidence >= 0.85).length}
- Pillar dağılımı: ${Object.entries(decisions7d.reduce((a,d)=>{a[d.pillar||'?']=(a[d.pillar||'?']||0)+1;return a;},{})).map(([k,v])=>`${k}:${v}`).join(', ')}

Yukarıdaki veriye göre haftalık büyüme planı üret. 3 aksiyon, etkili olduğunu düşündüğün sıra ile.`;

  const { parsed, cost, usage } = await ask({
    model: 'sonnet',
    system: SYSTEM,
    user: ctx,
    max_tokens: 1500,
    json: true,
  });

  if (persist && SUPA_URL && SUPA_KEY && parsed && !parsed._parse_error) {
    await supa('/growth_plans', {
      method: 'POST',
      body: JSON.stringify({
        week_label: parsed.week_label || weekLabel,
        current_state: parsed.current_state,
        actions: parsed.top_3_actions || [],
        warnings: parsed.warnings || [],
        data_gaps: parsed.data_gaps || [],
        meta: { cost, usage, traffic_available: traffic.available },
      }),
    });
  }

  return { week: weekLabel, plan: parsed, cost, usage };
}
