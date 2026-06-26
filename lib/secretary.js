// lib/secretary.js
// Berkay'ın WhatsApp sekreteri — anlık veri toplar, Sonnet ile cevap verir.
// Sadece BERKAY_WHATSAPP eşleşen numara için aktif olur.

import { ask } from './anthropic.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  return r.ok ? r.json() : null;
}

function ago(iso) {
  if (!iso) return '?';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m}dk önce`;
  if (m < 1440) return `${Math.floor(m / 60)}sa önce`;
  return `${Math.floor(m / 1440)}g önce`;
}

export async function buildBriefing() {
  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [agents, decisions, posts, trends, guards, bookings] = await Promise.all([
    supa(`/agent_runs?started_at=gte.${since24}&select=agent_name,status,cost_usd,started_at,error_msg&order=started_at.desc&limit=100`),
    supa(`/content_decisions?decision_date=eq.${today}&select=rank,pillar,format,confidence,status,caption_draft&order=rank.asc`),
    supa(`/social_posts?created_at=gte.${since7d}&select=content_pack_id,status,engagement_metrics,published_at&order=created_at.desc&limit=20`),
    supa(`/trending_topics?fetched_at=gte.${since24}&select=title,relevance,traffic&order=relevance.desc&limit=10`),
    supa(`/brand_guard_log?checked_at=gte.${since24}&pass=eq.false&select=input_brief,overall,flags,checked_at&order=checked_at.desc&limit=5`),
    supa(`/bookings?created_at=gte.${since7d}&select=id,status,created_at&order=created_at.desc&limit=20`).catch(() => null),
  ]);

  const agentSummary = {};
  for (const r of (agents || [])) {
    const k = r.agent_name;
    if (!agentSummary[k]) agentSummary[k] = { runs: 0, fails: 0, cost: 0, last_at: r.started_at, last_status: r.status, last_error: r.error_msg };
    agentSummary[k].runs += 1;
    if (r.status === 'failed') agentSummary[k].fails += 1;
    agentSummary[k].cost += Number(r.cost_usd || 0);
  }

  return {
    today,
    agent_24h: Object.entries(agentSummary).map(([name, v]) => ({ name, ...v, last_ago: ago(v.last_at) })),
    decisions_today: decisions || [],
    posts_7d: posts || [],
    trends_24h: trends || [],
    blocks_24h: guards || [],
    bookings_7d_count: Array.isArray(bookings) ? bookings.length : null,
    bookings_7d_confirmed: Array.isArray(bookings) ? bookings.filter(b => b.status === 'confirmed').length : null,
    total_cost_24h: Object.values(agentSummary).reduce((s, v) => s + v.cost, 0),
    total_runs_24h: Object.values(agentSummary).reduce((s, v) => s + v.runs, 0),
    total_fails_24h: Object.values(agentSummary).reduce((s, v) => s + v.fails, 0),
  };
}

const SECRETARY_SYSTEM = `Sen Berkay'ın özel WhatsApp sekreterisin. Kalkan Info'nun (turizm portalı) günlük operasyonunu izliyorsun.

KİMLİĞİN: Sekreter — kısa, net, somut. Berkay yorulmuş bir kurucu, gevezelik istemiyor.

ÜSLUP:
- Türkçe, samimi ama profesyonel
- 2-5 cümle, asla uzun rapor
- Sayı varsa sayıyla konuş
- Emoji yok, başlık yok, madde işareti sadece liste sorduğunda
- "Efendim", "Tabii" gibi laf yok — direkt cevap

NE BİLİYORSUN (her cevapta context'te güncel veri var):
- Son 24 saat agent çalışmaları (15+ agent: trend-scout, content-director, brand-guard, social-writer, vs.)
- Bugünün içerik kararları (content-director'ın 3 önerisi + confidence)
- Son 7 gün IG postları + durumları
- Trending topics (Google Trends TR son 24h, Kalkan-relevance ile filtrelenmiş)
- Bugün brand-guard'ın engellediği şeyler
- Son 7 gün rezervasyon sayısı (varsa)
- Toplam maliyet 24h

ROL: 3 tip sorulara cevap ver:
1. "Bugün ne yapıldı?" → agent_24h + decisions_today + posts_7d özet
2. "Hangi reels patladı?" → posts_7d.engagement_metrics karşılaştır
3. "Sorun var mı?" → fails + blocks + low confidence decisions

KURAL: Veri yoksa "Henüz veri yok, sistem yeni başladı" de, uydurma. Eylem öner: "Yarın sabah daha çok veri olur."`;

export async function askSecretary({ userMessage, briefing }) {
  const ctx = `GÜNCEL DURUM (${briefing.today}):

Son 24 saat: ${briefing.total_runs_24h} agent çalışması, ${briefing.total_fails_24h} hata, $${briefing.total_cost_24h.toFixed(2)} maliyet.

Agentlar:
${briefing.agent_24h.map(a => `- ${a.name}: ${a.runs}× (${a.fails} hata) son ${a.last_ago} [${a.last_status}]${a.last_error ? ` — ${a.last_error.slice(0,80)}` : ''}`).join('\n') || '(boş)'}

Bugünün içerik önerileri:
${briefing.decisions_today.map(d => `- #${d.rank} ${d.pillar}/${d.format} conf ${d.confidence} [${d.status}]: ${(d.caption_draft||'').slice(0,80)}`).join('\n') || '(content-director henüz çalışmadı)'}

Son 7 gün postlar:
${briefing.posts_7d.slice(0,8).map(p => `- ${p.content_pack_id || '?'} [${p.status}] ${p.published_at ? ago(p.published_at) : ''}`).join('\n') || '(boş)'}

Trending (Kalkan-relevant):
${briefing.trends_24h.slice(0,5).map(t => `- ${t.title} (skor ${t.relevance})`).join('\n') || '(boş)'}

Engellenen içerik (24h):
${briefing.blocks_24h.map(b => `- "${b.input_brief.slice(0,60)}..." score ${b.overall} flags: ${(b.flags||[]).join(',')}`).join('\n') || '(yok ✓)'}

Rezervasyon 7g: ${briefing.bookings_7d_count ?? '?'} (${briefing.bookings_7d_confirmed ?? '?'} confirmed)

---

Berkay'ın sorusu: "${userMessage}"

Yukarıdaki güncel veriye göre Türkçe, kısa, somut cevap ver.`;

  const { text, cost, usage } = await ask({
    model: 'sonnet',
    system: SECRETARY_SYSTEM,
    user: ctx,
    max_tokens: 600,
  });

  return { reply: text, cost, usage };
}

export function isBerkay(phoneNumber) {
  const berkay = (process.env.BERKAY_WHATSAPP || '').replace(/\D/g, '');
  if (!berkay) return false;
  const normalized = String(phoneNumber || '').replace(/\D/g, '');
  return normalized === berkay || normalized.endsWith(berkay) || berkay.endsWith(normalized);
}
