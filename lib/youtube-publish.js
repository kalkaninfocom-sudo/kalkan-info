// lib/youtube-publish.js — YouTube Shorts yayın modülü (YouTube Data API v3, resumable upload)
//
// Ne yapar:
//   Bir video URL'sini indirip YouTube kanalına Shorts olarak yükler ve yayınlar.
//   Resumable upload protokolü kullanır (büyük dosyalar için güvenli, tek PUT).
//
// Gerekli env değişkenleri:
//   YOUTUBE_CLIENT_ID      — Google Cloud OAuth 2.0 Client ID
//   YOUTUBE_CLIENT_SECRET  — Google Cloud OAuth 2.0 Client Secret
//   YOUTUBE_REFRESH_TOKEN  — Kalıcı refresh token (aşağıya bak)
//
// Refresh token nasıl alınır:
//   1. Google Cloud Console → API & Services → Credentials → OAuth 2.0 Client ID oluştur (Web Application).
//   2. Authorized redirect URIs'e https://developers.google.com/oauthplayground ekle.
//   3. OAuth 2.0 Playground (https://developers.google.com/oauthplayground) aç:
//      Settings (dişli) → "Use your own OAuth credentials" → Client ID + Secret gir.
//   4. Scope: https://www.googleapis.com/auth/youtube.upload → Authorize → Exchange for tokens.
//   5. "Refresh token" değerini YOUTUBE_REFRESH_TOKEN olarak kaydet.
//   6. YouTube Data API v3'ü Google Cloud Console'da etkinleştir.
//
// Shorts koşulları (YouTube kuralı):
//   - Video dikey (9:16 en boy oranı) ve ≤60 saniye olmalı.
//   - Başlığa "#Shorts" eklenmesi algoritmik tanımayı garantiler.
//
// Bağımlılık: yok — sadece Node 20 global fetch + ArrayBuffer.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3/videos';
const TITLE_MAX = 100;
const DESC_MAX = 5000;

/**
 * YouTube Shorts yayınla.
 *
 * @param {{ clientId: string, clientSecret: string, refreshToken: string }} auth
 * @param {{ videoUrl: string, title: string, description?: string, tags?: string[] }} meta
 * @returns {Promise<{ videoId: string, url: string }>}
 */
export async function publishYouTubeShort(
  { clientId, clientSecret, refreshToken },
  { videoUrl, title, description = '', tags = [] }
) {
  // 1) Access token al (refresh token akışı)
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`YouTube token hatası: ${JSON.stringify(tokenJson)}`);
  }
  const accessToken = tokenJson.access_token;

  // 2) Video byte'larını indir
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Video indirilemedi (${videoRes.status}): ${videoUrl}`);
  }
  const videoBytes = await videoRes.arrayBuffer();

  // 3a) Resumable upload oturumu başlat — snippet + status metadata gönder
  const shortTitle = title.slice(0, TITLE_MAX - 7); // "#Shorts" için yer bırak
  const finalTitle = `${shortTitle} #Shorts`;
  const finalDescription = description.slice(0, DESC_MAX);

  const sessionRes = await fetch(
    `${UPLOAD_BASE}?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': String(videoBytes.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: finalTitle,
          description: finalDescription,
          tags,
          categoryId: '19', // Travel & Events
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );
  if (!sessionRes.ok) {
    const errText = await sessionRes.text();
    throw new Error(`YouTube upload oturumu başlatılamadı (${sessionRes.status}): ${errText}`);
  }
  const uploadUrl = sessionRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube upload oturumu yanıtında Location header yok');
  }

  // 3b) Video byte'larını resumable URL'e yükle
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBytes.byteLength),
    },
    body: videoBytes,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.id) {
    throw new Error(`YouTube video yükleme hatası (${uploadRes.status}): ${JSON.stringify(uploadJson)}`);
  }

  const videoId = uploadJson.id;
  return {
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`,
  };
}
