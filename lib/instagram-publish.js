// lib/instagram-publish.js
// Meta Graph API v21.0 — Instagram Business yayın client'ı.
// Bağımlılık yok, sadece global fetch.

const GRAPH = 'https://graph.facebook.com/v21.0';
const CAPTION_MAX = 2200;

function truncate(caption) {
  if (!caption) return '';
  return caption.length <= CAPTION_MAX ? caption : caption.slice(0, CAPTION_MAX - 3) + '...';
}

async function graphPost(path, params) {
  const url = `${GRAPH}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || json.error_description || `HTTP ${res.status}`;
    const code = json.error?.code || res.status;
    throw new Error(`Meta Graph API error (${code}): ${msg}`);
  }
  return json;
}

async function graphGet(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${GRAPH}${path}?${qs}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta Graph API error: ${msg}`);
  }
  return json;
}

/**
 * Carousel (2–10 görsel) yayınla.
 */
export async function publishCarousel(igUserId, accessToken, imageUrls, caption) {
  if (!imageUrls || imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`publishCarousel: imageUrls must be 2–10 items, got ${imageUrls?.length}`);
  }

  // 1. Her görsel için item media oluştur
  const childIds = [];
  for (const imageUrl of imageUrls) {
    const item = await graphPost(`/${igUserId}/media`, {
      media_type: 'IMAGE',
      image_url: imageUrl,
      is_carousel_item: true,
      access_token: accessToken,
    });
    childIds.push(item.id);
  }

  // 2. Carousel container oluştur
  const container = await graphPost(`/${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds,
    caption: truncate(caption),
    access_token: accessToken,
  });

  // 3. Yayınla
  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  return { mediaId: published.id, type: 'carousel', childCount: childIds.length };
}

/**
 * Tek görsel yayınla.
 */
export async function publishSingleImage(igUserId, accessToken, imageUrl, caption) {
  const container = await graphPost(`/${igUserId}/media`, {
    media_type: 'IMAGE',
    image_url: imageUrl,
    caption: truncate(caption),
    access_token: accessToken,
  });

  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  return { mediaId: published.id, type: 'single_image' };
}

/**
 * Reels (video) yayınla. Video işlenene kadar poll eder.
 */
export async function publishReels(igUserId, accessToken, videoUrl, caption, coverUrl) {
  const params = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: truncate(caption),
    access_token: accessToken,
  };
  if (coverUrl) params.cover_url = coverUrl;

  const container = await graphPost(`/${igUserId}/media`, params);

  // Video işlenmesini bekle — max 60s, 5s aralıklarla
  const maxAttempts = 12;
  let attempt = 0;
  while (attempt < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000));
    attempt++;
    const status = await graphGet(`/${container.id}`, {
      fields: 'status_code',
      access_token: accessToken,
    });
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') {
      throw new Error(`Reels media processing error (creation_id: ${container.id})`);
    }
    if (attempt === maxAttempts) {
      throw new Error(`Reels processing timeout after 60s (creation_id: ${container.id})`);
    }
  }

  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  return { mediaId: published.id, type: 'reels' };
}
