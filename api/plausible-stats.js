// B2B Dashboard backend — Plausible Stats API proxy
// Vercel env: PLAUSIBLE_API_KEY, PLAUSIBLE_SITE_ID
// CORS: aynı origin (kalkaninfo.com'dan çağrı)
// Cache: 5 dk in-memory (function lifecycle boyunca)

const CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://kalkaninfo.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function plausibleQuery({ apiKey, siteId, metrics, dimensions, dateRange, filters, limit }) {
  const body = {
    site_id: siteId,
    metrics: metrics || ['visitors', 'pageviews'],
    date_range: dateRange || '30d',
    dimensions: dimensions || [],
    filters: filters || [],
    pagination: { limit: limit || 100, offset: 0 },
  };
  const res = await fetch('https://plausible.io/api/v2/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '?');
    throw new Error(`Plausible ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const apiKey = process.env.PLAUSIBLE_API_KEY;
  const siteId = process.env.PLAUSIBLE_SITE_ID || 'kalkaninfo.com';
  if (!apiKey) {
    return res.status(500).json({ error: 'PLAUSIBLE_API_KEY not configured' });
  }

  const period = (req.query.period || '30d').toString().slice(0, 10);
  const cacheKey = `stats:${period}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }

  try {
    const [summary, topPages, topGoals, topSources] = await Promise.all([
      plausibleQuery({ apiKey, siteId, metrics: ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'], dateRange: period }),
      plausibleQuery({ apiKey, siteId, metrics: ['visitors', 'pageviews'], dimensions: ['event:page'], dateRange: period, limit: 10 }),
      plausibleQuery({ apiKey, siteId, metrics: ['visitors', 'events'], dimensions: ['event:goal'], dateRange: period, limit: 15 }),
      plausibleQuery({ apiKey, siteId, metrics: ['visitors'], dimensions: ['visit:source'], dateRange: period, limit: 10 }),
    ]);

    const result = {
      period,
      generated_at: new Date().toISOString(),
      summary: summary.results?.[0] || null,
      top_pages: topPages.results || [],
      top_goals: topGoals.results || [],
      top_sources: topSources.results || [],
    };

    CACHE.set(cacheKey, { t: Date.now(), data: result });
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (e) {
    console.error('[plausible-stats]', e.message);
    return res.status(502).json({ error: e.message || 'upstream error' });
  }
}
