// lib/threads-publish.js — Meta Threads yayın client'ı (Threads Graph API v1.0)
// Bağımlılık yok, sadece global fetch (Node 18+).
//
// Gerekli env değişkenleri:
//   THREADS_USER_ID      — Threads kullanıcı ID (Meta Developer portalından)
//   THREADS_ACCESS_TOKEN — Uzun ömürlü Threads erişim token'ı
//
// Yayın akışı (2 adımlı, IG'ye benzer ama host farklı):
//   1. Media container oluştur  → POST /{threadsUserId}/threads
//   2. Video ise işlenmesini bekle → GET /{creation_id}?fields=status (max 60s, 5s aralık)
//   3. Yayınla                  → POST /{threadsUserId}/threads_publish
//
// Dok kaynağı: https://developers.facebook.com/docs/threads/posts

const GRAPH = 'https://graph.threads.net/v1.0';
const CAPTION_MAX = 500; // Threads metin limiti ~500 karakter

function truncate(text) {
  if (!text) return '';
  return text.length <= CAPTION_MAX ? text : text.slice(0, CAPTION_MAX - 3) + '...';
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
    throw new Error(`Threads API error (${code}): ${msg}`);
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
    throw new Error(`Threads API error: ${msg}`);
  }
  return json;
}

/**
 * Threads'e görsel veya video yayınla.
 *
 * @param {string} threadsUserId  - Threads kullanıcı ID
 * @param {string} accessToken    - Geçerli Threads erişim token'ı
 * @param {object} opts
 * @param {string} [opts.imageUrl]  - Kamuya açık JPEG/PNG URL (IMAGE akışı)
 * @param {string} [opts.videoUrl]  - Kamuya açık MP4 URL (VIDEO akışı); imageUrl'ye göre öncelikli
 * @param {string} [opts.text]      - Gönderi metni (max 500 karakter, otomatik kırpılır)
 * @returns {Promise<{id: string}>} - Yayınlanan gönderi ID'si
 */
export async function publishThreads(threadsUserId, accessToken, { imageUrl, videoUrl, text }) {
  if (!videoUrl && !imageUrl) {
    throw new Error('publishThreads: imageUrl veya videoUrl gerekli');
  }

  const isVideo = Boolean(videoUrl);

  // 1. Media container oluştur
  const containerParams = {
    access_token: accessToken,
    text: truncate(text),
    media_type: isVideo ? 'VIDEO' : 'IMAGE',
  };
  if (isVideo) {
    containerParams.video_url = videoUrl;
  } else {
    containerParams.image_url = imageUrl;
  }

  const container = await graphPost(`/${threadsUserId}/threads`, containerParams);
  const creationId = container.id;

  // 2. Video ise işlenmesini bekle — max 60s, 5s aralıklarla
  if (isVideo) {
    const maxAttempts = 12;
    let attempt = 0;
    while (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      attempt++;
      const status = await graphGet(`/${creationId}`, {
        fields: 'status',
        access_token: accessToken,
      });
      if (status.status === 'FINISHED') break;
      if (status.status === 'ERROR') {
        throw new Error(`Threads video işleme hatası (creation_id: ${creationId})`);
      }
      if (attempt === maxAttempts) {
        throw new Error(`Threads video işleme zaman aşımı 60s sonra (creation_id: ${creationId})`);
      }
    }
  } else {
    // Görsel için kısa bekleme yeterli (sunucu tarafı hazırlık)
    await new Promise(r => setTimeout(r, 2000));
  }

  // 3. Yayınla
  const published = await graphPost(`/${threadsUserId}/threads_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });

  return { id: published.id };
}
