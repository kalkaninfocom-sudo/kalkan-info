// api/social-publish-queue.js
// Vercel cron: her saat başı approved post'ları IG'de yayınlar.
// Manuel test: GET /api/social-publish-queue?secret=...&dry=1

import { publishCarousel, publishSingleImage, publishReels } from '../lib/instagram-publish.js';
import { sendMessage } from '../lib/telegram.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IG_USER_ID = process.env.IG_BUSINESS_ID;
const IG_TOKEN = process.env.IG_LONG_LIVED_TOKEN;
const CRON_SECRET = process.env.IG_CRON_SECRET;
const TG_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE_BASE = 'https://www.kalkaninfo.com';

// Supabase REST helper
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

async function fetchApprovedPosts() {
  const now = new Date().toISOString();
  const res = await supa(
    `/social_posts?status=eq.approved&scheduled_at=lte.${encodeURIComponent(now)}&published_at=is.null&order=scheduled_at.asc&limit=5`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch fail (${res.status}): ${text}`);
  }
  return res.json();
}

async function markPublished(postId, igMediaId) {
  const res = await supa(`/social_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: igMediaId,
    }),
  });
  if (!res.ok) {
    console.error('[social-publish-queue] markPublished fail', res.status, await res.text());
  }
}

async function markFailed(postId, errorMsg) {
  const res = await supa(`/social_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'failed',
      engagement_metrics: { error: errorMsg },
    }),
  });
  if (!res.ok) {
    console.error('[social-publish-queue] markFailed fail', res.status, await res.text());
  }
}

async function notify(text) {
  if (!TG_CHAT_ID || !process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    await sendMessage(TG_CHAT_ID, text, { parse_mode: 'HTML' });
  } catch (e) {
    console.warn('[social-publish-queue] telegram notify fail:', e.message);
  }
}

function buildCaption(post) {
  const caption = post.caption || post.content || '';
  const tags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : (post.hashtags || '');
  const full = tags ? `${caption}\n\n${tags}` : caption;
  return full.length <= 2200 ? full : full.slice(0, 2197) + '...';
}

function resolveImageUrls(localAssets) {
  if (!Array.isArray(localAssets)) return [];
  return localAssets
    .filter(p => typeof p === 'string' && p.trim())
    .map(p => (p.startsWith('http') ? p : `${SITE_BASE}${p.startsWith('/') ? p : '/' + p}`));
}

export default async function handler(req, res) {
  // Auth — cron veya manuel secret
  const secret = req.query?.secret || req.headers?.authorization?.replace('Bearer ', '');
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const dry = req.query?.dry === '1' || req.query?.dry === 'true';

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env missing' });
  }
  if (!IG_USER_ID || !IG_TOKEN) {
    return res.status(500).json({ ok: false, error: 'IG env missing (IG_BUSINESS_ID / IG_LONG_LIVED_TOKEN)' });
  }

  let posts;
  try {
    posts = await fetchApprovedPosts();
  } catch (err) {
    console.error('[social-publish-queue] fetch fail:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }

  if (dry) {
    return res.status(200).json({
      ok: true,
      dry: true,
      found: posts.length,
      items: posts.map(p => ({
        id: p.id,
        content_pack_id: p.content_pack_id,
        scheduled_at: p.scheduled_at,
        local_assets_count: Array.isArray(p.local_assets) ? p.local_assets.length : 0,
      })),
    });
  }

  const results = [];
  let published = 0;
  let failed = 0;

  for (const post of posts) {
    const label = post.content_pack_id || post.id;
    try {
      const imageUrls = resolveImageUrls(post.local_assets);
      const caption = buildCaption(post);

      let result;
      if (post.content_type === 'reels' || post.content_type === 'video') {
        if (!imageUrls.length) throw new Error('reels: video URL (local_assets[0]) yok');
        result = await publishReels(IG_USER_ID, IG_TOKEN, imageUrls[0], caption);
      } else if (imageUrls.length >= 2) {
        result = await publishCarousel(IG_USER_ID, IG_TOKEN, imageUrls, caption);
      } else if (imageUrls.length === 1) {
        result = await publishSingleImage(IG_USER_ID, IG_TOKEN, imageUrls[0], caption);
      } else {
        throw new Error('local_assets boş veya geçersiz — yayınlamak için en az 1 görsel gerekli');
      }

      await markPublished(post.id, result.mediaId);
      published++;

      const msg = `✅ Yayınlandı: <b>${label}</b>\nTür: ${result.type} | Media ID: ${result.mediaId}`;
      await notify(msg);

      results.push({ id: post.id, label, status: 'published', mediaId: result.mediaId, type: result.type });
    } catch (err) {
      console.error(`[social-publish-queue] post ${post.id} fail:`, err);
      failed++;

      await markFailed(post.id, err.message);

      const msg = `❌ Fail: <b>${label}</b> — ${err.message}`;
      await notify(msg);

      results.push({ id: post.id, label, status: 'failed', error: err.message });
    }
  }

  return res.status(200).json({
    ok: true,
    processed: posts.length,
    published,
    failed,
    items: results,
  });
}
