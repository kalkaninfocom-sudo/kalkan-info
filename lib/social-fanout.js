// lib/social-fanout.js — Ek platform dağıtımı (Threads / Bluesky / YouTube Shorts / TikTok).
// IG + FB ana yayından SONRA çağrılır. HER platform graceful:
//   - env yoksa → 'atlandı (env yok)'
//   - hata olursa → 'hata: ...'  (hiçbiri IG/FB yayınını BOZMAZ; hepsi bonus)
// Görsel gönderiler: Threads + Bluesky. Video/reel: dördü de (YouTube/TikTok sadece video).
//
// Gerekli env (hangileri varsa o platform aktif):
//   Threads : THREADS_USER_ID, THREADS_ACCESS_TOKEN
//   Bluesky : BLUESKY_HANDLE, BLUESKY_APP_PASSWORD
//   YouTube : YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
//   TikTok  : TIKTOK_ACCESS_TOKEN  (+ opsiyonel TIKTOK_PRIVACY, default SELF_ONLY)

import { publishThreads } from './threads-publish.js';
import { publishBluesky } from './bluesky-publish.js';
import { publishYouTubeShort } from './youtube-publish.js';
import { publishTikTok } from './tiktok-publish.js';

const short = (e) => String(e?.message || e).slice(0, 90);
const firstLine = (t) => (String(t || '').split('\n')[0] || 'Kalkan Info').slice(0, 90);

/**
 * Ek platformlara dağıt. Her platform bağımsız try/catch.
 * @param {{ caption?:string, mediaUrl:string, isVideo?:boolean }} post
 * @returns {Promise<Record<string,string>>} platform → sonuç metni
 */
export async function fanoutExtraPlatforms({ caption, mediaUrl, isVideo }) {
  const results = {};
  const text = caption || '';
  const media = isVideo ? { videoUrl: mediaUrl, text } : { imageUrl: mediaUrl, text };

  // ── Threads (görsel + video) — mevcut Meta altyapısı ──
  const { THREADS_USER_ID, THREADS_ACCESS_TOKEN } = process.env;
  if (THREADS_USER_ID && THREADS_ACCESS_TOKEN) {
    try { const r = await publishThreads(THREADS_USER_ID, THREADS_ACCESS_TOKEN, media); results.threads = `✓ ${r.id}`; }
    catch (e) { results.threads = 'hata: ' + short(e); }
  } else results.threads = 'atlandı (env yok)';

  // ── Bluesky (görsel + video) — ücretsiz ──
  const { BLUESKY_HANDLE, BLUESKY_APP_PASSWORD } = process.env;
  if (BLUESKY_HANDLE && BLUESKY_APP_PASSWORD) {
    try { await publishBluesky({ handle: BLUESKY_HANDLE, appPassword: BLUESKY_APP_PASSWORD }, { ...media, altText: text }); results.bluesky = '✓'; }
    catch (e) { results.bluesky = 'hata: ' + short(e); }
  } else results.bluesky = 'atlandı (env yok)';

  // ── YouTube Shorts (SADECE video) ──
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (isVideo) {
    if (YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && YOUTUBE_REFRESH_TOKEN) {
      try {
        const r = await publishYouTubeShort(
          { clientId: YOUTUBE_CLIENT_ID, clientSecret: YOUTUBE_CLIENT_SECRET, refreshToken: YOUTUBE_REFRESH_TOKEN },
          { videoUrl: mediaUrl, title: firstLine(text), description: text, tags: ['kalkan', 'kalkaninfo', 'kaş', 'antalya'] },
        );
        results.youtube = `✓ ${r.videoId || ''}`.trim();
      } catch (e) { results.youtube = 'hata: ' + short(e); }
    } else results.youtube = 'atlandı (env yok)';
  }

  // ── TikTok (SADECE video) ──
  const { TIKTOK_ACCESS_TOKEN, TIKTOK_PRIVACY } = process.env;
  if (isVideo) {
    if (TIKTOK_ACCESS_TOKEN) {
      try {
        const r = await publishTikTok(TIKTOK_ACCESS_TOKEN, { videoUrl: mediaUrl, title: firstLine(text), privacy: TIKTOK_PRIVACY || 'SELF_ONLY' });
        results.tiktok = `✓ ${r.publishId || ''}`.trim();
      } catch (e) { results.tiktok = 'hata: ' + short(e); }
    } else results.tiktok = 'atlandı (env yok)';
  }

  return results;
}

/** Telegram mesajı için tek satır özet. */
export function fanoutSummary(results) {
  const order = ['threads', 'bluesky', 'youtube', 'tiktok'];
  return order.filter(k => results[k]).map(k => `${k}: ${results[k]}`).join('\n');
}
