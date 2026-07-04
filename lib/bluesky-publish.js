// lib/bluesky-publish.js — Bluesky (AT Protocol) yayın client'ı.
// Bağımlılık yok, sadece global fetch. Tamamen ücretsiz, app onayı yok.
//
// Gerekli env:
//   BLUESKY_HANDLE          — örn. kalkaninfo.bsky.social (veya özel domain handle)
//   BLUESKY_APP_PASSWORD    — Bluesky ayarlar → App Passwords'tan üretilir (2 dk)
//
// Görsel (JPEG) + video (mp4) destekler. Medya byte'ları imageUrl/videoUrl'den
// indirilip com.atproto.repo.uploadBlob ile yüklenir (Bluesky URL'den çekmez).

const PDS = 'https://bsky.social';

async function xrpc(path, { method = 'POST', token, json, body, contentType } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  else if (contentType) headers['Content-Type'] = contentType;
  const res = await fetch(`${PDS}/xrpc/${path}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : body,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    throw new Error(`Bluesky ${path} fail: ${j.error || res.status} ${j.message || ''}`.trim());
  }
  return j;
}

/**
 * Bluesky'a gönderi yayınla (görsel veya video + metin).
 * @param {{handle:string, appPassword:string}} auth
 * @param {{imageUrl?:string, videoUrl?:string, text?:string, altText?:string}} post
 * @returns {Promise<{uri:string, cid:string}>}
 */
export async function publishBluesky({ handle, appPassword }, { imageUrl, videoUrl, text, altText }) {
  if (!handle || !appPassword) throw new Error('Bluesky env eksik (BLUESKY_HANDLE / BLUESKY_APP_PASSWORD)');

  // 1) Session
  const session = await xrpc('com.atproto.server.createSession', {
    json: { identifier: handle, password: appPassword },
  });
  const token = session.accessJwt;
  const did = session.did;

  const record = {
    $type: 'app.bsky.feed.post',
    text: (text || '').slice(0, 300),
    createdAt: new Date().toISOString(),
    langs: ['tr'],
  };

  // 2) Medya blob yükle + embed
  if (videoUrl) {
    const bytes = new Uint8Array(await (await fetch(videoUrl)).arrayBuffer());
    const up = await xrpc('com.atproto.repo.uploadBlob', {
      token, body: bytes, contentType: 'video/mp4',
    });
    record.embed = { $type: 'app.bsky.embed.video', video: up.blob, alt: (altText || text || '').slice(0, 1000) };
  } else if (imageUrl) {
    const bytes = new Uint8Array(await (await fetch(imageUrl)).arrayBuffer());
    const up = await xrpc('com.atproto.repo.uploadBlob', {
      token, body: bytes, contentType: 'image/jpeg',
    });
    record.embed = {
      $type: 'app.bsky.embed.images',
      images: [{ alt: (altText || text || '').slice(0, 1000), image: up.blob }],
    };
  }

  // 3) Kayıt oluştur
  const created = await xrpc('com.atproto.repo.createRecord', {
    token,
    json: { repo: did, collection: 'app.bsky.feed.post', record },
  });
  return { uri: created.uri, cid: created.cid };
}
