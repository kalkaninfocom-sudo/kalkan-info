/**
 * api/instagram-hashtag.js — Kalkan Info
 *
 * Instagram Graph API ile #kalkaninfo etiketli postları çeker.
 * Vercel cron (saatte 1) ile tetiklenir; data/instagram-feed.json yazılır.
 *
 * GEREKLİ ENV VARS (Vercel Project Settings → Environment Variables):
 *   META_APP_ID            — Meta App ID (4407667539517517)
 *   META_APP_SECRET        — Meta App Secret (gizli)
 *   IG_BUSINESS_ID         — Instagram Business hesabımızın ID'si (Graph API'den)
 *   IG_LONG_LIVED_TOKEN    — Long-lived access token (60 gün geçerli)
 *   IG_HASHTAGS            — Virgülle ayrılmış hashtag listesi (#'siz)
 *                             default: kalkaninfo,kalkanvilla,kalkantatil,visitkalkan,kalkankaputas
 *   IG_HASHTAG             — (Eski; tek hashtag, geriye uyumluluk)
 *   IG_CRON_SECRET         — Cron tetikleyici için paylaşılan secret
 *
 * Flow:
 *   1. Hashtag ID'yi al (cache'le) — GET /ig_hashtag_search
 *   2. recent_media + top_media çek — GET /{hashtag_id}/recent_media
 *   3. data/instagram-feed.json'a yaz (max 30 post, 7 gün rolling)
 *
 * Auth: Vercel cron için X-Vercel-Cron header check + Authorization Bearer.
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const MAX_POSTS = 30;
const MAX_AGE_DAYS = 7;

async function getHashtagId(hashtag, businessId, token) {
  const url = `${GRAPH_BASE}/ig_hashtag_search?user_id=${businessId}&q=${encodeURIComponent(hashtag)}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`hashtag_search failed: HTTP ${res.status} — ${err}`);
  }
  const json = await res.json();
  const id = json?.data?.[0]?.id;
  if (!id) throw new Error(`Hashtag ID bulunamadı: #${hashtag}`);
  return id;
}

async function fetchHashtagMedia(hashtagId, businessId, token, edge = 'recent_media') {
  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count';
  const url = `${GRAPH_BASE}/${hashtagId}/${edge}?user_id=${businessId}&fields=${fields}&limit=50&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${edge} failed: HTTP ${res.status} — ${err}`);
  }
  return res.json();
}

function filterAndNormalize(items) {
  const now = Date.now();
  const cutoff = now - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  return items
    .filter(it => {
      const t = new Date(it.timestamp || 0).getTime();
      return t >= cutoff && (it.media_type === 'IMAGE' || it.media_type === 'CAROUSEL_ALBUM' || it.media_type === 'VIDEO');
    })
    .map(it => ({
      id: it.id,
      caption: (it.caption || '').slice(0, 280),
      type: it.media_type,
      image: it.media_type === 'VIDEO' ? (it.thumbnail_url || it.media_url) : it.media_url,
      permalink: it.permalink,
      timestamp: it.timestamp,
      likes: it.like_count || 0,
      comments: it.comments_count || 0
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, MAX_POSTS);
}

export default async function handler(req, res) {
  // CORS — sadece kendi sayfamızdan tetiklenebilir + Vercel cron
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');

  // Cron auth — bot çağrılarından koru (manuel test için ?secret=...)
  const cronHeader = req.headers['x-vercel-cron'];
  const providedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query?.secret;
  const expectedSecret = process.env.IG_CRON_SECRET;
  if (!cronHeader && expectedSecret && providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const businessId = process.env.IG_BUSINESS_ID;
  const token = process.env.IG_LONG_LIVED_TOKEN;
  const hashtagsRaw = process.env.IG_HASHTAGS || process.env.IG_HASHTAG
    || 'kalkaninfo,kalkanvilla,kalkantatil,visitkalkan,kalkankaputas';
  const hashtags = hashtagsRaw.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean);

  if (!businessId || !token) {
    return res.status(503).json({
      error: 'Configuration missing',
      hint: 'IG_BUSINESS_ID and IG_LONG_LIVED_TOKEN env vars must be set in Vercel Project Settings.',
      configured: { businessId: !!businessId, token: !!token }
    });
  }

  try {
    const merged = new Map();
    const stats = [];

    for (const hashtag of hashtags) {
      try {
        const hashtagId = await getHashtagId(hashtag, businessId, token);
        const [recent, top] = await Promise.all([
          fetchHashtagMedia(hashtagId, businessId, token, 'recent_media').catch(() => ({ data: [] })),
          fetchHashtagMedia(hashtagId, businessId, token, 'top_media').catch(() => ({ data: [] }))
        ]);
        for (const it of (recent.data || [])) if (!merged.has(it.id)) merged.set(it.id, { ...it, _tag: hashtag });
        for (const it of (top.data || [])) if (!merged.has(it.id)) merged.set(it.id, { ...it, _tag: hashtag });
        stats.push({ hashtag, hashtagId, count: (recent.data?.length || 0) + (top.data?.length || 0) });
      } catch (e) {
        stats.push({ hashtag, error: e.message });
      }
    }

    const posts = filterAndNormalize([...merged.values()]);

    const payload = {
      hashtags,
      generatedAt: new Date().toISOString(),
      count: posts.length,
      stats,
      posts
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[instagram-hashtag] error:', err);
    return res.status(500).json({ error: 'Hashtag fetch failed', message: err.message });
  }
}
