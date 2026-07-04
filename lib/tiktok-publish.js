// lib/tiktok-publish.js — TikTok Content Posting API v2 (Direct Post, PULL_FROM_URL).
// Bağımlılık yok, sadece global fetch.
//
// Gerekli env:
//   TIKTOK_ACCESS_TOKEN   — TikTok OAuth (video.publish scope) ile alınan kullanıcı access token'ı
//
// ⚠️ ÖNEMLİ KISIT: Denetlenmemiş (unaudited) TikTok app'ler SADECE privacy_level='SELF_ONLY'
//    (özel/taslak) gönderebilir. HERKESE AÇIK yayın için TikTok app audit gerekir
//    (developers.tiktok.com başvuru, haftalar sürebilir). Ayrıca PULL_FROM_URL için
//    video_url domain'inin app'te "URL ownership" doğrulaması yapılmış olması gerekir.
//    Bu yüzden default privacy 'SELF_ONLY' — audit sonrası 'PUBLIC_TO_EVERYONE' geçilebilir.

const API = 'https://open.tiktokapis.com/v2';

/**
 * TikTok'a video yayınla (public URL'den çeker).
 * @param {string} accessToken
 * @param {{videoUrl:string, title?:string, privacy?:string}} opts
 * @returns {Promise<{publishId:string}>}
 */
export async function publishTikTok(accessToken, { videoUrl, title, privacy }) {
  if (!accessToken) throw new Error('TikTok env eksik (TIKTOK_ACCESS_TOKEN)');
  if (!videoUrl) throw new Error('TikTok: videoUrl gerekli');

  const res = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: (title || '').slice(0, 150),
        privacy_level: privacy || 'SELF_ONLY',
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  });
  const j = await res.json().catch(() => ({}));
  const err = j.error;
  if (!res.ok || (err && err.code && err.code !== 'ok')) {
    throw new Error(`TikTok init fail: ${err?.code || res.status} ${err?.message || ''}`.trim());
  }
  return { publishId: j.data?.publish_id };
}

/**
 * Yayın durumunu sorgula (opsiyonel).
 */
export async function fetchTikTokStatus(accessToken, publishId) {
  const res = await fetch(`${API}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const j = await res.json().catch(() => ({}));
  return j.data || j;
}
