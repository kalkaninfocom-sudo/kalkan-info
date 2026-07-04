# Sosyal Platform Dağıtımı — Kurulum (blotato mantığı, kendi altyapımız)

Tek onaydan (Telegram "Yayınla Şimdi") **IG + FB + Threads + Bluesky + YouTube + TikTok**'a dağıtım.
Kod: `lib/social-fanout.js` → `publishNow` (api/telegram-webhook.js) IG/FB'den sonra çağırır.
**Her platform graceful:** env yoksa atlanır, hata IG/FB yayınını BOZMAZ. Görsel → Threads+Bluesky; video/reel → dördü de.

Env değişkenleri **Vercel** (prod) + `.env.local` (test) ikisine de eklenmeli.

---

## 1) Threads (en kolay — Meta ekosistemi)
Env: `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`
- developers.facebook.com → app'ine **Threads API** ürününü ekle.
- Threads hesabını (IG ile bağlı) yetkilendir → uzun ömürlü token al (`threads_basic`, `threads_content_publish` scope).
- `THREADS_USER_ID` = Threads kullanıcı ID (`GET graph.threads.net/v1.0/me?fields=id`).

## 2) Bluesky (tamamen ücretsiz, 2 dk, onay yok)
Env: `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`
- bsky.app → hesap aç (örn. `kalkaninfo.bsky.social`).
- Settings → **App Passwords** → yeni app password üret → `BLUESKY_APP_PASSWORD`.
- `BLUESKY_HANDLE` = tam handle.

## 3) YouTube Shorts (video için)
Env: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
- Google Cloud Console → proje → **YouTube Data API v3** aç.
- OAuth consent screen + OAuth Client (Desktop) → `client_id` + `client_secret`.
- `youtube.upload` scope ile bir kez OAuth yap → **refresh token** al (OAuth Playground kolay yol).
- Reels dikey 9:16 <60sn olduğu için otomatik Shorts sayılır (başlığa #Shorts eklenir).

## 4) TikTok (video için — ⚠️ audit gerekir)
Env: `TIKTOK_ACCESS_TOKEN` (+ opsiyonel `TIKTOK_PRIVACY`)
- developers.tiktok.com → app → **Content Posting API** + `video.publish` scope.
- OAuth ile kullanıcı access token al.
- **KISIT:** denetlenmemiş app sadece `SELF_ONLY` (taslak/özel) gönderebilir. Herkese açık için **app audit** başvurusu gerekir (haftalar). `TIKTOK_PRIVACY=PUBLIC_TO_EVERYONE` audit sonrası.
- PULL_FROM_URL için video domain'i (Supabase) app'te **URL ownership** doğrulanmalı.

---

**Durum:** Kod hazır + canlı (graceful). Token eklendikçe o platform otomatik devreye girer — kod değişikliği gerekmez.
