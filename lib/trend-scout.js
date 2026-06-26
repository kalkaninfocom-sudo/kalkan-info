// lib/trend-scout.js
// Google Trends Daily RSS (TR) + IG hashtag freshness sinyali → trending_topics tablosu.
// API key gerektirmez. Ücretsiz kaynak.

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TRENDS_RSS = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=TR';

const KALKAN_KEYWORDS = [
  'kalkan', 'kaş', 'kas', 'antalya', 'likya', 'patara', 'kaputaş', 'kaputas',
  'kekova', 'antik kent', 'mavi yolculuk', 'tatil', 'plaj', 'turkish riviera',
  'fethiye', 'ölüdeniz', 'oludeniz', 'saklıkent', 'saklikent',
];

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

function score(title, snippet = '') {
  const t = `${title} ${snippet}`.toLowerCase();
  let s = 0.1;
  for (const k of KALKAN_KEYWORDS) {
    if (t.includes(k)) s = Math.max(s, k === 'kalkan' ? 1.0 : 0.7);
  }
  if (/yaz|tatil|temmuz|ağustos|haziran|sezon/.test(t)) s = Math.max(s, s + 0.2);
  return Math.min(s, 1.0);
}

function parseRSS(xml) {
  const items = [];
  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of matches) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([^<\]]+)/) || [])[1]?.trim();
    const snippet = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]?.trim()?.slice(0, 400);
    const traffic = (block.match(/<ht:approx_traffic>([^<]+)</) || [])[1];
    if (title) items.push({ title, snippet, traffic });
  }
  return items;
}

export async function scoutTrends({ now = new Date() } = {}) {
  const out = { source: 'google-trends-tr', fetched_at: now.toISOString(), items: [], inserted: 0 };
  try {
    const r = await fetch(TRENDS_RSS, { headers: { 'user-agent': 'kalkaninfo-trend-scout/1.0' } });
    if (!r.ok) throw new Error(`RSS ${r.status}`);
    const xml = await r.text();
    const items = parseRSS(xml);
    out.items = items.map(it => ({ ...it, relevance: score(it.title, it.snippet) }));
  } catch (e) {
    out.error = String(e.message || e);
    return out;
  }

  if (SUPA_URL && SUPA_KEY && out.items.length) {
    const rows = out.items
      .filter(it => it.relevance >= 0.3)
      .map(it => ({
        source: 'google_trends_tr',
        title: it.title.slice(0, 240),
        snippet: it.snippet?.slice(0, 1000) || null,
        relevance: it.relevance,
        traffic: it.traffic || null,
        meta: { fetched_at: out.fetched_at },
      }));
    if (rows.length) {
      const ins = await supa('/trending_topics', {
        method: 'POST',
        body: JSON.stringify(rows),
      });
      out.inserted = ins.ok ? rows.length : 0;
      if (!ins.ok) out.insert_error = await ins.text();
    }
  }

  return out;
}

export async function getRecentTrends({ hours = 24, minRelevance = 0.3 } = {}) {
  if (!SUPA_URL || !SUPA_KEY) return [];
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const r = await supa(`/trending_topics?fetched_at=gte.${since}&relevance=gte.${minRelevance}&order=relevance.desc&limit=20`);
  return r.ok ? r.json() : [];
}
